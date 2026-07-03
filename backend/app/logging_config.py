"""
構造化ログ設定。

middleware.py の 'api.access' ロガーが extra で渡すフィールド
（trace_id / method / path / status / elapsed_ms など）を JSON 1行で
stdout に出力する。これまではハンドラ/レベル設定が無く独自ロガーの INFO が
出力されていなかったため、設計が掲げる構造化ログが本番で機能していなかった。
Render は stdout を収集するため、これでリクエスト・エラーログが構造化される。
"""

import json
import logging
import os
import sys

# LogRecord の標準属性（これら以外を extra とみなして JSON に含める）
_STD_ATTRS = {
    "name", "msg", "args", "levelname", "levelno", "pathname", "filename",
    "module", "exc_info", "exc_text", "stack_info", "lineno", "funcName",
    "created", "msecs", "relativeCreated", "thread", "threadName",
    "processName", "process", "taskName",
}


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for key, value in record.__dict__.items():
            if key not in _STD_ATTRS and not key.startswith("_"):
                payload[key] = value
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False, default=str)


_configured = False


def configure_logging(level: str | None = None) -> None:
    """root ロガーに JSON 整形の stdout ハンドラを取り付ける（多重設定を防止）。"""
    global _configured
    if _configured:
        return
    log_level = (level or os.getenv("LOG_LEVEL") or "INFO").upper()
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(log_level)
    _configured = True
