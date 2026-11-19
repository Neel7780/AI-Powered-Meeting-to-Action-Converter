"""Offline tests never contact model, email, or database services by accident."""
import os

import httpx
import pytest


@pytest.fixture(autouse=True)
def no_unrequested_http(monkeypatch):
    if os.getenv("RUN_LIVE_BEDROCK_TESTS") == "1" or os.getenv("RUN_LIVE_SUPABASE_TESTS") == "1":
        return
    def blocked(*args, **kwargs):
        raise RuntimeError("External HTTP is disabled in offline tests")
    monkeypatch.setattr(httpx.HTTPTransport,"handle_request",blocked)
