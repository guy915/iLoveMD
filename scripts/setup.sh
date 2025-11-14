#!/bin/bash
# Local Marker Setup - Universal Script
# One-line install: curl -sSL https://raw.githubusercontent.com/guy915/AI-Doc-Prep/main/scripts/setup.sh | bash

set -e  # Exit on error

echo "========================================"
echo "AI Doc Prep - Local Marker Setup"
echo "========================================"
echo ""

# Detect OS
OS="unknown"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    OS="windows"
fi

echo "Detected OS: $OS"
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python 3 is not installed!"
    echo ""
    if [ "$OS" == "macos" ]; then
        echo "Install Python via Homebrew:"
        echo "  brew install python@3.11"
        echo ""
        echo "Or download from: https://www.python.org/downloads/"
    elif [ "$OS" == "linux" ]; then
        echo "Ubuntu/Debian: sudo apt install python3 python3-pip"
        echo "Fedora/RHEL: sudo dnf install python3 python3-pip"
        echo "Arch: sudo pacman -S python python-pip"
    else
        echo "Download from: https://www.python.org/downloads/"
    fi
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
    exit 1
fi
echo "Python $python_version detected ✓"
echo ""

# Install marker-pdf
echo "[2/4] Installing marker-pdf (this may take a few minutes)..."
if pip3 install marker-pdf 2>&1 | grep -q "already satisfied"; then
    echo "marker-pdf is already installed ✓"
else
    echo "marker-pdf installed successfully ✓"
fi
echo ""

# Install FastAPI and dependencies
echo "[3/4] Installing server dependencies..."
if pip3 install fastapi uvicorn python-multipart 2>&1 | grep -q "already satisfied"; then
    echo "Server dependencies already installed ✓"
else
    echo "Server dependencies installed successfully ✓"
fi
echo ""

# Download marker_server.py
echo "[4/4] Downloading server script..."
cd ~
if [ -f "marker_server.py" ]; then
    echo "Updating existing marker_server.py..."
    rm marker_server.py
fi
curl -sSL -o marker_server.py https://raw.githubusercontent.com/guy915/AI-Doc-Prep/main/public/scripts/marker_server.py || {
    echo "[ERROR] Failed to download server script!"
    echo ""
    echo "Please check your internet connection and try again."
    echo ""
    exit 1
}
echo "Server script downloaded ✓"
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
