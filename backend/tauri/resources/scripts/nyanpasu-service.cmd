@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "PS1=%SCRIPT_DIR%nyanpasu-service.ps1"

if not exist "%PS1%" (
  echo [nyanpasu-service.cmd] missing script: %PS1%
  exit /b 2
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS1%" %*
exit /b %errorlevel%
