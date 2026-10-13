"""The LangChain call to Gemini (BE-3).

One chain, no agent: prompt -> Gemini with native JSON-schema output -> LLMExtraction.
Sprint 2 Sarvam fallback: `_structured_model().with_fallbacks([sarvam_model])`.
"""

import hashlib
import time
from dataclasses import dataclass

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI

from app.core.config import settings
from app.services.llm.prompt import PROMPT, LLMExtraction


@dataclass
class LLMCall:
    """One Gemini request, logged as one llm_runs row."""

    input_tokens: int | None
    output_tokens: int | None
    latency_ms: int
    payload_hash: str
    error_code: str | None = None


def _structured_model():
    llm = ChatGoogleGenerativeAI(
        model=settings.GEMINI_MODEL,
        api_key=settings.GEMINI_API_KEY,
        temperature=0,
        timeout=60,
        # 3 attempts = at most 2 retries on 408/429/5xx (google-genai's exponential backoff).
        # ponytail: SDK default delays (~1 s, 2 s), not the 2 s / 8 s in the plan; tune if 429s persist.
        max_retries=3,
    )
    return llm.with_structured_output(LLMExtraction, include_raw=True)


def _payload_hash(messages: list[BaseMessage]) -> str:
    return hashlib.sha256("\n".join(str(m.content) for m in messages).encode()).hexdigest()


def extract(prompt_inputs: dict) -> tuple[LLMExtraction | None, list[LLMCall]]:
    """Run the extraction. Returns (result or None, one LLMCall per request made).

    Invalid JSON or a schema mismatch gets exactly one repair request. Network/API errors
    are already retried inside the SDK, so they end the run.
    """
    model = _structured_model()
    messages = PROMPT.format_messages(**prompt_inputs)
    calls: list[LLMCall] = []

    for _ in range(2):  # first try + one repair
        started = time.monotonic()
        call = LLMCall(None, None, 0, _payload_hash(messages))
        calls.append(call)
        try:
            out = model.invoke(messages)
        except Exception as exc:
            call.latency_ms = int((time.monotonic() - started) * 1000)
            call.error_code = type(exc).__name__
            return None, calls
        call.latency_ms = int((time.monotonic() - started) * 1000)

        raw: AIMessage | None = out.get("raw")
        usage = getattr(raw, "usage_metadata", None) or {}
        call.input_tokens = usage.get("input_tokens")
        call.output_tokens = usage.get("output_tokens")

        if out.get("parsed") is not None:
            return out["parsed"], calls

        call.error_code = "schema_mismatch"
        error = str(out.get("parsing_error"))[:500]
        messages = [
            *messages,
            AIMessage(content=str(raw.content) if raw else ""),
            HumanMessage(content=f"Your reply did not match the required JSON schema: {error}\n"
                                 "Reply again with only valid JSON for the schema."),
        ]

    return None, calls
