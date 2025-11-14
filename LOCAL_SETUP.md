# Local Marker Setup Guide

Run Marker PDF conversion locally on your machine - no Docker required!

## Quick Start (3 steps)

### 1. Install Requirements

```bash
# Install marker-pdf and dependencies
pip install marker-pdf fastapi uvicorn python-multipart
```

### 2. Start the Server

```bash
# In the project directory
python marker_server.py
```

You should see:
```
🚀 Local Marker Server Starting...
📍 Server: http://localhost:8000
🌐 Website: http://localhost:3000
✅ Keep this terminal open!
```

### 3. Use the Website

1. Open http://localhost:3000/pdf-to-markdown
2. Select **"Local Marker"** mode
3. Upload a PDF and convert!

**That's it!** The website sends files to your local server, which runs Marker CLI commands.

---

## How It Works

```
Browser → http://localhost:3000 (Next.js website)
   ↓
   POST /api/marker/local (Next.js API route)
   ↓
   POST http://localhost:8000/marker (Python server)
   ↓
   marker_single command (CLI)
   ↓
   Markdown result → Browser
```

The website talks to the Python server on localhost:8000, which executes the `marker_single` CLI command with your options.

---

## What Gets Installed

- **marker-pdf** - The actual Marker PDF converter (the CLI tool you used before!)
- **fastapi** - Web framework for the server
- **uvicorn** - Server to run FastAPI
- **python-multipart** - For handling file uploads

---

## Optional: Using LLM Enhancement

If you want to use LLM enhancement (better quality, slower):

1. Get a Gemini API key: https://aistudio.google.com/app/apikey
2. In the website, enable "Use LLM enhancement"
3. Paste your Gemini API key
4. Convert your PDF

The server will pass your API key to the Marker CLI command.

---

## Troubleshooting

### "Connection refused" error

The server isn't running. Start it with:
```bash
python marker_server.py
```

### "marker_single: command not found"

Marker isn't installed. Install it:
```bash
pip install marker-pdf
```

### Port 8000 already in use

Something else is using port 8000. Either:
1. Stop the other service
2. Or edit `marker_server.py` line 208 to use a different port (like 8001)

### Conversion takes a long time

Marker is processing-intensive, especially with LLM enhancement:
- First run: Downloads ML models (~5-10 min first time)
- Subsequent runs: Much faster
- With LLM: Slower but better quality
- Without LLM: Faster

---

## vs Docker Version

**Local Server (this guide):**
- ✅ Easy setup (just pip install)
- ✅ No Docker needed
- ✅ Runs marker CLI directly
- ❌ Need to keep terminal open

**Docker Version:**
- ✅ Containerized (isolated)
- ✅ Can run as background service
- ❌ Requires Docker installed
- ❌ More complex setup

Choose whichever you prefer! Both work the same in the website.

---

## Stopping the Server

Press `Ctrl+C` in the terminal where the server is running.

---

## Advanced: Run as Background Service

If you want the server to run in the background:

**macOS/Linux:**
```bash
# Run in background
nohup python marker_server.py &

# Stop it later
pkill -f marker_server.py
```

**Windows:**
```batch
REM Run in background
start /B python marker_server.py

REM Stop it: Close the terminal or use Task Manager
```
