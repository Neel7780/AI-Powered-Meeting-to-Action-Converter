"""Offline checks for bearer authentication and actual Bedrock structured output."""

from unittest.mock import MagicMock, patch

import pytest
from botocore.stub import Stubber
from langchain_core.messages import AIMessage
from langchain_core.runnables import RunnableLambda

from app.core.config import settings
from app.services.llm.bedrock import bedrock_is_configured, create_chat_model, create_structured_model
from app.services.llm.chain import extract
from app.services.llm.prompt import LLMExtraction


@pytest.fixture(autouse=True)
def bedrock_settings(monkeypatch):
    monkeypatch.setattr(settings, "AWS_BEARER_TOKEN_BEDROCK", "test-bedrock-token")
    monkeypatch.setattr(settings, "AWS_REGION", "us-east-1")
    monkeypatch.setattr(settings, "BEDROCK_MODEL_ID", "amazon.nova-lite-v1:0")
    monkeypatch.setattr(settings, "LLM_PROVIDER_ALLOWLIST", ["bedrock"])
    monkeypatch.setenv("AWS_EC2_METADATA_DISABLED", "true")


@pytest.mark.parametrize("name, value", [
    ("AWS_BEARER_TOKEN_BEDROCK", ""),
    ("AWS_BEARER_TOKEN_BEDROCK", "  "),
    ("AWS_REGION", ""),
    ("BEDROCK_MODEL_ID", ""),
    ("LLM_PROVIDER_ALLOWLIST", []),
])
def test_missing_configuration_never_creates_an_aws_client(monkeypatch, name, value):
    monkeypatch.setattr(settings, name, value)
    assert not bedrock_is_configured()
    with patch("app.services.llm.bedrock.ChatBedrockConverse") as client:
        with pytest.raises(ValueError, match="must be configured"):
            create_chat_model()
        client.assert_not_called()


def test_bearer_key_and_nova_structured_output_without_iam_credentials():
    model = create_chat_model()
    assert model.bedrock_api_key.get_secret_value() == "test-bedrock-token"
    assert model.client.meta.region_name == "us-east-1"
    assert model.client.meta.config.auth_scheme_preference == "httpBearerAuth"
    assert model.client.meta.config.retries["total_max_attempts"] == 3
    assert model.client.meta.config.read_timeout == 60
    structured = model.with_structured_output(LLMExtraction, include_raw=True)

    # Stub the SDK response, exercising LangChain's real tool schema and parser.
    with Stubber(model.client) as stub:
        stub.add_response("converse", {
            "output": {"message": {"role": "assistant", "content": [{
                "toolUse": {
                    "toolUseId": "extraction-1", "name": "LLMExtraction", "input": {"items": []},
                },
            }]}},
            "stopReason": "tool_use",
            "usage": {"inputTokens": 100, "outputTokens": 10, "totalTokens": 110},
            "metrics": {"latencyMs": 10},
        })
        result = structured.invoke("Extract the action items. No commitments were made.")
        stub.assert_no_pending_responses()

    assert result["parsed"] == LLMExtraction(items=[])
    assert result["parsing_error"] is None
    assert result["raw"].usage_metadata["input_tokens"] == 100


def test_extraction_repairs_a_schema_error_and_keeps_usage():
    raw = AIMessage(content="invalid", usage_metadata={"input_tokens": 100, "output_tokens": 10, "total_tokens": 110})
    model = MagicMock()
    model.invoke.side_effect = [
        {"raw": raw, "parsed": None, "parsing_error": ValueError("invalid schema")},
        {"raw": raw, "parsed": LLMExtraction(items=[]), "parsing_error": None},
    ]
    with patch("app.services.llm.chain._structured_model", return_value=model):
        result, calls = extract({
            "title": "Sync", "meeting_date": "2026-11-03", "weekday": "Tuesday",
            "timezone": "Asia/Kolkata", "roster": "", "transcript": "No commitments.",
        })
    assert result == LLMExtraction(items=[])
    assert len(calls) == 2
    assert calls[0].error_code == "schema_mismatch" and calls[1].error_code is None
    assert all(call.input_tokens == 100 for call in calls)


def test_extraction_does_not_repair_an_api_error():
    model = MagicMock()
    model.invoke.side_effect = RuntimeError("upstream unavailable")
    with patch("app.services.llm.chain._structured_model", return_value=model):
        result, calls = extract({
            "title": "Sync", "meeting_date": "2026-11-03", "weekday": "Tuesday",
            "timezone": "Asia/Kolkata", "roster": "", "transcript": "No commitments.",
        })
    assert result is None and len(calls) == 1
    assert calls[0].error_code == "RuntimeError"
    model.invoke.assert_called_once()


def test_structured_call_falls_back_to_gemini_when_bedrock_raises(monkeypatch):
    class StubModel:
        def __init__(self, invoke):
            self.invoke = invoke

        def with_structured_output(self, schema, include_raw=False):
            return RunnableLambda(self.invoke)

    monkeypatch.setattr("app.services.llm.bedrock.bedrock_is_configured", lambda: True)
    monkeypatch.setattr("app.services.llm.bedrock.gemini_is_configured", lambda: True)
    monkeypatch.setattr(
        "app.services.llm.bedrock._create_bedrock_model",
        lambda temperature: StubModel(lambda _: (_ for _ in ()).throw(RuntimeError("Bedrock unavailable"))),
    )
    monkeypatch.setattr(
        "app.services.llm.bedrock._create_gemini_model",
        lambda temperature: StubModel(lambda _: LLMExtraction(items=[])),
    )

    result = create_structured_model(LLMExtraction).invoke("extract")

    assert result == LLMExtraction(items=[])


def test_chat_call_falls_back_to_gemini_when_bedrock_raises(monkeypatch):
    def unavailable(_):
        raise RuntimeError("Bedrock unavailable")

    monkeypatch.setattr("app.services.llm.bedrock.bedrock_is_configured", lambda: True)
    monkeypatch.setattr("app.services.llm.bedrock.gemini_is_configured", lambda: True)
    monkeypatch.setattr(
        "app.services.llm.bedrock._create_bedrock_model",
        lambda temperature: RunnableLambda(unavailable),
    )
    monkeypatch.setattr(
        "app.services.llm.bedrock._create_gemini_model",
        lambda temperature: RunnableLambda(lambda _: "Gemini answer"),
    )

    result = create_chat_model().invoke("answer")

    assert result == "Gemini answer"
