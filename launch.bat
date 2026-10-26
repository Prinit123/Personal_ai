@echo off
title Nilesh - MyPersonalAI
color 0b

echo ===================================================
echo             Nilesh -- MyPersonalAI
echo         AI Assistant ^& Coding Mentor
echo ===================================================
echo.

set ROOT=%~dp0
cd /d "%ROOT%"

:: Ensure required directories exist
if not exist "%ROOT%data"            mkdir "%ROOT%data"
if not exist "%ROOT%projects"        mkdir "%ROOT%projects"
if not exist "%ROOT%knowledge\docs"  mkdir "%ROOT%knowledge\docs"
if not exist "%ROOT%data\uploads"    mkdir "%ROOT%data\uploads"

:: Create .env from template if missing
if not exist "%ROOT%.env" (
    echo [INFO] First run: creating .env from template...
    copy "%ROOT%.env.example" "%ROOT%.env" >nul
    echo [INFO] Done. You can add your Gemini API key in .env later.
)

:: ── Require Node.js ──────────────────────────────────────────────────────────
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Node.js is not installed on this computer.
    echo         Install Node.js 20 or newer from: https://nodejs.org
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -e "process.stdout.write(process.version)"') do set NODE_VER=%%v
echo [INFO] Node.js detected: %NODE_VER%

:: ── Install backend dependencies if node_modules is missing ──────────────────
if not exist "%ROOT%backend\node_modules" (
    echo [INFO] First run: installing backend dependencies (takes ~1 minute)...
    cd /d "%ROOT%backend"
    call npm install --prefer-offline --no-audit --loglevel=error
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed. Check your internet connection.
        pause
        exit /b 1
    )
    cd /d "%ROOT%"
    echo [INFO] Backend dependencies installed.
)

:: ── Build frontend dist if missing ───────────────────────────────────────────
if not exist "%ROOT%frontend\dist\index.html" (
    echo [INFO] Building frontend for the first time (takes ~30 seconds)...
    if not exist "%ROOT%frontend\node_modules" (
        cd /d "%ROOT%frontend"
        call npm install --prefer-offline --no-audit --loglevel=error
        if %errorlevel% neq 0 (
            echo [ERROR] Frontend npm install failed.
            pause
            exit /b 1
        )
        cd /d "%ROOT%"
    )
    cd /d "%ROOT%frontend"
    call npm run build
    if %errorlevel% neq 0 (
        echo [ERROR] Frontend build failed.
        pause
        exit /b 1
    )
    cd /d "%ROOT%"
    echo [INFO] Frontend built successfully.
)

:: ── Start backend (serves both API and built frontend on port 3001) ───────────
netstat -ano | findstr :3001 | findstr LISTENING >nul 2>nul
if %errorlevel% neq 0 (
    echo [INFO] Starting Nilesh on http://localhost:3001 ...
    start "Nilesh - Server" /min cmd /c "cd /d "%ROOT%backend" && node --max-old-space-size=384 --experimental-strip-types src/index.ts"
    echo [INFO] Waiting for server to start...
    timeout /t 4 /nobreak >nul
) else (
    echo [INFO] Nilesh is already running on http://localhost:3001 (Active)
)

:: ── Verify server started ─────────────────────────────────────────────────────
netstat -ano | findstr :3001 | findstr LISTENING >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo [WARNING] Server may still be starting. Opening browser in 3 seconds...
    timeout /t 3 /nobreak >nul
)

:: ── Open Nilesh in browser ────────────────────────────────────────────────────
echo [INFO] Opening Nilesh in your browser...
start http://localhost:3001

echo.
echo ===================================================
echo  Nilesh is Running!
echo.
echo  Open in browser: http://localhost:3001
echo.
echo  AI Providers:
echo   * Gemini (online):  Zero RAM usage
echo   * Ollama (offline): ~1 GB RAM for qwen2.5-coder:1.5b
echo.
echo  Keep this window open while using Nilesh.
echo  Close this window to shut down Nilesh.
echo ===================================================
echo.
pause

:: ── Cleanup: stop the backend when user closes this window ───────────────────
echo [INFO] Shutting down Nilesh...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do (
    taskkill /PID %%p /F >nul 2>nul
)
echo [INFO] Nilesh stopped. Goodbye!
timeout /t 2 /nobreak >nul
