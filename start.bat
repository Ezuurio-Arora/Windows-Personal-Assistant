@echo off
title Personal Assistant
echo ======================================================
echo   Launching Personal Assistant
echo   Google Gemini Aesthetic Desktop App ^& Worldwide Hub
echo ======================================================
echo.

cd /d "%~dp0"

echo Starting Personal Assistant Hub Server...
start "" /b node server/index.js

timeout /t 2 /nobreak >nul

echo Starting Desktop Application...
npm run start:app

if %ERRORLEVEL% NEQ 0 (
  echo Launching in default browser at http://localhost:42000...
  start http://localhost:42000
)
