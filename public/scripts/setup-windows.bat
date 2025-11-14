@echo off
REM Local Marker Setup for Windows
REM This script installs marker-pdf and starts the local server

echo ========================================
echo AI Doc Prep - Local Marker Setup
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed!
    echo.
    echo Please install Python 3.9 or higher from:
    echo https://www.python.org/downloads/
    echo.
    echo Make sure to check "Add Python to PATH" during installation.
    echo.
    pause
    exit /b 1
)

REM Check Python version
echo [1/4] Checking Python version...
python -c "import sys; exit(0 if sys.version_info >= (3, 9) else 1)" >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python 3.9 or higher is required!
    echo.
    echo Your Python version:
    python --version
    echo.
    echo Please upgrade Python from: https://www.python.org/downloads/
    echo.
    pause
    exit /b 1
)
python --version
echo.

REM Install marker-pdf
echo [2/4] Installing marker-pdf (this may take a few minutes)...
pip install marker-pdf
if errorlevel 1 (
    echo [ERROR] Failed to install marker-pdf!
    echo.
    pause
    exit /b 1
)
echo.

REM Install FastAPI and dependencies
echo [3/4] Installing server dependencies...
pip install fastapi uvicorn python-multipart
if errorlevel 1 (
    echo [ERROR] Failed to install server dependencies!
    echo.
    pause
    exit /b 1
)
echo.

REM Download marker_server.py
echo [4/4] Downloading server script...
cd %USERPROFILE%
curl -o marker_server.py https://raw.githubusercontent.com/guy915/AI-Doc-Prep/main/public/scripts/marker_server.py
if errorlevel 1 (
    echo [ERROR] Failed to download server script!
    echo.
    echo Please check your internet connection and try again.
    echo.
    pause
    exit /b 1
)
echo.

REM Done
echo ========================================
echo Installation Complete!
echo ========================================
echo.
echo Starting the local Marker server...
echo.
echo IMPORTANT: Keep this window open while using AI Doc Prep!
echo Press Ctrl+C to stop the server when you're done.
echo.
echo ========================================
echo.

REM Start the server
python marker_server.py
