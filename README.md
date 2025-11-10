# AI Doc Prep

A free web-based tool for preparing documents for Large Language Models (LLMs). Convert PDFs, HTML, and merge markdown files optimized for AI consumption.

## Overview

AI Doc Prep provides simple, single-purpose tools to convert and prepare documents specifically for LLM workflows like ChatGPT, Claude, and other AI assistants. Everything converts to markdown because that's what LLMs digest best.

**Live Site:** `ai-doc-prep.vercel.app` (when deployed)

## Features

### PDF to Markdown
- Convert PDF files to clean markdown using Marker AI
- Support for complex layouts (tables, equations, code blocks)
- Optional OCR for scanned documents
- Optional LLM enhancement for highest accuracy
- Customizable output formats (markdown, JSON, HTML, chunks)

### HTML to Markdown
- Convert HTML files or web pages to markdown
- Two input methods: file upload or URL
- Client-side preprocessing for speed and privacy
- Clean extraction of main content

### Merge Markdowns
- Combine multiple markdown files into one
- Drag-and-drop reordering
- Customizable separators and formatting
- Optional table of contents generation
- Handles up to 50 files, 1GB total

## Tech Stack

- **Framework:** Next.js 14+ (App Router)
- **Styling:** Tailwind CSS
- **Language:** JavaScript/React
- **Hosting:** Vercel (free tier)
- **APIs:** Marker API by Datalab

## Getting Started

### Prerequisites

- Node.js 18+ installed
- A Marker API key (free for personal use) from [datalab.to](https://www.datalab.to/)

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

## Project Structure

```
ai-doc-prep/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.js           # Root layout
│   │   ├── page.js             # Homepage
│   │   ├── pdf-to-markdown/    # PDF tool
│   │   ├── html-to-markdown/   # HTML tool
│   │   ├── merge-markdown/     # Merge tool
│   │   ├── help/               # Help page
│   │   ├── about/              # About page
│   │   └── api/                # API routes
│   ├── components/             # React components
│   │   ├── layout/             # Header, Footer, etc.
│   │   ├── common/             # Reusable UI components
│   │   └── tools/              # Tool-specific components
│   ├── lib/                    # Business logic
│   │   ├── processors/         # File processing logic
│   │   ├── api/                # API client functions
│   │   └── utils/              # Utility functions
│   └── hooks/                  # Custom React hooks
├── public/                     # Static assets
└── README.md
```

## Usage

### PDF to Markdown

1. Navigate to the PDF to Markdown tool
2. Enter your Marker API key (stored locally in your browser)
3. Upload a PDF file (up to 1GB)
4. Configure options:
   - Output format (markdown/JSON/HTML/chunks)
   - Paginate (include page numbers)
   - Use LLM enhancement (slower but more accurate)
   - Force OCR (for scanned documents)
   - Mode (fast/accurate)
5. Click "Convert to Markdown"
6. Download the result

### HTML to Markdown

1. Navigate to the HTML to Markdown tool
2. Choose input method:
   - Upload an HTML file, or
   - Paste a URL
3. Configure options:
   - Preserve images
   - Preserve links
4. Click "Convert to Markdown"
5. Download the result

### Merge Markdowns

1. Navigate to the Merge Markdown tool
2. Upload multiple markdown files (up to 50 files)
3. Reorder files by dragging
4. Configure options:
   - File ordering (upload order/alphabetical/custom)
   - Separator style (none/page breaks/file headers)
   - Generate table of contents
5. Click "Merge Files"
6. Download the merged file

## API Key Management

- **Your API keys are stored locally** in your browser using localStorage
- Keys are never sent to our servers
- Your keys are only used to call external APIs (like Marker) directly on your behalf
- Clear your browser data to remove stored keys

## Privacy & Security

- **No data storage:** Files are processed and immediately deleted
- **No tracking:** We don't collect analytics or user data
- **No accounts:** No registration or login required
- **Local processing:** HTML and merge tools process entirely in your browser
- **Open source:** Review the code yourself

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import project in Vercel
3. Deploy (no environment variables needed)
4. Your site will be live at `your-project.vercel.app`

### Custom Domain (Optional)

Follow Vercel's documentation to add a custom domain to your deployment.

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

Modern browsers only. No IE support.

## Contributing

This is a personal hobby project, but suggestions and feedback are welcome!

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Roadmap

### v1.0 (Current)
- [x] PDF to Markdown conversion
- [x] HTML to Markdown conversion
- [x] Merge Markdown files
- [x] Dark mode support
- [ ] Mobile responsive design

### Future Considerations
- Token counter for different LLM models
- Markdown splitter/chunker
- Batch processing
- Additional output formats
- More preprocessing options

## Known Limitations

- Maximum file size: 1GB per file
- Browser memory constraints for very large files
- Some complex PDFs may not convert perfectly
- JavaScript-heavy websites may not convert well from URL

## Troubleshooting

### "Invalid API key" error
- Verify your Marker API key at [datalab.to](https://www.datalab.to/)
- Make sure you copied the entire key
- Check that your key has remaining credits

### "File too large" error
- Maximum file size is 1GB
- Try splitting large PDFs before conversion
- Consider using page range option for large PDFs

### Processing takes too long
- Large files can take several minutes
- Try "Fast" mode instead of "Accurate"
- Disable LLM enhancement for faster processing
- Use page range to process only needed pages

### Download not working
- Check browser download settings
- Ensure pop-ups aren't blocked
- Try a different browser

## License

MIT License - See LICENSE file for details

## Acknowledgments

- [Marker by Datalab](https://www.datalab.to/) for PDF conversion
- [Turndown.js](https://github.com/mixmark-io/turndown) for HTML to Markdown conversion
- [Mozilla Readability](https://github.com/mozilla/readability) for content extraction
- Inspired by [iLovePDF](https://www.ilovepdf.com/) design

## Contact

Built by a CS student as a learning project and convenience tool.

- GitHub: [Link to your profile]
- Issues: [Link to issues page]

---

**Note:** This tool requires external API keys that you must obtain yourself. We don't provide API access or pay for API usage.
