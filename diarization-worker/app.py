"""ActionPulse diarization worker (runs on a free Hugging Face Space, CPU Basic: 2 vCPU / 16 GB).

POST /diarize  (multipart: audio file + num_speakers)  ->  {"segments": [{start_ms, end_ms, speaker, text}]}

Pipeline:
  1. ffmpeg -> 16 kHz mono WAV
  2. faster-whisper (CTranslate2, int8 on CPU) -> text segments with timestamps
  3. pyannote speaker-diarization-community-1 with the EXACT number of speakers
     (the organiser already told us who attended)
  4. each text segment gets the speaker that overlaps it most; consecutive
     segments from the same speaker are merged.

Auth: callers must send `X-Worker-Secret: <WORKER_SECRET>`. Only the ActionPulse
backend knows the secret. The worker never touches Supabase.
"""

import hmac
import os
import subprocess
import tempfile
import threading
from pathlib import Path

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile

WORKER_SECRET = os.environ.get("WORKER_SECRET", "")
HF_TOKEN = os.environ.get("HF_TOKEN", "")
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "small")  # tiny | base | small | medium | large-v3-turbo
DIARIZATION_MODEL = os.environ.get("DIARIZATION_MODEL", "pyannote/speaker-diarization-community-1")
MAX_AUDIO_BYTES = 50 * 1024 * 1024
MERGE_GAP_MS = 1500

app = FastAPI(title="ActionPulse diarization worker")
_lock = threading.Lock()  # one job at a time: a free CPU Space can't run two in parallel
_models: dict = {}


def _load():
    if not _models:
        import torch
        from faster_whisper import WhisperModel
        from pyannote.audio import Pipeline

        use_gpu = torch.cuda.is_available() and os.environ.get("DEVICE", "auto") != "cpu"
        if use_gpu:
            # float16 fits Whisper small/medium + pyannote in a 4 GB+ GPU (T4, RTX 3050, ...)
            _models["asr"] = WhisperModel(WHISPER_MODEL, device="cuda", compute_type="float16")
        else:
            torch.set_num_threads(os.cpu_count() or 2)
            _models["asr"] = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8")
        diar = Pipeline.from_pretrained(DIARIZATION_MODEL, token=HF_TOKEN)
        if diar is None:
            raise RuntimeError(f"Could not load {DIARIZATION_MODEL}: check HF_TOKEN and accept the model terms")
        if use_gpu:
            diar.to(torch.device("cuda"))
        _models["diar"] = diar
        _models["device"] = "cuda" if use_gpu else "cpu"
    return _models["asr"], _models["diar"]


@app.get("/")
def health():
    return {"status": "ok", "whisper": WHISPER_MODEL, "diarization": DIARIZATION_MODEL,
            "device": _models.get("device", "not loaded yet")}


def _to_wav(src: Path, dst: Path) -> None:
    subprocess.run(
        ["ffmpeg", "-nostdin", "-y", "-i", str(src), "-ac", "1", "-ar", "16000", str(dst)],
        check=True, capture_output=True, timeout=600,
    )


def _speaker_turns(diarization) -> list[tuple[int, int, str]]:
    # pyannote 4 returns an object with .speaker_diarization; pyannote 3 returns the Annotation itself
    annotation = getattr(diarization, "exclusive_speaker_diarization", None) or getattr(
        diarization, "speaker_diarization", diarization
    )
    return [
        (int(turn.start * 1000), int(turn.end * 1000), str(label))
        for turn, _, label in annotation.itertracks(yield_label=True)
    ]


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

        with _lock:
            asr, diar = _load()
            segments, info = asr.transcribe(str(wav), language=language or None, vad_filter=True)
            asr_segments = [
                {"start_ms": int(s.start * 1000), "end_ms": int(s.end * 1000), "text": s.text}
                for s in segments
            ]
            turns = _speaker_turns(diar(str(wav), num_speakers=num_speakers))

    return {"language": info.language, "segments": assign_speakers(asr_segments, turns)}


if __name__ == "__main__":
    # Hugging Face "Gradio" Spaces start the app with `python app.py` and proxy port 7860.
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "7860")))
