@echo off
setlocal EnableExtensions

rem Vela portable launcher - unblocks files in this folder and starts Vela.exe
rem No registry changes, no security feature changes, no admin rights required.

set "VELA_HOME=%~dp0"
pushd "%VELA_HOME%" >nul 2>&1
if errorlevel 1 (
  echo [Error] Failed to access launcher folder: "%VELA_HOME%"
  exit /b 1
)

if not exist "%VELA_HOME%Vela.exe" (
  echo [Error] Vela.exe not found next to this launcher.
  echo Expected: "%VELA_HOME%Vela.exe"
  popd >nul 2>&1
  exit /b 1
)

echo Unblocking files in "%VELA_HOME%"...
powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "Get-ChildItem -LiteralPath  -Recurse -File -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue"

echo Starting Vela...
start "" "%VELA_HOME%Vela.exe"
if errorlevel 1 (
  echo [Error] Failed to start Vela.exe.
  popd >nul 2>&1
  exit /b 1
)

popd >nul 2>&1
endlocal