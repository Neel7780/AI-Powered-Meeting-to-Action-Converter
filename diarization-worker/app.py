"""ActionPulse diarization worker.

Runs anywhere Python runs: a free Kaggle/Colab GPU notebook (see kaggle_colab_worker.ipynb),
your own machine, or Docker.

POST /diarize  (multipart: audio file + num_speakers)  ->  {"segments": [{start_ms, end_ms, speaker, text}]}
GET  /         health + which device the models are on
GET  /selftest loads the models and runs them on 2 s of generated audio (needs the secret)

Pipeline:
  1. ffmpeg -> 16 kHz mono 16-bit WAV
  2. faster-whisper (CTranslate2; float16 on CUDA, int8 on CPU) -> text segments with timestamps
  3. pyannote speaker-diarization-community-1 with the EXACT number of speakers
     (the organiser already told us who attended)
  4. each text segment gets the speaker that overlaps it most; consecutive
     segments from the same speaker are merged.

Audio is decoded once here and handed to both models as arrays, so neither PyAV (faster-whisper)
nor torchcodec (pyannote 4) has to decode files; their versions often clash with notebook images.

If Whisper can't use the GPU (missing CUDA 12 cuBLAS / cuDNN 9), it falls back to CPU instead of failing.

Auth: callers must send `X-Worker-Secret: <WORKER_SECRET>`. Only the ActionPulse backend knows it.
The worker never touches Supabase.
"""

import hmac
import logging
import os
import subprocess
import sys
import tempfile
import threading
import traceback
import wave
from pathlib import Path

import numpy as np
from fastapi import FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse

WORKER_SECRET = os.environ.get("WORKER_SECRET", "")
HF_TOKEN = os.environ.get("HF_TOKEN", "")
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "small")  # tiny | base | small | medium | large-v3-turbo
DIARIZATION_MODEL = os.environ.get("DIARIZATION_MODEL", "pyannote/speaker-diarization-community-1")
DEVICE = os.environ.get("DEVICE", "auto")  # auto | cuda | cpu
SAMPLE_RATE = 16000
MAX_AUDIO_BYTES = 50 * 1024 * 1024
MERGE_GAP_MS = 1500

logging.basicConfig(level=logging.INFO, stream=sys.stderr, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("worker")

app = FastAPI(title="ActionPulse diarization worker")
_lock = threading.Lock()  # one job at a time
_models: dict = {}


@app.exception_handler(Exception)
async def _unhandled(_: Request, exc: Exception):
    # Log the full traceback and send the real reason back, so failures are debuggable from the caller.
    log.error("Unhandled error:\n%s", traceback.format_exc())
    return JSONResponse(status_code=500, content={"detail": f"{type(exc).__name__}: {exc}"})


def _cuda_available() -> bool:
    try:
        import torch

        return torch.cuda.is_available()
    except Exception:  # noqa: BLE001 - no usable torch means no GPU
        return False


def _whisper(device: str):
    from faster_whisper import WhisperModel

    if device == "cuda":
        return WhisperModel(WHISPER_MODEL, device="cuda", compute_type="float16")
    return WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8", cpu_threads=os.cpu_count() or 2)


def _load():
    if _models:
        return _models
    import torch
    from pyannote.audio import Pipeline

    use_gpu = DEVICE != "cpu" and _cuda_available()
    _models["asr_device"] = "cuda" if use_gpu else "cpu"
    _models["asr"] = _whisper(_models["asr_device"])

    diar = Pipeline.from_pretrained(DIARIZATION_MODEL, token=HF_TOKEN or None)
    if diar is None:
        raise RuntimeError(
            f"Could not load {DIARIZATION_MODEL}: set HF_TOKEN and accept the model's terms on Hugging Face"
        )
    if use_gpu:
        diar.to(torch.device("cuda"))
    _models["diar"] = diar
    _models["diar_device"] = "cuda" if use_gpu else "cpu"
    log.info("Models loaded: whisper=%s on %s, diarization on %s", WHISPER_MODEL, _models["asr_device"],
             _models["diar_device"])
    return _models


def _to_wav(src: Path, dst: Path) -> None:
    subprocess.run(
        ["ffmpeg", "-nostdin", "-y", "-i", str(src), "-ac", "1", "-ar", str(SAMPLE_RATE), "-sample_fmt", "s16",
         str(dst)],
        check=True, capture_output=True, timeout=900,
    )


def _read_wav(path: Path) -> np.ndarray:
    """16 kHz mono 16-bit WAV -> float32 array in [-1, 1]."""
    with wave.open(str(path), "rb") as w:
        frames = w.readframes(w.getnframes())
    return np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0


def _transcribe(samples: np.ndarray, language: str | None):
    """faster-whisper is lazy: CUDA library errors only show up while iterating, so consume it here."""
    def run():
        segments, info = _models["asr"].transcribe(samples, language=language or None, vad_filter=True)
        return [
            {"start_ms": int(s.start * 1000), "end_ms": int(s.end * 1000), "text": s.text} for s in segments
        ], info.language

    try:
        return run()
    except RuntimeError as exc:
        msg = str(exc).lower()
        if _models["asr_device"] != "cuda" or not any(k in msg for k in ("cublas", "cudnn", "cuda", "libcu")):
            raise
        log.warning("Whisper on GPU failed (%s); falling back to CPU. Install nvidia-cublas-cu12 and "
                    "nvidia-cudnn-cu12==9.* and set LD_LIBRARY_PATH to keep it on the GPU.", exc)
        _models["asr_device"] = "cpu"
        _models["asr"] = _whisper("cpu")
        return run()


def _speaker_turns(output) -> list[tuple[int, int, str]]:
    """Accepts pyannote 4 output (DiarizeOutput) and pyannote 3 output (Annotation)."""
    annotation = None
    for attr in ("exclusive_speaker_diarization", "speaker_diarization"):
        annotation = getattr(output, attr, None)
        if annotation is not None:
            break
    if annotation is None:
        annotation = output

    if hasattr(annotation, "itertracks"):
        items = ((turn, label) for turn, _, label in annotation.itertracks(yield_label=True))
    else:  # documented 4.x form: `for turn, speaker in output.speaker_diarization`
        items = iter(annotation)
    return [(int(turn.start * 1000), int(turn.end * 1000), str(label)) for turn, label in items]


def _diarize(samples: np.ndarray, num_speakers: int) -> list[tuple[int, int, str]]:
    import torch

    waveform = torch.from_numpy(samples.copy()).unsqueeze(0)  # (channel, time)
    return _speaker_turns(_models["diar"]({"waveform": waveform, "sample_rate": SAMPLE_RATE},
                                          num_speakers=num_speakers))


def _best_speaker(start: int, end: int, turns: list[tuple[int, int, str]]) -> str | None:
    overlap: dict[str, int] = {}
    for t_start, t_end, label in turns:
        o = min(end, t_end) - max(start, t_start)
        if o > 0:
            overlap[label] = overlap.get(label, 0) + o
    if overlap:
        return max(overlap, key=overlap.get)
    # no overlap (silence gap): take the nearest turn
    nearest = min(turns, key=lambda t: min(abs(start - t[1]), abs(end - t[0])), default=None)
    return nearest[2] if nearest else None


def assign_speakers(asr_segments: list[dict], turns: list[tuple[int, int, str]]) -> list[dict]:
    merged: list[dict] = []
    for seg in asr_segments:
        text = seg["text"].strip()
        if not text:
            continue
        speaker = _best_speaker(seg["start_ms"], seg["end_ms"], turns) or "SPEAKER_00"
        prev = merged[-1] if merged else None
        if prev and prev["speaker"] == speaker and seg["start_ms"] - prev["end_ms"] <= MERGE_GAP_MS:
            prev["text"] = f'{prev["text"]} {text}'
            prev["end_ms"] = seg["end_ms"]
        else:
            merged.append({"start_ms": seg["start_ms"], "end_ms": seg["end_ms"], "speaker": speaker, "text": text})
    return merged


def process(samples: np.ndarray, num_speakers: int, language: str | None = None) -> dict:
    with _lock:
        _load()
        asr_segments, lang = _transcribe(samples, language)
        turns = _diarize(samples, num_speakers)
    return {"language": lang, "segments": assign_speakers(asr_segments, turns)}


@app.get("/")
def health():
    return {
        "status": "ok",
        "whisper": WHISPER_MODEL,
        "diarization": DIARIZATION_MODEL,
        "device": _models.get("asr_device", "not loaded yet"),
        "diarization_device": _models.get("diar_device", "not loaded yet"),
        "cuda_available": _cuda_available(),
    }


@app.get("/selftest")
def selftest(x_worker_secret: str = Header("")):
    """Loads both models and runs them on 2 s of a tone: proves the whole stack works."""
    if not WORKER_SECRET or not hmac.compare_digest(x_worker_secret, WORKER_SECRET):
        raise HTTPException(401, "Invalid worker secret")
    t = np.arange(2 * SAMPLE_RATE, dtype=np.float32) / SAMPLE_RATE
    tone = (0.1 * np.sin(2 * np.pi * 220 * t)).astype(np.float32)
    result = process(tone, num_speakers=1)
    return {"ok": True, "device": _models["asr_device"], "diarization_device": _models["diar_device"],
            "segments": len(result["segments"])}


@app.post("/diarize")
def diarize(
    audio: UploadFile = File(...),
    num_speakers: int = Form(..., ge=1, le=50),
    language: str | None = Form(None),
    x_worker_secret: str = Header(""),
):
    if not WORKER_SECRET or not hmac.compare_digest(x_worker_secret, WORKER_SECRET):
        raise HTTPException(401, "Invalid worker secret")

    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "input"
        data = audio.file.read(MAX_AUDIO_BYTES + 1)
        if len(data) > MAX_AUDIO_BYTES:
            raise HTTPException(413, "Audio larger than 50 MB")
        src.write_bytes(data)
        wav = Path(tmp) / "audio.wav"
        try:
            _to_wav(src, wav)
        except subprocess.CalledProcessError as exc:
            raise HTTPException(422, f"Could not decode audio: {exc.stderr[-300:]!r}") from exc
        samples = _read_wav(wav)

    if samples.size < SAMPLE_RATE // 2:
        raise HTTPException(422, "Recording is shorter than half a second")
    return process(samples, num_speakers, language)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "7860")))
