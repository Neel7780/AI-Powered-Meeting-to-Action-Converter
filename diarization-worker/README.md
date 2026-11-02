---
title: ActionPulse Diarization Worker
emoji: 🎙️
colorFrom: indigo
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# ActionPulse diarization worker

Turns an offline-meeting recording into speaker-labelled transcript segments for the backend.
Fully free and open: it runs on a **Hugging Face Space (CPU basic, free: 2 vCPU / 16 GB RAM)**.

| Step | Model | License |
|---|---|---|
| Speech-to-text | [faster-whisper](https://github.com/SYSTRAN/faster-whisper) `small` (int8 on CPU) | MIT |
| Who spoke when | [`pyannote/speaker-diarization-community-1`](https://huggingface.co/pyannote/speaker-diarization-community-1) (pyannote.audio 4) | CC-BY-4.0 |

The backend always passes `num_speakers` = the meeting's participant count, which is the
single biggest accuracy boost for diarization. The worker outputs anonymous labels
(`SPEAKER_00`, ...); the organiser maps them to people in the app.

## Setup (about 15 minutes)

1. **Hugging Face account + token**: create a free account, then a *Read* token at
   <https://huggingface.co/settings/tokens>.
2. **Accept the model terms** (gated, free): open
   <https://huggingface.co/pyannote/speaker-diarization-community-1> while logged in and click *Agree*.
3. **Create the Space**: <https://huggingface.co/new-space>, SDK **Docker**, hardware **CPU basic (free)**.
   Visibility can be private.
4. **Push this folder** to the Space:
   ```bash
   git clone https://huggingface.co/spaces/<you>/actionpulse-diarization
   cp diarization-worker/* actionpulse-diarization/
   cd actionpulse-diarization && git add . && git commit -m "worker" && git push
   ```
5. **Space secrets** (Settings → Variables and secrets):
   - `HF_TOKEN`: your token from step 1
   - `WORKER_SECRET`: a long random string (`python -c "import secrets;print(secrets.token_urlsafe(32))"`)
   - optional `WHISPER_MODEL`: `base` (faster) or `medium` / `large-v3-turbo` (more accurate, slower)
6. **Backend env vars** (Render dashboard → Environment):
   - `DIARIZATION_WORKER_URL`: `https://<you>-actionpulse-diarization.hf.space`
     (for a private Space, also see the note below)
   - `DIARIZATION_WORKER_SECRET`: same value as `WORKER_SECRET`
7. Apply `supabase/migrations/0006_audio_diarization.sql` in the Supabase SQL editor.

Check that it's up: `GET https://<you>-actionpulse-diarization.hf.space/` returns `{"status": "ok"}`.

> **Private Space:** requests also need `Authorization: Bearer <HF token>`. The simplest option is a
> public Space: the `X-Worker-Secret` header already blocks everyone else from using `/diarize`.

## What to expect on the free tier

- **Speed:** roughly real time to 2x real time on CPU basic, so a 30-minute meeting takes
  about 15–40 minutes. The first request after a cold start also downloads the models (about 1 GB).
  The backend runs the job in the background and the meeting stays `processing`.
- **Sleep:** free Spaces sleep after 48 h without traffic and wake up on the next request.
- **One job at a time:** concurrent requests queue behind a lock.
- **Faster option:** run the same container on a free Colab or Kaggle GPU, or on a lab machine,
  and point `DIARIZATION_WORKER_URL` at it.

## Local run

```bash
docker build -t diarization-worker .
docker run -p 7860:7860 -e HF_TOKEN=hf_xxx -e WORKER_SECRET=dev diarization-worker
curl -H "X-Worker-Secret: dev" -F audio=@meeting.webm -F num_speakers=3 localhost:7860/diarize
```
