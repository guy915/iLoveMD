# AI Doc Prep

A website for preprocessing documents for LLMs and RAG.

## Overview

AI Doc Prep provides simple, single-purpose tools to convert and prepare documents specifically for LLM workflows like ChatGPT, Claude, and other AI assistants. Everything converts to markdown because that's what LLMs digest best.

## Features

### PDF to Markdown
Convert PDF files to clean markdown using Marker API with configurable options.

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
git clone https://github.com/guy915/AI-Doc-Prep.git
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

---

**Note:** This tool requires external API keys that you must obtain yourself. We don't provide API access or pay for API usage.
