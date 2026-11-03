"""Shared LangChain Bedrock client for all backend AI features."""

from botocore.config import Config
from langchain_aws import ChatBedrockConverse

from app.core.config import settings


def bedrock_is_configured() -> bool:
    return bool(
        "bedrock" in settings.LLM_PROVIDER_ALLOWLIST
        and settings.AWS_BEARER_TOKEN_BEDROCK.strip()
        and settings.AWS_REGION.strip()
        and settings.BEDROCK_MODEL_ID.strip()
    )


def create_chat_model(temperature: float = 0) -> ChatBedrockConverse:
    if not bedrock_is_configured():
        raise ValueError("Amazon Bedrock API key, region, model and provider allow-list must be configured")
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
