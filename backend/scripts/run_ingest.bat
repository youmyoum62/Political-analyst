@echo off
REM 国会議員データ定期更新スクリプト v3
REM Windows タスクスケジューラから呼び出す

set SCRIPT_DIR=%~dp0
set BACKEND_DIR=%SCRIPT_DIR%..
set LOG_DIR=%BACKEND_DIR%\logs
set LOG_FILE=%LOG_DIR%\ingest_%date:~0,4%%date:~5,2%%date:~8,2%.log

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

echo [%date% %time%] ingest開始 >> "%LOG_FILE%"

cd /d "%BACKEND_DIR%"
set PYTHONUTF8=1

python -m scripts.ingest --days 90 >> "%LOG_FILE%" 2>&1

if %ERRORLEVEL% == 0 (
    echo [%date% %time%] ingest完了 (成功) >> "%LOG_FILE%"
) else (
    echo [%date% %time%] ingest失敗 (終了コード: %ERRORLEVEL%) >> "%LOG_FILE%"
)
