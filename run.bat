@echo off
title Initiative Dashboard - Local Server
cls
echo ========================================================
echo   INITIATIVE CENTRAL DASHBOARD (Local Server)
echo ========================================================
echo.
echo   Initiatives:
echo   1. Apne Apne Ram
echo   2. Diwali Event
echo   3. Khatu Shyam
echo   4. Sports Talent
echo.
echo   [1/2] Launching Dashboard in default browser...
timeout /t 2 /nobreak > nul
start http://localhost:3000

echo   [2/2] Starting Node.js backend server on port 3000...
echo.
echo   Local URL: http://localhost:3000
echo   Press CTRL+C anytime to stop the server.
echo.
echo ========================================================
node server.js
pause
