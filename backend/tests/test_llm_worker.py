"""
app/scoring/llm_worker.py の provider 経由リファクタの単体テスト。

_call_llm が OpenAIProvider.complete に正しいパラメータで委譲すること、
及び未設定時に元の RuntimeError メッセージを維持していることを検証する。
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from app.scoring import llm_worker


class TestCallLlm:
    def test_delegates_to_openai_provider_with_expected_params(self, monkeypatch):
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
        monkeypatch.delenv("LLM_MODEL", raising=False)
        messages = [
            {"role": "system", "content": "採点してください"},
            {"role": "user", "content": "発言内容です"},
        ]

        with patch.object(
            llm_worker, "OpenAIProvider"
        ) as mock_provider_cls:
            mock_provider = mock_provider_cls.return_value
            mock_provider.complete = AsyncMock(
                return_value='{"score": 80, "confidence": 0.9, "reason": "妥当"}'
            )

            result = asyncio.run(llm_worker._call_llm(messages))

        mock_provider_cls.assert_called_once_with(api_key="sk-test")
        _, kwargs = mock_provider.complete.call_args
        assert kwargs["user"] == "発言内容です"
        assert kwargs["system"] == "採点してください"
        assert kwargs["model"] == "gpt-4o-mini"
        assert kwargs["temperature"] == 0.1
        assert kwargs["max_tokens"] == 256
        assert kwargs["json_mode"] is True
        assert result == {"score": 80, "confidence": 0.9, "reason": "妥当"}

    def test_respects_llm_model_env_override(self, monkeypatch):
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
        monkeypatch.setenv("LLM_MODEL", "gpt-4.1-mini")
        messages = [{"role": "user", "content": "x"}]

        with patch.object(llm_worker, "OpenAIProvider") as mock_provider_cls:
            mock_provider = mock_provider_cls.return_value
            mock_provider.complete = AsyncMock(return_value="{}")
            asyncio.run(llm_worker._call_llm(messages))

        _, kwargs = mock_provider.complete.call_args
        assert kwargs["model"] == "gpt-4.1-mini"
        assert kwargs["system"] is None

    def test_missing_api_key_raises_runtime_error(self, monkeypatch):
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        messages = [{"role": "user", "content": "x"}]
        with pytest.raises(RuntimeError, match="OPENAI_API_KEY not set"):
            asyncio.run(llm_worker._call_llm(messages))
