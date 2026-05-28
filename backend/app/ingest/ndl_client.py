"""
国会会議録検索システム API クライアント
https://kokkai.ndl.go.jp/api.html
"""
from __future__ import annotations

import hashlib
import logging
import time
from dataclasses import dataclass
from datetime import date
from typing import Iterator

import requests

log = logging.getLogger(__name__)

NDL_BASE = "https://kokkai.ndl.go.jp/api"
_PAGE_SIZE = 100

# 議員以外のスピーカーロールを除外
_SKIP_ROLES = {
    "政府参考人", "参考人", "公述人", "証人",
    "内閣総理大臣", "国務大臣",  # 大臣は is_minister フラグで判定
}

# 発言が質問か判断する会議名キーワード
_QUESTION_KEYWORDS = ("質疑", "質問", "一般質問", "代表質問", "緊急質問")


@dataclass
class SpeechRecord:
    speech_id: str
    date_str: str          # YYYY-MM-DD
    speaker: str
    speaker_group: str     # 会派/政党名
    name_of_house: str     # 衆議院 | 参議院
    name_of_meeting: str
    speaker_role: str
    speech_text: str
    url: str
    is_minister: bool

    @property
    def activity_type(self) -> str:
        if any(kw in self.name_of_meeting for kw in _QUESTION_KEYWORDS):
            return "question"
        return "speech"

    @property
    def source_hash(self) -> str:
        return hashlib.sha256(self.speech_id.encode()).hexdigest()[:64]

    @property
    def session_date(self) -> date:
        return date.fromisoformat(self.date_str)


def _parse_record(raw: dict) -> SpeechRecord | None:
    speaker = (raw.get("speaker") or "").strip()
    if not speaker:
        return None
    role = (raw.get("speakerRole") or "").strip()
    # 議員以外を除外（大臣は is_minister フラグがあるので残す）
    if any(skip in role for skip in _SKIP_ROLES) and not raw.get("isMinister"):
        return None
    return SpeechRecord(
        speech_id=raw.get("speechID", ""),
        date_str=raw.get("date", ""),
        speaker=speaker,
        speaker_group=(raw.get("speakerGroup") or "").strip(),
        name_of_house=(raw.get("nameOfHouse") or "").strip(),
        name_of_meeting=(raw.get("nameOfMeeting") or "").strip(),
        speaker_role=role,
        speech_text=(raw.get("speech") or "")[:3000],
        url=(raw.get("url") or ""),
        is_minister=bool(raw.get("isMinister")),
    )


class NdlClient:
    def __init__(self, rate_sleep: float = 0.6):
        self._sleep = rate_sleep
        self._session = requests.Session()
        self._session.headers["Accept"] = "application/json"

    def iter_speeches(
        self,
        from_date: date,
        until_date: date,
        name_of_house: str | None = None,
        limit: int = 1000,
    ) -> Iterator[SpeechRecord]:
        """指定期間・院の発言レコードをページング取得する。"""
        start = 1
        fetched = 0
        while fetched < limit:
            params: dict = {
                "from": from_date.isoformat(),
                "until": until_date.isoformat(),
                "recordPacking": "json",
                "maximumRecords": min(_PAGE_SIZE, limit - fetched),
                "startRecord": start,
            }
            if name_of_house:
                params["nameOfHouse"] = name_of_house

            time.sleep(self._sleep)
            try:
                resp = self._session.get(f"{NDL_BASE}/speech", params=params, timeout=30)
                resp.raise_for_status()
                data = resp.json()
            except Exception as exc:
                log.error("NDL API error: %s", exc)
                break

            records = data.get("speechRecord") or []
            for raw in records:
                rec = _parse_record(raw)
                if rec:
                    fetched += 1
                    yield rec

            total = int(data.get("numberOfRecords") or 0)
            if start + _PAGE_SIZE > total:
                break
            start += _PAGE_SIZE
