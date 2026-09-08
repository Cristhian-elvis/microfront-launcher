@echo off
cd /d "%~dp0"
node build.mjs
if errorlevel 1 (
  pause
  exit /b 1
)
npm run start
if errorlevel 1 pause
