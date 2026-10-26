@echo off
title Nilesh - MyPersonalAI (Developer HMR Mode)
color 0a

echo ===================================================
echo             Nilesh — MyPersonalAI
echo            Developer Live HMR Mode
echo ===================================================
echo.

set ROOT=%~dp0
cd /d "%ROOT%"

:: Start Backend
start "Nilesh - Backend" /min cmd /c "cd /d "%ROOT%backend" && node --experimental-strip-types src/index.ts"

timeout /t 2 /nobreak >nul

:: Start Vite dev server
start "Nilesh - Frontend Dev" /min cmd /c "cd /d "%ROOT%frontend" && npx vite --port 5173"

timeout /t 3 /nobreak >nul

start http://localhost:5173
