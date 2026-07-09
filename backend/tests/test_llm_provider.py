"""
LLM プロバイダ抽象化層の単体テスト。

OpenAIProvider / AnthropicProvider が実際の SDK に渡すペイロードが、
リファクタ前の app/scoring/llm_worker.py・scripts/generate_profiles.py の
呼び出し形（messages 構造・パラメータ有無）と一致することを検証する。
実 API へは接続せず、SDK クライアントをモックする。
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from app.llm.provider import AnthropicProvider, OpenAIProvider


class TestOpenAIProvider:
    def test_system_and_json_mode_build_expected_payload(self):
        async def _run():
            provider = OpenAIProvider(api_key="sk-test")
            fake_response = MagicMock(choices=[MagicMock(message=MagicMock(content="hello"))])

            with patch("openai.AsyncOpenAI") as mock_client_cls:
                mock_client = mock_client_cls.return_value
                mock_client.chat.completions.create = AsyncMock(return_value=fake_response)

                result = await provider.complete(
                    user="発言内容",
                    system="システム指示",
                    model="gpt-4o-mini",
                    temperature=0.1,
                    max_tokens=256,
                    json_mode=True,
                )

            assert result == "hello"
            mock_client_cls.assert_called_once_with(api_key="sk-test")
            _, kwargs = mock_client.chat.completions.create.call_args
            assert kwargs["model"] == "gpt-4o-mini"
            assert kwargs["messages"] == [
                {"role": "system", "content": "システム指示"},
                {"role": "user", "content": "発言内容"},
            ]
            assert kwargs["temperature"] == 0.1
            assert kwargs["max_tokens"] == 256
            assert kwargs["response_format"] == {"type": "json_object"}

        asyncio.run(_run())

    def test_without_system_or_json_mode_omits_optional_params(self):
        async def _run():
            provider = OpenAIProvider(api_key="sk-test")
            fake_response = MagicMock(choices=[MagicMock(message=MagicMock(content="plain"))])

            with patch("openai.AsyncOpenAI") as mock_client_cls:
                mock_client = mock_client_cls.return_value
                mock_client.chat.completions.create = AsyncMock(return_value=fake_response)

                result = await provider.complete(user="prompt", model="gpt-4o-mini", max_tokens=512)

            assert result == "plain"
            _, kwargs = mock_client.chat.completions.create.call_args
            assert kwargs["messages"] == [{"role": "user", "content": "prompt"}]
            assert "temperature" not in kwargs
            assert "response_format" not in kwargs

        asyncio.run(_run())

    def test_empty_content_returns_empty_string(self):
        async def _run():
            provider = OpenAIProvider(api_key="sk-test")
            fake_response = MagicMock(choices=[MagicMock(message=MagicMock(content=None))])
            with patch("openai.AsyncOpenAI") as mock_client_cls:
                mock_client = mock_client_cls.return_value
                mock_client.chat.completions.create = AsyncMock(return_value=fake_response)
                result = await provider.complete(user="prompt", model="gpt-4o-mini", max_tokens=256)
            assert result == ""

        asyncio.run(_run())


class TestAnthropicProvider:
    def test_default_call_matches_generate_profiles_shape(self):
        async def _run():
            provider = AnthropicProvider(api_key="ak-test")
            fake_message = MagicMock(content=[MagicMock(text="anthropic応答")])

            with patch("anthropic.AsyncAnthropic") as mock_client_cls:
                mock_client = mock_client_cls.return_value
                mock_client.messages.create = AsyncMock(return_value=fake_message)

                result = await provider.complete(
                    user="プロンプト", model="claude-haiku-4-5-20251001", max_tokens=512
                )

            assert result == "anthropic応答"
            mock_client_cls.assert_called_once_with(api_key="ak-test")
            _, kwargs = mock_client.messages.create.call_args
            assert kwargs["model"] == "claude-haiku-4-5-20251001"
            assert kwargs["max_tokens"] == 512
            assert kwargs["messages"] == [{"role": "user", "content": "プロンプト"}]
            # generate_profiles.py は system/temperature を渡さないため、含まれてはいけない
            assert "system" not in kwargs
            assert "temperature" not in kwargs

        asyncio.run(_run())

    def test_system_and_temperature_are_passed_when_given(self):
        async def _run():
            provider = AnthropicProvider(api_key="ak-test")
            fake_message = MagicMock(content=[MagicMock(text="ok")])
            with patch("anthropic.AsyncAnthropic") as mock_client_cls:
                mock_client = mock_client_cls.return_value
                mock_client.messages.create = AsyncMock(return_value=fake_message)
                await provider.complete(
                    user="u", system="s", model="m", max_tokens=10, temperature=0.5
                )
            _, kwargs = mock_client.messages.create.call_args
            assert kwargs["system"] == "s"
            assert kwargs["temperature"] == 0.5

        asyncio.run(_run())
