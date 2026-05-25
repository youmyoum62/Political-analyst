@echo off
REM 国会議員データ定期更新スクリプト
REM Windows タスクスケジューラから呼び出す

set SCRIPT_DIR=%~dp0
set BACKEND_DIR=%SCRIPT_DIR%..
set LOG_FILE=%BACKEND_DIR%\logs\ingest_%date:~0,4%%date:~5,2%%date:~8,2%.log

REM logsディレクトリが存在しない場合は作成
if not exist "%BACKEND_DIR%\logs" mkdir "%BACKEND_DIR%\logs"

echo [%date% %time%] ingest開始 >> "%LOG_FILE%"

cd /d "%BACKEND_DIR%"
set PYTHONUTF8=1
python -m scripts.ingest --mode all --days 90 >> "%LOG_FILE%" 2>&1

if %ERRORLEVEL% == 0 (
    echo [%date% %time%] ingest完了 (成功) >> "%LOG_FILE%"
) else (
    echo [%date% %time%] ingest失敗 (終了コード: %ERRORLEVEL%) >> "%LOG_FILE%"
)
