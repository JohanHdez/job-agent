@echo off
:: ─────────────────────────────────────────────────────────────────────────────
:: Job Agent — Dev Launcher (Windows CMD)
:: Double-click this file OR run:  dev.bat
:: ─────────────────────────────────────────────────────────────────────────────
title Job Agent — Dev Server

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║        Job Agent  —  Dev Server          ║
echo  ╚══════════════════════════════════════════╝
echo.

:: Change to repo root
cd /d "%~dp0"

:: ── 1. Check .env ─────────────────────────────────────────────────────────────
if not exist ".env" (
  echo  [ERROR] .env not found — copy .env.example and fill in your credentials
  pause
  exit /b 1
)
echo  [OK]   .env found

:: ── 2. Redis ──────────────────────────────────────────────────────────────────
tasklist /FI "IMAGENAME eq redis-server.exe" 2>nul | find /I "redis-server.exe" >nul
if %errorlevel% equ 0 (
  echo  [OK]   Redis already running
) else (
  if exist "C:\Program Files\Redis\redis-server.exe" (
    echo  [...]  Starting Redis...
    start /min "Redis" "C:\Program Files\Redis\redis-server.exe" "C:\Program Files\Redis\redis.windows.conf"
    timeout /t 1 /nobreak >nul
    echo  [OK]   Redis started on port 6379
  ) else (
    echo  [ERROR] Redis not found — run: winget install Redis.Redis
    pause
    exit /b 1
  )
)

:: ── 3. MongoDB ────────────────────────────────────────────────────────────────
tasklist /FI "IMAGENAME eq mongod.exe" 2>nul | find /I "mongod.exe" >nul
if %errorlevel% equ 0 (
  echo  [OK]   MongoDB already running
) else (
  net start MongoDB >nul 2>&1
  if %errorlevel% equ 0 (
    echo  [OK]   MongoDB service started
  ) else (
    echo  [WARN] MongoDB not detected — start it manually if auth fails
  )
)

:: ── 4. Dependencies ───────────────────────────────────────────────────────────
if not exist "node_modules" (
  echo  [...]  Installing npm dependencies...
  call npm install --silent
  echo  [OK]   Dependencies installed
) else (
  echo  [OK]   node_modules present
)

:: ── 5. Start API + Web ────────────────────────────────────────────────────────
echo.
echo  Services starting:
echo    API    http://localhost:3001
echo    Web    http://localhost:5173
echo    Health http://localhost:3001/health
echo.
echo  Press Ctrl+C to stop all services
echo.

call npx concurrently ^
  --names "API,WEB" ^
  --prefix-colors "cyan,magenta" ^
  --prefix "[{name}]" ^
  --kill-others-on-fail ^
  "npm run dev -w @job-agent/api" ^
  "npm run dev -w @job-agent/web"
