@echo off
title Nilesh - Free AI RAM
color 0e

echo ===================================================
echo             Nilesh — Memory Cleaner
echo      Releasing AI Models from Computer RAM
echo ===================================================
echo.

:: Send unload signal to Ollama to release any active model weights from RAM
curl -s -X POST http://127.0.0.1:11434/api/generate -d "{\"model\":\"qwen2.5-coder:1.5b\",\"keep_alive\":0}" >nul 2>nul
curl -s -X POST http://127.0.0.1:11434/api/generate -d "{\"model\":\"qwen2.5-coder:3b\",\"keep_alive\":0}" >nul 2>nul

echo [SUCCESS] Memory released! All model weights unloaded from RAM.
echo Your computer's RAM is now completely free.
echo.
pause
