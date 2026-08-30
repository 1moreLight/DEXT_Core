@echo off
setlocal
set "DEXT_SCRIPT_DIR=%~dp0"

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%DEXT_SCRIPT_DIR%start.ps1"
set "DEXT_EXIT_CODE=%ERRORLEVEL%"

if not "%DEXT_EXIT_CODE%"=="0" (
    echo.
    echo Dext startup failed with exit code %DEXT_EXIT_CODE%.
    pause
)

exit /b %DEXT_EXIT_CODE%
