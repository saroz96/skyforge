@echo off
title SkyForge POS System
color 0A
echo ========================================
echo    SkyForge POS System
echo ========================================
echo.

:: Install dependencies if needed
if not exist "backend\node_modules" (
    echo Installing backend dependencies...
    cd backend && npm install && cd ..
)
if not exist "frontend\node_modules" (
    echo Installing frontend dependencies...
    cd frontend && npm install && cd ..
)

echo.
echo Starting servers...
echo.

:: Start backend in background (no new window)
start /B cmd /c "cd backend && npm start" > backend.log 2>&1

:: Wait for backend
echo Waiting for backend to start...
:wait_backend
timeout /t 1 /nobreak >nul
findstr /C:"Server is running" backend.log >nul 2>&1
if errorlevel 1 goto wait_backend

echo Backend is ready on port 5000!

:: Start frontend in the same window
echo.
echo Starting frontend...
echo ========================================
echo.
cd frontend
npm start

:: Cleanup
del backend.log 2>nul