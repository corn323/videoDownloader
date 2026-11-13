@echo off
chcp 65001 >nul
setlocal
rem ============================================================
rem  Vela 可攜版啟動工具
rem  用途：解除從網路下載的檔案封鎖，然後啟動 Vela.exe。
rem  本批次檔只會執行 Unblock-File，不會修改登錄檔、
rem  不會關閉防毒或系統安全功能，也不會要求系統管理員權限。
rem
rem  注意：Windows Smart App Control 或 Device Guard 可能
rem  完全封鎖未簽章程式。若 Vela.exe 仍無法執行，請不要
rem  關閉系統保護；可改用已簽章版本，或自行評估風險後再執行。
rem ============================================================
set "VELA_HOME=%~dp0"

if not exist "%VELA_HOME%Vela.exe" (
  echo [錯誤] 找不到 Vela.exe，請確認本檔案與 Vela.exe 放在同一資料夾。
  pause
  exit /b 1
)

echo 正在解除檔案封鎖（只處理此資料夾）...
powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "Get-ChildItem -LiteralPath $env:VELA_HOME -Recurse -File -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue"

echo 正在啟動 Vela...
start "" "%VELA_HOME%Vela.exe"
endlocal
