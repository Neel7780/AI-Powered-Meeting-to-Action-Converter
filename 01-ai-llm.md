# 01 — AI / LLM Research & Prototype Plan

## Project context

**Project:** AI-Powered Meeting-to-Action Converter for Teams  
**Course:** IT314 Software Engineering  
**Research basis:** G-10 Team Hub in Notion, especially the Elicitation Plan, Functional Requirements, NFRs and Domain Requirements.

The product takes a meeting transcript and extracts:

- action/task
- owner/assignee
- deadline
- priority
- confidence
- source transcript excerpt

The Notion requirements explicitly call for **Document Analysis + Prototyping** for the LLM stakeholder. The current project requirements also expect grounded extraction, review before commitment, structured output, measurable accuracy and bounded latency.

---

## 1. Stakeholder and elicitation scope

### Stakeholder
**LLM Provider**

### Required elicitation techniques
1. **Document Analysis**
   - Check structured-output support.
   - Check function/tool calling.
   - Check token limits.
   - Check rate limits.
   - Check pricing/free tier.
   - Check what happens on errors and quota exhaustion.
   - Check data-use/privacy settings.

2. **Prototyping**
   - Send representative meeting transcripts to the selected model.
   - Force a JSON/schema response.
   - Test ambiguous owners and missing deadlines.
   - Test hallucination resistance.
   - Measure latency.
   - Compare at least two candidate models if possible.

The Notion Elicitation Plan already records that major providers support schema-constrained output/function calling and that the pipeline needs retry/backoff because API limits are not unlimited.

---

## 2. Candidate AI providers

### Candidate A — Google Gemini 2.5 Flash

**Why it fits**
- Structured outputs are supported.
- Function calling is supported.
- Large context window.
- Suitable for low-latency, high-volume processing.
- Google currently lists a free tier for the model.

Google's current model documentation describes Gemini 2.5 Flash as supporting structured outputs, function calling and a 1,048,576-token input limit.

Pricing documentation currently shows a free tier for Gemini 2.5 Flash. Google also documents rate limits in RPM, TPM and RPD, with limits varying by model and usage tier.

**MVP position:** Primary LLM candidate.

Sources:
- https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash
- https://ai.google.dev/gemini-api/docs/pricing
- https://ai.google.dev/gemini-api/docs/rate-limits

### Candidate B — Sarvam 105B

Sarvam is especially relevant if the project later supports Indian-language or Hinglish meetings.

Current published pricing:
- Sarvam 105B input: ₹29.28 / 1M tokens
- cached input: ₹10.98 / 1M
- output: ₹73.20 / 1M
- new users receive ₹100 free credits
- starter rate limit: 60 requests/minute

This makes it useful as a low-cost fallback or Indian-language experiment, but the team should verify structured-output behaviour for the exact API/model version before selecting it as the main extraction engine.

Sources:
- https://docs.sarvam.ai/api/getting-started/pricing
- https://docs.sarvam.ai/api/getting-started/ratelimits

---

## 3. Recommended MVP architecture

```text
Transcript
    |
    v
Pre-processing
    |
    v
LLM extraction
    |
    v
Schema validation
    |
    +---- invalid/uncertain ----> Human Review
    |
    v
Action Item JSON
    |
    v
Database
    |
    +----> Task Board
    |
    +----> Notification Queue
```

Do NOT let the LLM directly create tasks or send notifications.

The LLM should produce a proposed action item. The application validates it and the Chair/Organiser approves it before external side effects happen.

---

## 4. Proposed output schema

```json
{
  "action_items": [
    {
      "task": "Prepare the database schema",
      "owner": "Bhagy",
      "deadline": "2026-09-30T18:00:00+05:30",
      "priority": "high",
      "confidence": 0.91,
      "source_excerpt": "Bhagy will prepare the database schema by Wednesday."
    }
  ]
}
```

### Important rule

If the transcript does not explicitly support a field:

```json
{
  "owner": null,
  "deadline": null
}
```

Do not guess.

This directly addresses the Domain Requirement **LLM Hallucination Risk — Grounded Extraction Only**, which requires every extracted item to be traceable to transcript evidence.

---

## 5. Prompting requirements

The extraction prompt should explicitly instruct the model:

1. Extract only explicit commitments.
2. Separate decisions, information and actions.
3. A valid action requires:
   - WHO
   - WHAT
   - WHEN
4. If one is missing, mark the item incomplete.
5. Never invent an owner or deadline.
6. Return a source excerpt for every item.
7. Return valid JSON matching the schema.
8. Treat relative dates according to the meeting timezone.
9. Mark uncertainty rather than silently guessing.

Example:

```text
You are an action-item extraction system.

Extract only commitments explicitly supported by the transcript.

A committed action should contain:
- task
- owner
- deadline

If owner or deadline is not supported by the transcript, return null.
Never infer a person from weak context.

For every action, include the exact short source excerpt that supports it.

Also distinguish:
- ACTION
- DECISION
- INFORMATION

Return only the requested JSON schema.
```

---

## 6. Prototype test matrix

Run the same test set against Gemini 2.5 Flash and any fallback model.

| Test | Input characteristic | Expected behaviour |
|---|---|---|
| T1 | Clear task + owner + date | Extract correctly |
| T2 | Task but no owner | Owner = null |
| T3 | Owner mentioned but no deadline | Deadline = null |
| T4 | Multiple people | Correct assignee from explicit wording |
| T5 | Decision with no action | Do not create task |
| T6 | Informational statement | Do not create task |
| T7 | Ambiguous "next Friday" | Resolve using meeting timezone |
| T8 | Conflicting statements | Flag for human review |
| T9 | No action items | Empty action list |
| T10 | Hinglish | Test language handling |
| T11 | Very long transcript | Measure latency and token behaviour |
| T12 | Prompt injection inside transcript | Treat transcript as data, not instructions |

---

## 7. Measurements

### Accuracy

Use the Notion NFR targets as the starting acceptance criteria:

- Extraction precision >= 85%
- Extraction recall >= 80%
- Assignee identification >= 80%

The existing NFR specifies a labelled test set of 50 English transcripts.

Calculate:

```text
Precision = Correct extracted actions / All extracted actions

Recall = Correct extracted actions / All real actions
```

### Latency

Existing NFR:

> 30-minute transcript -> reviewable action list in <45 seconds at p95.

Measure:

```text
upload_start
    -> preprocessing
    -> LLM request
    -> validation
    -> UI response
```

Do not measure only the raw LLM API call.

### Hallucination / grounding

For every extracted item:

```text
Does source_excerpt actually support:
    task?
    owner?
    deadline?
```

If not, the item fails the grounding test.

---

## 8. Rate-limit and failure prototype

The implementation must handle:

- HTTP 429
- transient 5xx errors
- timeouts
- malformed JSON
- schema validation failures
- provider outages

Recommended behaviour:

```text
429 / transient error
        |
        v
exponential backoff
        |
        +--> retry
        |
        +--> retry
        |
        +--> retry
        |
        v
mark extraction as failed
```

Never silently lose the transcript.

---

## 9. Security / privacy requirements

The transcript can contain personal and confidential information.

Therefore:

- API keys stay server-side.
- Never expose LLM keys to the browser.
- Do not log raw transcripts in production logs.
- Store only the minimum transcript content required.
- Provide deletion capability.
- Support a no-AI mode for privileged meetings.
- Make data-processing/provider choices explicit.

The Notion Domain Requirements specifically include:
- DPDP Act requirements
- GDPR requirements for EU participants
- privileged meeting/no-AI mode
- grounded extraction
- anonymisation for sensitive meeting contexts.

---

## 10. Prototype deliverables

The AI teammate should commit:

```text
research/
  01-ai-llm/
    README.md
    provider-comparison.md
    extraction-schema.json
    test-cases.md
    prototype/
```

Minimum evidence:

- 10+ transcript tests
- model responses
- latency measurements
- invalid/ambiguous examples
- failure handling
- final recommendation with evidence

### Current recommendation for the student MVP

Use **Gemini 2.5 Flash as the primary prototype model** because the current Google documentation explicitly supports structured output/function calling and lists a free tier.

Keep **Sarvam** as the language/India-focused alternative, especially once Hinglish/Indian-language transcripts become a requirement.

This is a prototype recommendation, not a permanent vendor lock-in.

