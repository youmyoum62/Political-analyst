"""
発言レコードのフィルタ（純粋関数）。

- is_person_name: speaker が議員の人名らしいか。会議録メタ（『会議録情報』）や
  委員会名などの非人名を弾き、ゴミ議員レコードの生成を防ぐ。
- is_procedural_speech: 議事進行の定型アナウンス（開会・散会・休憩等）か。
  活動量・品質評価の母数から除外するために使う。

進行文の網羅性は実会議録テキストで継続的に追加検証する前提（保守的に開始）。
"""

from __future__ import annotations

# 非人名スピーカーの既知パターン（会議録メタ・見出し）
_NON_PERSON_SUBSTRINGS = ("会議録情報",)

# 人名がこれらで終わる場合は会議体名とみなして弾く
_NON_PERSON_SUFFIXES = (
    "会議",
    "本会議",
    "委員会",
    "小委員会",
    "分科会",
    "審査会",
    "調査会",
    "協議会",
)


def is_person_name(speaker: str) -> bool:
    """speaker が議員の人名らしいか判定する。"""
    s = (speaker or "").strip()
    if not s:
        return False
    if any(sub in s for sub in _NON_PERSON_SUBSTRINGS):
        return False
    if s.endswith(_NON_PERSON_SUFFIXES):
        return False
    # 人名としては不自然に長い（肩書き混入・名簿テキスト等）
    if len(s) > 15:
        return False
    return True


# 議事進行の定型アナウンス（冒頭に出る前提で照合）
_PROCEDURAL_PATTERNS = (
    "これより会議を開きます",
    "本日の会議を開きます",
    "会議を開きます",
    "を開会いたします",
    "を開議いたします",
    "これより休憩",
    "休憩いたします",
    "休憩前に引き続き",
    "これにて散会",
    "本日はこれにて散会",
    "散会いたします",
    "閉会いたします",
)


def is_procedural_speech(text: str) -> bool:
    """議事進行の定型アナウンス（開会・散会・休憩等）かどうか。"""
    head = (text or "").strip()[:80]
    if not head:
        return False
    return any(p in head for p in _PROCEDURAL_PATTERNS)
