"""
LLM プロバイダ抽象化レイヤー。

背景: これまで発言品質のスコア評価 (app/scoring/llm_worker.py) は OpenAI、
議員プロフィール生成 (scripts/generate_profiles.py) は Anthropic優先/OpenAIフォールバック、
と実装が分裂しており、SDK 呼び出しのコードが2箇所に重複していた。

このモジュールは「1回の補完 (completion) をどう呼ぶか」という transport 層のみを
共通インターフェース `LLMProvider.complete()` に切り出す。

- どのプロバイダを・どの優先順位で・利用可能かどうかを判定して選ぶか、という
  ビジネスロジック（APIキーの有無、モデル名、temperature、retry、JSONパース方法）は
  引き続き各呼び出し元 (llm_worker.py / generate_profiles.py) が持つ。
  ここで一本化すると呼び出し元ごとに異なる既存の優先順位・既定挙動を壊すリスクがあるため、
  意図的に薄い抽象化に留めている。
"""

from __future__ import annotations

import abc
from typing import Any


class LLMProvider(abc.ABC):
    """LLM への単発の補完呼び出しを行う抽象インターフェース。"""

    @abc.abstractmethod
    async def complete(
        self,
        *,
        user: str,
        model: str,
        max_tokens: int,
        system: str | None = None,
        temperature: float | None = None,
        json_mode: bool = False,
        effort: str | None = None,
    ) -> str:
        """
        1回の補完を実行し、応答テキストを返す。

        - system: システムプロンプト。None なら付与しない。
        - temperature: None なら明示的にパラメータを渡さず、API 既定値に委ねる。
        - json_mode: True なら JSON 応答を強制するオプションを有効にする
          （プロバイダが対応していなければ無視してよい）。
        - effort: 思考量のヒント（low/medium/high/xhigh/max）。None なら渡さない。
          対応していないプロバイダ・モデルでは呼び出し元が None にする責任を持つ。

        API エラーや設定不備は例外として送出する（リトライ判断は呼び出し元が行う）。
        """
        raise NotImplementedError


class OpenAIProvider(LLMProvider):
    """OpenAI Chat Completions API 経由の実装。"""

    def __init__(self, api_key: str) -> None:
        self._api_key = api_key

    async def complete(
        self,
        *,
        user: str,
        model: str,
        max_tokens: int,
        system: str | None = None,
        temperature: float | None = None,
        json_mode: bool = False,
        effort: str | None = None,
    ) -> str:
        # effort は Anthropic 固有のため無視する。
        del effort
        import openai

        messages: list[dict[str, str]] = []
        if system is not None:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": user})

        kwargs: dict[str, Any] = {"model": model, "messages": messages, "max_tokens": max_tokens}
        if temperature is not None:
            kwargs["temperature"] = temperature
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}

        client = openai.AsyncOpenAI(api_key=self._api_key)
        resp = await client.chat.completions.create(**kwargs)
        return resp.choices[0].message.content or ""


class AnthropicProvider(LLMProvider):
    """Anthropic Messages API 経由の実装。"""

    def __init__(self, api_key: str) -> None:
        self._api_key = api_key

    async def complete(
        self,
        *,
        user: str,
        model: str,
        max_tokens: int,
        system: str | None = None,
        temperature: float | None = None,
        json_mode: bool = False,
        effort: str | None = None,
    ) -> str:
        # Anthropic Messages API に OpenAI の response_format 相当の JSON 強制モードは
        # ないため json_mode は無視する（呼び出し元がプロンプトと解析側で担保する）。
        del json_mode
        import anthropic

        kwargs: dict[str, Any] = {
            "model": model,
            "max_tokens": max_tokens,
            "messages": [{"role": "user", "content": user}],
        }
        if system is not None:
            kwargs["system"] = system
        # temperature は Claude Opus 5 / Opus 4.7 以降では 400 になるため、
        # 呼び出し元が None を渡した場合は一切送らない。
        if temperature is not None:
            kwargs["temperature"] = temperature
        if effort is not None:
            kwargs["output_config"] = {"effort": effort}

        client = anthropic.AsyncAnthropic(api_key=self._api_key)
        message = await client.messages.create(**kwargs)

        # 思考が有効なモデル（Opus 5 等は既定で ON）では content の先頭に thinking
        # ブロックが入る。content[0] 決め打ちだと text 属性が無く落ちるため、
        # text ブロックだけを取り出して連結する。
        texts = [b.text for b in message.content if getattr(b, "type", None) == "text"]
        return "".join(texts)
