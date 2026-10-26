# launch.ps1 — MyPersonalAI Launcher
# Usage: powershell -ExecutionPolicy Bypass -File scripts\launch.ps1

$root = Split-Path $PSScriptRoot -Parent
$backendDir  = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Nilesh — Launching System" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# 1. Start Ollama (if not already running)
$ollamaRunning = $false
try {
    $resp = Invoke-WebRequest -Uri "http://127.0.0.1:11434/api/tags" -TimeoutSec 2 -ErrorAction Stop
    $ollamaRunning = $true
    Write-Host "[OK] Ollama is active on http://127.0.0.1:11434" -ForegroundColor Green
} catch {
    Write-Host "[STARTING] Ollama service..." -ForegroundColor Yellow
    $env:OLLAMA_MODELS = Join-Path $root "ai\models"
    $ollamaExe = "C:\Users\win-11\AppData\Local\Programs\Ollama\ollama.exe"
    if (Test-Path $ollamaExe) {
        Start-Process $ollamaExe -ArgumentList "serve" -WindowStyle Hidden
        Start-Sleep -Seconds 3
        Write-Host "[OK] Ollama started." -ForegroundColor Green
    } else {
        Write-Host "[WARN] Ollama executable not found. Running in online fallback mode." -ForegroundColor Yellow
    }
}

# 2. Start Backend API
Write-Host "[STARTING] Backend API on http://localhost:3001 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendDir'; node --watch --experimental-strip-types src/index.ts" -WindowStyle Normal

Start-Sleep -Seconds 2

# 3. Start Frontend Dashboard
Write-Host "[STARTING] Frontend Dashboard on http://localhost:5173 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendDir'; npx vite --port 5173" -WindowStyle Normal

Start-Sleep -Seconds 3

# 4. Open Browser
Write-Host "[OPENING] Dashboard in browser..." -ForegroundColor Cyan
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  Nilesh is running!" -ForegroundColor Green
Write-Host "  Dashboard: http://localhost:5173" -ForegroundColor Green
Write-Host "  Backend:   http://localhost:3001" -ForegroundColor Green
Write-Host "  Projects:  $root\projects" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
