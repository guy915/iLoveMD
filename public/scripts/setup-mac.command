#!/bin/bash
# Local Marker Setup for macOS
# This script installs marker-pdf and starts the local server

set -e  # Exit on error

echo "========================================"
echo "AI Doc Prep - Local Marker Setup"
echo "========================================"
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python 3 is not installed!"
    echo ""
    echo "Please install Python 3.9 or higher from:"
    echo "https://www.python.org/downloads/"
    echo ""
    echo "Or install via Homebrew:"
    echo "  brew install python@3.11"
    echo ""
    exit 1
fi

# Check Python version
echo "[1/4] Checking Python version..."
python_version=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
required_version="3.9"

if [ "$(printf '%s\n' "$required_version" "$python_version" | sort -V | head -n1)" != "$required_version" ]; then
    echo "[ERROR] Python 3.9 or higher is required!"
    echo ""
    echo "Your Python version: $python_version"
    echo ""
    echo "Please upgrade Python from: https://www.python.org/downloads/"
    echo ""
    exit 1
fi
echo "Python $python_version detected ✓"
echo ""

# Install marker-pdf
echo "[2/4] Installing marker-pdf (this may take a few minutes)..."
pip3 install marker-pdf || {
    echo "[ERROR] Failed to install marker-pdf!"
    echo ""
    exit 1
}
echo ""

# Install FastAPI and dependencies
echo "[3/4] Installing server dependencies..."
pip3 install fastapi uvicorn python-multipart || {
    echo "[ERROR] Failed to install server dependencies!"
    echo ""
    exit 1
}
echo ""

# Download marker_server.py
echo "[4/4] Downloading server script..."
cd ~
curl -o marker_server.py https://raw.githubusercontent.com/guy915/AI-Doc-Prep/main/public/scripts/marker_server.py || {
    echo "[ERROR] Failed to download server script!"
    echo ""
    echo "Please check your internet connection and try again."
    echo ""
    exit 1
}
echo ""

# Done
echo "========================================"
echo "Installation Complete!"
echo "========================================"
echo ""
echo "Starting the local Marker server..."
echo ""
echo "IMPORTANT: Keep this terminal open while using AI Doc Prep!"
echo "Press Ctrl+C to stop the server when you're done."
echo ""
echo "========================================"
echo ""

# Start the server
python3 marker_server.py
