# AI Doc Prep

A website for preprocessing documents for LLMs and RAG.

## Overview

AI Doc Prep provides simple, single-purpose tools to convert and prepare documents specifically for LLM workflows like ChatGPT, Claude, and other AI assistants. Everything converts to markdown because that's what LLMs digest best.

## Features

### PDF to Markdown (In Progress)
Convert PDF files to clean markdown using Marker

### HTML to Markdown (Coming Soon)
Convert HTML files or web pages to markdown.

### Merge Markdowns (Coming Soon)
Merge Markdown files.

## Getting Started

### Prerequisites

- Node.js 18+ installed

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/AI-Doc-Prep.git
cd AI-Doc-Prep

# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables

Create a `.env.local` file (optional, for development):

```env
# Not required - users provide their own API keys via UI
# Add any development-specific variables here
```

## Usage

### PDF to Markdown

1. Navigate to the PDF to Markdown tool
2. Enter your Marker API key (stored locally in your browser)
   - Get your free API key at [datalab.to](https://www.datalab.to/)
3. Upload a PDF file
4. Click "Convert to Markdown"
5. Wait for processing (may take a few minutes for large files)
6. Download automatically starts when complete


## Troubleshooting

### Diagnostic Logging

The app includes a comprehensive diagnostic logging system visible in the header:
- Click "Diagnostic Logs" to view all application events
- See file uploads, API calls, errors, and performance metrics
- Copy logs to share when troubleshooting issues

### "Invalid API key" error
- Verify your Marker API key at [datalab.to](https://www.datalab.to/)
- Make sure you copied the entire key
- Check that your key has remaining credits

### "File too large" error
- Maximum file size is 1GB
- Try splitting large PDFs before conversion

### Processing takes too long
- Large files can take several minutes
- Check your internet connection
- Ensure the Marker API service is online

### Download not working
- Check browser download settings
- Ensure pop-ups aren't blocked
- Try a different browser

---

**Note:** This tool requires external API keys that you must obtain yourself. We don't provide API access or pay for API usage.
