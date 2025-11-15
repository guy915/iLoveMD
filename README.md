# iLoveLLM

A website for preprocessing documents for LLMs and RAG.

## Overview

iLoveLLM provides simple, single-purpose tools to convert and prepare documents specifically for LLM workflows like ChatGPT, Claude, and other AI assistants. Everything converts to markdown because that's what LLMs digest best.

## Features

### PDF to Markdown
Convert PDF files to clean markdown using Marker API with configurable options.

### Merge Markdowns
Combine multiple markdown files into one with customizable separators and ordering.

## Getting Started

### Prerequisites

- Node.js 18+ installed

### Installation

```bash
# Clone the repository
git clone https://github.com/guy915/iLoveLLM.git
cd iLoveLLM

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

---

**Note:** This tool requires external API keys that you must obtain yourself. We don't provide API access or pay for API usage.
