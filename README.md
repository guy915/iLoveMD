# iLoveMD

iLoveMD is a collection of simple, single-purpose tools designed to make working with markdown files easier. Inspired by tools like iLovePDF.

## Features

### PDF to Markdown
Convert PDF files to clean, high-quality markdown using the Marker API.
- **High Accuracy**: Uses Marker API for state-of-the-art conversion.
- **Configurable**: Options for pagination, image extraction, and math formatting.
- **Batch Processing**: Convert multiple PDFs at once.
- **Privacy First**: Your API keys are stored locally. Files are sent directly to the Marker API, never to our servers.

### Merge Markdowns
Combine multiple markdown files into a single document.
- **Drag & Drop**: Easy interface to manage multiple files.
- **Customizable**: Add separators, file names, or custom text between files.
- **Client-Side**: Processing happens entirely in your browser.

## Getting Started

### Prerequisites

- Node.js 18+ installed

### Installation

```bash
# Clone the repository
git clone https://github.com/guy915/iLoveMD.git
cd iLoveMD

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

**Note:** This tool requires external API keys (for PDF conversion) that you must obtain yourself.
