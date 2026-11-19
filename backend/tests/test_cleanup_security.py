from unittest.mock import patch
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from langchain_core.runnables import RunnableLambda

from app.core.deps import get_current_user
from app.services.llm.bedrock import create_structured_model
from app.services.llm.prompt import LLMExtraction


def test_missing_auth_configuration_is_visible():
    with patch("app.core.deps.get_supabase_client", side_effect=RuntimeError("Missing config")):
        with pytest.raises(HTTPException) as error:
            get_current_user(HTTPAuthorizationCredentials(scheme="Bearer",credentials=str(uuid4())))
    assert error.value.status_code == 503


def test_structured_fallback_reports_the_actual_provider(monkeypatch):
    class Model:
        def __init__(self, fails=False):
            self.fails = fails
        def with_structured_output(self, schema, include_raw=False):
            def invoke(_):
                if self.fails:
                    raise RuntimeError("Bedrock unavailable")
                return {"parsed":LLMExtraction(items=[]),"raw":None}
            return RunnableLambda(invoke)
    monkeypatch.setattr("app.services.llm.bedrock.bedrock_is_configured",lambda:True)
    monkeypatch.setattr("app.services.llm.bedrock.gemini_is_configured",lambda:True)
    monkeypatch.setattr("app.services.llm.bedrock._create_bedrock_model",lambda _:Model(True))
    monkeypatch.setattr("app.services.llm.bedrock._create_gemini_model",lambda _:Model())
    result = create_structured_model(LLMExtraction,include_raw=True).invoke("test")
    assert result["provider"] == "gemini"
    assert result["model_version"] and result["parsed"].items == []
