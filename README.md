# AI Doc Prep

A website for pre-processing documents for LLMs and RAG.

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

## Project Structure

```
ai-doc-prep/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.js           # Root layout with diagnostic logging
│   │   ├── page.js             # Homepage with tool tiles
│   │   ├── pdf-to-markdown/    # PDF tool (complete)
│   │   ├── loading.js          # Global loading state
│   │   ├── not-found.js        # Custom 404 page
│   │   └── api/
│   │       └── marker/         # Proxy to Marker API
│   ├── components/             # React components
│   │   ├── layout/             # Header, Footer, GlobalDiagnosticPanel
│   │   ├── common/             # Button, FileUpload, ErrorBoundary
│   │   └── home/               # ToolTile
│   ├── contexts/               # React Context providers
│   │   └── LogContext.js       # Diagnostic logging context
│   ├── lib/                    # Business logic
│   │   ├── constants.js        # Centralized constants
│   │   └── utils/              # downloadUtils, classNames
│   └── hooks/                  # Custom React hooks
│       └── useLocalStorage.js  # localStorage wrapper
├── assets/                     # Test files and resources
├── public/                     # Static assets
└── README.md
```

## Usage

### PDF to Markdown

1. Navigate to the PDF to Markdown tool
2. Enter your Marker API key (stored locally in your browser)
   - Get your free API key at [datalab.to](https://www.datalab.to/)
3. Upload a PDF file (up to 1GB)
4. Click "Convert to Markdown"
5. Wait for processing (may take a few minutes for large files)
6. Download automatically starts when complete

**Note:** Advanced configuration options (output formats, OCR, LLM enhancement, etc.) are planned for future releases.

### Diagnostic Logging

The app includes a comprehensive diagnostic logging system visible in the header:
- Click "Diagnostic Logs" to view all application events
- See file uploads, API calls, errors, and performance metrics
- Copy logs to share when troubleshooting issues
- Logs persist across page navigation within the same session
- Logs reset when you close the browser tab

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

### Phase 1-2: Foundation ✅ Complete
- [x] Project setup (Next.js 14, Tailwind, dependencies)
- [x] Core UI (Header, Footer, Homepage, reusable components)
- [x] Diagnostic logging system for debugging

### Phase 3: PDF Tool ✅ Complete
- [x] PDF to Markdown conversion
- [x] Marker API integration
- [x] File upload and validation
- [x] Comprehensive error handling and logging

### Phase 4: HTML Tool (Next)
- [ ] HTML file upload to Markdown
- [ ] URL fetching and conversion
- [ ] Client-side processing with Turndown.js

### Phase 5: Merge Tool (Future)
- [ ] Multi-file markdown merging
- [ ] Drag-and-drop reordering
- [ ] Customizable separators

### Phase 6: Polish (Future)
- [ ] Help and About pages
- [ ] Mobile responsive design
- [ ] Cross-browser testing
- [ ] Deploy to production

### Post-v1.0 Ideas
- Token counter for different LLM models
- Markdown splitter/chunker
- Batch processing
- Preview before download

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

### Processing takes too long
- Large files can take several minutes
- Check your internet connection
- Ensure the Marker API service is online

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
