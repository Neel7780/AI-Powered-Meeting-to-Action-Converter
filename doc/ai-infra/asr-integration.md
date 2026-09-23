# ASR Integration
**Verified:** 22 September 2026  
**Project:** AI-Powered Meeting-to-Action Converter for Teams

## 1. Scope

The Team Hub identifies:
- ASR Vendor;
- Meeting Platforms (Google Meet / Zoom / Microsoft Teams);
- Task Management Destinations (Jira / Linear / Notion / Asana);
- Meeting Note-Taker;
- Chair / Organiser;
- External Participant.

The core requirement is not “use ASR”. The core requirement is to obtain a **canonical transcript containing text, timestamps and speaker identity where possible**.

The current product description explicitly keeps meeting-bot/ASR auto-capture as a later-phase option.

Source:
https://www.notion.so/G-10-IT314-Team-Hub-1666e879513483b0be7881b1b3ccff07

# PART A — PLATFORM CAPTURE FEASIBILITY

## 2. What we actually need from a meeting platform

There are three useful input modes.

### Mode 1 — Post-meeting transcript

```text
Meeting
  -> platform generates transcript
  -> our backend fetches transcript
  -> normalize speaker/text/time
  -> LLM
```

This is the cheapest and simplest path.

### Mode 2 — Realtime transcript/captions

```text
Meeting
  -> live transcript/caption events
  -> our backend
  -> canonical transcript
  -> streaming/near-realtime LLM
```

This avoids paying for external ASR when the platform already transcribes.

### Mode 3 — Raw audio

```text
Meeting
  -> audio stream
  -> external/self-hosted ASR
  -> canonical transcript
  -> LLM
```

This should be the fallback because it introduces:
- ASR cost;
- another vendor;
- audio privacy concerns;
- additional streaming infrastructure.

# PART B — GOOGLE MEET

## 3. Post-meeting transcript

Google Meet REST exposes transcript entries containing:
- participant reference;
- text;
- language code;
- start time;
- end time.

Official reference:
https://developers.google.com/workspace/meet/api/reference/rest/v2/conferenceRecords.transcripts.entries

This maps directly into the project's canonical transcript object.

### Free status

The Meet REST API itself does not add a separate API fee under standard usage, but transcript availability depends on the Google Workspace edition and meeting settings.

Google currently lists transcript support for:
- Business Standard;
- Business Plus;
- Enterprise Starter;
- Enterprise Standard;
- Enterprise Plus;
- Teaching and Learning Upgrade;
- Education Plus;
- Workspace Individual.

Google Workspace for Education student licenses have transcripts off by default.

Consumer/free Gmail Meet should therefore **not** be treated as a dependable free transcript source.

Source:
https://support.google.com/meet/answer/12849897

## 4. Realtime Media API

Google Meet Media API provides realtime:
- audio;
- video;
- participant metadata.

Google explicitly lists action-item/documentation applications as a use case.

However it remains **Developer Preview**.

All of these must be enrolled in the relevant preview program:
- Google Cloud project;
- OAuth principal;
- every conference participant.

Sources:
https://developers.google.com/workspace/meet/media-api/guides/overview
https://developers.google.com/workspace/meet/media-api/guides/get-started

### Project status

```text
Meet post-meeting transcript -> USE when eligible
Meet realtime audio          -> DEFER
External ASR                 -> fallback
```

# PART C — ZOOM

## 5. Realtime Media Streams (RTMS)

Zoom RTMS can provide:
- live audio;
- live video;
- screen share;
- transcript data;
- participant events;
- timestamps;
- participant-level media.

Sources:
https://developers.zoom.us/docs/rtms/meetings/
https://developers.zoom.us/docs/rtms/meetings/getting-started/

This is technically an excellent fit for the product.

## 6. Is RTMS free?

No.

Zoom's current plan-compatibility documentation states:
- Basic: RTMS not supported;
- Pro/Business/Enterprise: RTMS requires an active Developer Pack subscription.

Source:
https://developers.zoom.us/docs/rtms/troubleshooting/

Therefore:

```text
Zoom Basic + RTMS       -> NO
Zoom + Developer Pack   -> YES
```

There may be trial/credit entitlements on individual accounts, but the project must not treat them as a permanent free dependency.

## 7. Post-meeting transcript

Zoom exposes transcript-related meeting APIs, but transcript generation is dependent on account/meeting feature availability.

Therefore:

```text
Zoom post-meeting transcript -> account-dependent
Zoom RTMS realtime           -> paid/credit dependency
```

# PART D — MICROSOFT TEAMS

## 8. Post-meeting transcript

Microsoft Graph exposes Teams meeting transcripts.

Relevant permission:
`OnlineMeetingTranscript.Read.All`

The transcript content can be consumed as WebVTT, which is useful for:
- text;
- timestamps;
- speaker-attributed utterances where available.

Sources:
https://learn.microsoft.com/en-us/graph/api/onlinemeeting-list-transcripts
https://learn.microsoft.com/en-us/graph/api/calltranscript-get

Personal Microsoft accounts are not supported for this transcript API.

## 9. Teams transcript API free/evaluation path

Microsoft currently provides an **evaluation mode** for Teams meeting transcript and recording content APIs that can be used without configuring Azure billing.

With Azure billing:
- transcript content is priced at **$0.0022/minute**;
- recording content is priced at **$0.003/minute**.

Source:
https://learn.microsoft.com/en-ca/graph/teams-licenses

Important distinction:

> Free API evaluation does not mean every Microsoft account can generate meeting transcripts for free. The meeting/tenant must actually have the Teams transcript capability enabled.

## 10. Realtime media

Microsoft has an application-hosted media bot path for realtime media, but it is a heavier/preview-oriented architecture and pulls the project toward Azure + C#/.NET.

Source:
https://learn.microsoft.com/en-us/microsoftteams/platform/bots/calls-and-meetings/requirements-considerations-application-hosted-media-bots

For this project:

```text
Teams post-meeting transcript -> PRIMARY PLATFORM INTEGRATION
Teams realtime media          -> LATER
External ASR                  -> only if transcript unavailable
```

# PART E — HOW ASR HANDLES EVERY PARTICIPANT

## 11. One mixed recording + diarization

If a platform gives one mixed recording:

```text
mixed meeting audio
       |
       v
ASR + speaker diarization
       |
       +--> speaker_0
       +--> speaker_1
       +--> speaker_2
       |
       v
speaker mapping
       |
       v
canonical transcript
```

The ASR engine can identify separate speakers, but it does not automatically know that `speaker_2` means “Bhagy”.

The application needs to map:
```text
platform participant / transcript identity
              ->
internal workspace user
```

## 12. Participant-specific audio

If the platform exposes audio per participant, identity can be preserved directly.

Zoom RTMS is an example of this pattern.

Architecture:

```text
Zoom RTMS
   |
   +--> Bhagy audio -> ASR -> Bhagy
   +--> Neel audio  -> ASR -> Neel
   +--> Madhav audio-> ASR -> Madhav
   |
   v
timestamp merge
   |
   v
canonical transcript
```

In this architecture we do not need to infer speaker identity from an anonymous diarization label.

## 13. Platform-native speaker transcript

If Teams/Meet/another platform already returns:

```text
speaker
timestamp
text
```

then **no external ASR is necessary**.

Use:

```text
platform transcript
   -> canonical transcript
   -> LLM
```

## 14. When no speaker identity exists

Never guess.

Use:

```json
{
  "owner": null,
  "needs_confirmation": true
}
```

and send the action to the organizer/Chair review flow.

This matches the Team Hub's survey result that users preferred organizer confirmation when owner/deadline information was uncertain.

# PART F — CURRENT ASR CANDIDATES

## 15. Sarvam Speech-to-Text

Current pricing:
- STT: ₹30/hour;
- STT + diarization: ₹45/hour;
- STT + translate: ₹30/hour;
- STT + translate + diarization: ₹45/hour.

Current starter credits:
- ₹100 per new user;
- credits never expire.

Current limits:
- REST: max 30 seconds/audio request;
- Batch: up to 2 hours/file;
- Batch: up to 20 files/job;
- WebSocket streaming: continuous chunked streaming.

Sarvam documents a dedicated code-mix capability relevant to Indian English/Hinglish workloads.

Sources:
https://docs.sarvam.ai/api/getting-started/pricing
https://docs.sarvam.ai/api/getting-started/ratelimits
https://docs.sarvam.ai/api/speech-to-text/faq

## 16. OpenRouter — Whisper Large V3 Turbo

Model:
`openai/whisper-large-v3-turbo`

Current price:
**$0.000003/second**

Approximate:
- 30 minutes: $0.0054;
- 1 hour: $0.0108.

OpenRouter currently describes it as supporting 99+ languages and common audio formats, with high-speed inference.

Source:
https://openrouter.ai/openai/whisper-large-v3-turbo

This is extremely cheap, but it is **not free**.

## 17. OpenRouter — Qwen3 ASR 0.6B

Model:
`qwen/qwen3-asr-0.6b`

Current price:
**$0.000003/second**

Current documentation:
- 30 languages + 22 Chinese dialects;
- multilingual language identification;
- streaming and offline inference;
- segment-level and word-level timestamps.

Source:
https://openrouter.ai/qwen/qwen3-asr-0.6b

Use it as a very low-cost benchmark, not as an assumed Hinglish winner.

## 18. OpenRouter — Microsoft MAI-Transcribe 2

Model:
`microsoft/mai-transcribe-2`

Current price:
**$0.10/hour**

Current model description includes:
- 60 languages;
- automatic language identification;
- code switching;
- speaker diarization;
- word-level timestamps;
- keyword biasing.

Source:
https://openrouter.ai/microsoft/mai-transcribe-2

This is a useful speaker/code-switch benchmark.

## 19. ASR comparison

| Candidate | Current cost | Speaker support | Hinglish/code-switch | Role |
|---|---:|---|---|---|
| Sarvam STT | ₹30/hour | Yes with diarization | Explicit code-mix mode | Primary Indic benchmark |
| Whisper Large V3 Turbo | $0.000003/sec | Benchmark separately | Needs project test | Cheapest broad-language benchmark |
| Qwen3 ASR 0.6B | $0.000003/sec | Benchmark separately | Needs project test | Cheapest lightweight benchmark |
| MAI-Transcribe 2 | $0.10/hour | Yes | Explicit code switching | Speaker/code-switch benchmark |

# PART G — PLATFORM + ASR DECISION

## 20. Student MVP capture priority

```text
Priority 1
Native post-meeting transcript
        ↓
Priority 2
Native realtime caption/transcript
        ↓
Priority 3
Cheap external ASR
        ↓
Priority 4
Self-hosted/open-source ASR
```

Do not run external ASR when the platform has already produced usable transcript text.

# PART H — TASKS

## 21. Integration tasks

### Task 1 — Prove manual transcript ingestion
Support paste, typed transcript, `.txt`, `.vtt`, `.srt`.

### Task 2 — Prove Teams transcript ingestion
Test OAuth, permission, transcript retrieval, VTT parsing, speaker attribution and evaluation-mode behaviour.

### Task 3 — Prove Google Meet transcript ingestion
Test OAuth, transcript retrieval, participant mapping and Workspace-edition limitations.

### Task 4 — Benchmark one external ASR path
Run the same meeting recording through Sarvam and one OpenRouter model.

### Task 5 — Prove participant mapping
Test:
- participant-specific audio;
- diarization labels;
- no speaker identity.

### Task 6 — Measure downstream quality
Measure not only WER, but:
- owner accuracy;
- deadline preservation;
- timestamp accuracy;
- WHO/WHAT/WHEN extraction.

### Task 7 — Evaluate realtime capture later
For Zoom: RTMS.
For Meet: Media API.
For Teams: application-hosted media bot.

# Sources

- G-10 Team Hub: https://www.notion.so/G-10-IT314-Team-Hub-1666e879513483b0be7881b1b3ccff07
- Google Meet transcript entries: https://developers.google.com/workspace/meet/api/reference/rest/v2/conferenceRecords.transcripts.entries
- Google Meet transcript availability: https://support.google.com/meet/answer/12849897
- Google Meet Media API overview: https://developers.google.com/workspace/meet/media-api/guides/overview
- Google Meet Media API get started: https://developers.google.com/workspace/meet/media-api/guides/get-started
- Zoom RTMS overview: https://developers.zoom.us/docs/rtms/meetings/
- Zoom RTMS getting started: https://developers.zoom.us/docs/rtms/meetings/getting-started/
- Zoom RTMS plan compatibility: https://developers.zoom.us/docs/rtms/troubleshooting/
- Teams transcripts: https://learn.microsoft.com/en-us/graph/api/onlinemeeting-list-transcripts
- Teams callTranscript: https://learn.microsoft.com/en-us/graph/api/calltranscript-get
- Teams meeting API licensing/evaluation: https://learn.microsoft.com/en-ca/graph/teams-licenses
- Teams application-hosted media bot: https://learn.microsoft.com/en-us/microsoftteams/platform/bots/calls-and-meetings/requirements-considerations-application-hosted-media-bots
- Sarvam pricing: https://docs.sarvam.ai/api/getting-started/pricing
- Sarvam rate limits: https://docs.sarvam.ai/api/getting-started/ratelimits
- Sarvam STT FAQ: https://docs.sarvam.ai/api/speech-to-text/faq
- OpenRouter Whisper Large V3 Turbo: https://openrouter.ai/openai/whisper-large-v3-turbo
- OpenRouter Qwen3 ASR 0.6B: https://openrouter.ai/qwen/qwen3-asr-0.6b
- OpenRouter MAI-Transcribe 2: https://openrouter.ai/microsoft/mai-transcribe-2
