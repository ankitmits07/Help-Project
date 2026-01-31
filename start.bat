@echo off
echo Starting Help Nearby Application...
echo.

echo Starting Backend Server...
start "Backend" cmd /k cd /d "E:\Help Project\node_api" ^&^& node server.js

timeout /t 3 /nobreak > nul

echo Starting Frontend Application...
start "Frontend" cmd /k cd /d "E:\Help Project\Help_Nearby" ^&^& npm start

echo.
echo Both servers are starting...
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3000
echo.
pause
