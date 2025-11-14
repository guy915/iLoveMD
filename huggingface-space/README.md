---
title: Marker PDF Converter
emoji: 📄
colorFrom: blue
colorTo: purple
sdk: docker
sdk_version: "3.10"
app_file: app.py
pinned: false
license: mit
---

# Marker PDF Converter - Cloud Free Mode

This is the **Cloud Free** backend for [AI Doc Prep](https://github.com/guy915/AI-Doc-Prep), providing free GPU-accelerated PDF to Markdown conversion using [Marker](https://github.com/VikParuchuri/marker).

## Features

- **Free GPU acceleration** - Runs on HuggingFace's free T4 GPU tier
- **Fast conversion** - 1-3 seconds per page (after cold start)
- **No API keys required** - Completely free to use (optional Gemini key for LLM enhancement)
- **Full Marker support** - All options available (page separators, math formatting, image descriptions, etc.)

## Usage

This Space is automatically used by AI Doc Prep when users select **Cloud Free** mode. No manual interaction needed.

### API Endpoints

**POST /convert**
- Upload PDF and conversion options
- Returns `request_id` and `check_url`

**GET /check/{request_id}**
- Poll conversion status
- Returns markdown when complete

**GET /health**
- Health check
- Returns GPU status and active jobs

## Performance

- **Cold start**: 30-60 seconds (when Space wakes up)
- **Warm processing**: 1-3 seconds per page
- **Sleep timer**: Sleeps after 48 hours of inactivity

## Options Supported

- **Output Format**: Markdown, JSON, HTML
- **Languages**: English, Spanish, French, German, etc.
- **Page Separators**: Add page breaks and numbers
- **Line Formatting**: Remove hyphenation
- **LLM Enhancement**: Use Gemini for better quality (requires API key)
- **Image Descriptions**: Replace images with AI descriptions
- **Math Formatting**: Apply LaTeX formatting

## About

Built for [AI Doc Prep](https://github.com/guy915/AI-Doc-Prep) - A web app for preparing documents for LLMs.

Powered by [Marker](https://github.com/VikParuchuri/marker) - High-quality PDF to Markdown conversion.
