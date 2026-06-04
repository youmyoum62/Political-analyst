"""
発言レコードのハッシュ生成（インジェスト経路間で統一）。

pipeline.py（admin/定期実行経路）と scripts/ingest.py（手動経路）が
同一の source_hash を生成するよう、両者をこの関数に統一して二重登録を防ぐ。
基準は NDL の speechID（発言ごとに一意）。
"""

from __future__ import annotations

import hashlib


def speech_hash(speech_id: str) -> str:
    """NDL の speechID から決定的な source_hash（sha256 先頭64桁）を生成する。"""
    return hashlib.sha256(speech_id.encode()).hexdigest()[:64]
