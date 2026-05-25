# Windows タスクスケジューラに定期ingestを登録するスクリプト
# 管理者権限で実行してください: powershell -ExecutionPolicy Bypass -File schedule_setup.ps1

$taskName    = "PoliticalAnalyst_Ingest"
$batFile     = (Resolve-Path "$PSScriptRoot\run_ingest.bat").Path
$description = "国会議員データ定期取込（毎週月曜 3:00）"

# 既存タスクを削除
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "既存タスクを削除しました"
}

# アクション: bat ファイルを実行
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$batFile`""

# トリガー: 毎週月曜日 03:00
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At "03:00"

# 設定: バッテリー駆動でも実行、ネットワーク必須
$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable

# タスク登録（現在のユーザーで実行）
Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description $description `
    -RunLevel Highest

Write-Host ""
Write-Host "タスクを登録しました: $taskName"
Write-Host "スケジュール: 毎週月曜日 03:00"
Write-Host ""
Write-Host "確認コマンド: Get-ScheduledTask -TaskName '$taskName'"
Write-Host "手動実行:     Start-ScheduledTask -TaskName '$taskName'"
Write-Host "削除:         Unregister-ScheduledTask -TaskName '$taskName' -Confirm:`$false"
