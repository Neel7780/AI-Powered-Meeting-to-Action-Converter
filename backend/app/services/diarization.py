"""Client for the self-hosted diarization worker (diarization-worker/ on a free HF Space)."""

from __future__ import annotations

import httpx

from app.core.config import settings


class DiarizationError(RuntimeError):
    pass


def is_configured() -> bool:
    return bool(settings.DIARIZATION_WORKER_URL and settings.DIARIZATION_WORKER_SECRET)


def diarize_audio(audio: bytes, filename: str, mime_type: str, num_speakers: int) -> list[dict]:
    """Send audio to the worker; returns [{start_ms, end_ms, speaker, text}] in time order."""
    try:
        resp = httpx.post(
            f"{settings.DIARIZATION_WORKER_URL}/diarize",
            headers={"X-Worker-Secret": settings.DIARIZATION_WORKER_SECRET},
            files={"audio": (filename, audio, mime_type)},
            data={"num_speakers": str(num_speakers)},
            timeout=settings.DIARIZATION_TIMEOUT_SECONDS,
        )
    except httpx.HTTPError as exc:
        raise DiarizationError(f"Diarization worker unreachable: {exc}") from exc
    if resp.status_code != 200:
        raise DiarizationError(f"Diarization worker returned {resp.status_code}: {resp.text[:300]}")

    segments = []
    for seg in resp.json().get("segments", []):
        text = str(seg.get("text") or "").strip()
        if not text:
            continue
        start = max(0, int(seg.get("start_ms") or 0))
        segments.append({
            "start_ms": start,
            "end_ms": max(start, int(seg.get("end_ms") or start)),
            "speaker": str(seg.get("speaker") or "SPEAKER_00"),
            "text": text,
        })
    if not segments:
        raise DiarizationError("No speech detected in the recording")
    return sorted(segments, key=lambda s: s["start_ms"])


def default_speaker_names(segments: list[dict]) -> dict[str, str]:
    """SPEAKER_03 -> 'Speaker 1' etc., numbered in order of first appearance."""
    names: dict[str, str] = {}
    for seg in segments:
        names.setdefault(seg["speaker"], f"Speaker {len(names) + 1}")
    return names
