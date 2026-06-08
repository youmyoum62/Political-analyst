"""app.database.wait_for_db のリトライ挙動を検証する。

Supabase pooler への断続的な接続 timeout（GitHub Actions ランナー）への耐性として
追加した指数バックオフ・リトライが、(1) 一時失敗後に成功する (2) 上限回数で諦めて
例外を送出する、の双方を満たすことを確認する。time.sleep はモックして高速化する。
"""

from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.exc import OperationalError

from app import database


def _ok_connection_cm() -> MagicMock:
    """`with engine.connect() as conn: conn.execute(...)` を満たすモック。"""
    cm = MagicMock()
    cm.__enter__.return_value.execute.return_value = None
    cm.__exit__.return_value = False
    return cm


def _op_error() -> OperationalError:
    return OperationalError("SELECT 1", {}, Exception("connection timed out"))


@patch("app.database.time.sleep", return_value=None)
def test_wait_for_db_retries_then_succeeds(_sleep: MagicMock) -> None:
    with patch.object(database.engine, "connect") as mock_connect:
        mock_connect.side_effect = [_op_error(), _op_error(), _ok_connection_cm()]
        database.wait_for_db(max_attempts=5, base_delay=0.01, max_delay=0.01)
        assert mock_connect.call_count == 3


@patch("app.database.time.sleep", return_value=None)
def test_wait_for_db_raises_after_max_attempts(_sleep: MagicMock) -> None:
    with patch.object(database.engine, "connect") as mock_connect:
        mock_connect.side_effect = _op_error()
        with pytest.raises(RuntimeError):
            database.wait_for_db(max_attempts=3, base_delay=0.01, max_delay=0.01)
        assert mock_connect.call_count == 3


@patch("app.database.time.sleep", return_value=None)
def test_wait_for_db_succeeds_first_try(_sleep: MagicMock) -> None:
    with patch.object(database.engine, "connect") as mock_connect:
        mock_connect.side_effect = [_ok_connection_cm()]
        database.wait_for_db()
        assert mock_connect.call_count == 1
        _sleep.assert_not_called()
