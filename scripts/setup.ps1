# setup.ps1 — MyPersonalAI First-Time Setup
# Run this script once before launching the app.
# Usage: powershell -ExecutionPolicy Bypass -File scripts\setup.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  MyPersonalAI — Setup Script" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# ─── Check Node.js ───────────────────────────────────────────────
Write-Host "Checking Node.js..." -NoNewline
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host " MISSING" -ForegroundColor Red
    Write-Host "  Please install Node.js from https://nodejs.org and re-run this script." -ForegroundColor Yellow
    exit 1
}
Write-Host " OK ($((node --version)))" -ForegroundColor Green

# ─── Check Ollama ────────────────────────────────────────────────
Write-Host "Checking Ollama..." -NoNewline
$ollama = Get-Command ollama -ErrorAction SilentlyContinue
if (-not $ollama) {
    Write-Host " MISSING" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Ollama is not installed. It is required for local AI." -ForegroundColor Yellow
    Write-Host "  Download from: https://ollama.com/download/windows" -ForegroundColor Cyan
    Write-Host "  After installing, re-run this script." -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host " OK" -ForegroundColor Green

    # Check if recommended model is available
    Write-Host "Checking for qwen2.5-coder:3b model..." -NoNewline
    $models = ollama list 2>$null
    if ($models -match "qwen2.5-coder:3b") {
        Write-Host " OK (already downloaded)" -ForegroundColor Green
    } else {
        Write-Host " NOT FOUND" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  The recommended model is not downloaded yet." -ForegroundColor Yellow
        $pull = Read-Host "  Download qwen2.5-coder:3b now? (~2 GB) [y/N]"
        if ($pull -eq 'y' -or $pull -eq 'Y') {
            Write-Host "  Pulling model (this may take several minutes)..." -ForegroundColor Cyan
            ollama pull qwen2.5-coder:3b
            Write-Host "  Model downloaded." -ForegroundColor Green
        } else {
            Write-Host "  Skipped. You can pull it later with: ollama pull qwen2.5-coder:3b" -ForegroundColor Yellow
        }
    }
}

# ─── Check MongoDB ───────────────────────────────────────────────
Write-Host "Checking MongoDB..." -NoNewline
$mongod = Get-Command mongod -ErrorAction SilentlyContinue
if (-not $mongod) {
    Write-Host " MISSING" -ForegroundColor Yellow
    Write-Host "  MongoDB is not installed." -ForegroundColor Yellow
    Write-Host "  Download from: https://www.mongodb.com/try/download/community" -ForegroundColor Cyan
    Write-Host "  (MongoDB Compass is optional but recommended for viewing data)" -ForegroundColor Yellow
} else {
    Write-Host " OK" -ForegroundColor Green
}

# ─── Copy .env if missing ────────────────────────────────────────
Write-Host "Checking .env file..." -NoNewline
$envFile = Join-Path $root ".env"
$envExample = Join-Path $root ".env.example"
if (-not (Test-Path $envFile)) {
    Copy-Item $envExample $envFile
    Write-Host " Created from .env.example" -ForegroundColor Yellow
    Write-Host "  Review E:\MyPersonalAI\.env and add your API keys if needed." -ForegroundColor Yellow
} else {
    Write-Host " Already exists" -ForegroundColor Green
}

# ─── Install backend deps ────────────────────────────────────────
$backendDir = Join-Path $root "backend"
if (Test-Path (Join-Path $backendDir "package.json")) {
    Write-Host "Installing backend dependencies..." -ForegroundColor Cyan
    Push-Location $backendDir
    npm install
    Pop-Location
    Write-Host "  Backend deps OK" -ForegroundColor Green
}

# ─── Install frontend deps ───────────────────────────────────────
$frontendDir = Join-Path $root "frontend"
if (Test-Path (Join-Path $frontendDir "package.json")) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Cyan
    Push-Location $frontendDir
    npm install
    Pop-Location
    Write-Host "  Frontend deps OK" -ForegroundColor Green
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  Setup complete! Run scripts\launch.ps1 to start." -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
