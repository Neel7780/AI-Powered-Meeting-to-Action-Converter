"""Shared LangChain Bedrock client for all backend AI features."""

from botocore.config import Config
from langchain_aws import ChatBedrockConverse
from langchain_core.runnables import RunnableLambda
from pydantic import BaseModel

from app.core.config import settings


def bedrock_is_configured() -> bool:
    return bool(
        "bedrock" in settings.LLM_PROVIDER_ALLOWLIST
        and settings.AWS_BEARER_TOKEN_BEDROCK.strip()
        and settings.AWS_REGION.strip()
        and settings.BEDROCK_MODEL_ID.strip()
    )


def gemini_is_configured() -> bool:
    return bool(
        "gemini" in settings.LLM_PROVIDER_ALLOWLIST
        and settings.GEMINI_API_KEY.strip()
        and settings.GEMINI_MODEL.strip()
    )


def llm_is_configured() -> bool:
    return bedrock_is_configured() or gemini_is_configured()


def _create_bedrock_model(temperature: float):
    return ChatBedrockConverse(
        model_id=settings.BEDROCK_MODEL_ID,
        region_name=settings.AWS_REGION,
        api_key=settings.AWS_BEARER_TOKEN_BEDROCK,
        temperature=temperature,
        max_tokens=4096,
        config=Config(
            connect_timeout=10,
            read_timeout=60,
            retries={"mode": "standard", "total_max_attempts": 3},
        ),
    )


def _create_gemini_model(temperature: float):
    from langchain_google_genai import ChatGoogleGenerativeAI

    return ChatGoogleGenerativeAI(
        model=settings.GEMINI_MODEL,
        google_api_key=settings.GEMINI_API_KEY,
        temperature=temperature,
        timeout=60,
        max_retries=2,
    )


def create_chat_model(temperature: float = 0):
    """Use Bedrock first, with Gemini as the configured provider fallback."""
    if bedrock_is_configured():
        model = _create_bedrock_model(temperature)
        return model.with_fallbacks([_create_gemini_model(temperature)]) if gemini_is_configured() else model
    if gemini_is_configured():
        return _create_gemini_model(temperature)
    raise ValueError("An allowed LLM provider must be configured")


def create_structured_model(schema: type[BaseModel], temperature: float = 0, include_raw: bool = False):
    """Apply structured output before composing provider fallbacks."""
    models = []
    if bedrock_is_configured():
        models.append(_structured(_create_bedrock_model(temperature), schema, include_raw))
    if gemini_is_configured():
        models.append(_structured(_create_gemini_model(temperature), schema, include_raw))
    if not models:
        raise ValueError("An allowed LLM provider must be configured")
    return models[0].with_fallbacks(models[1:]) if len(models) > 1 else models[0]


def _structured(model, schema: type[BaseModel], include_raw: bool):
    structured = model.with_structured_output(schema, include_raw=include_raw)
    if not include_raw:
        return structured

    def require_parsed(result):
        if result.get("parsed") is None:
            raise ValueError("Structured response did not match the required schema")
        return result

    return structured | RunnableLambda(require_parsed)
