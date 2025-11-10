# AI Doc Prep - Complete Project Plan

## Project Overview

**Name:** AI Doc Prep
**URL:** ai-doc-prep.vercel.app
**Purpose:** Free web-based tool for preparing documents for LLM consumption
**Timeline:** 1 week
**Status:** Planning Complete ✓

## Vision Statement

A simple, privacy-focused web application that converts documents to markdown format optimized for Large Language Models. Users bring their own API keys, we provide the interface.

---

## Core Features (v1.0)

### 1. PDF to Markdown
- **Input:** Single PDF file (up to 1GB)
- **Processing:** Via Marker API (user's API key)
- **Options:** Paginate, use LLM, force OCR, mode, output format, page range
- **Output:** Markdown/JSON/HTML/chunks file

### 2. HTML to Markdown
- **Input:** HTML file upload OR URL
- **Processing:** Client-side (Turndown.js + Readability)
- **Options:** Preserve images, preserve links
- **Output:** Markdown file

### 3. Merge Markdowns
- **Input:** Multiple markdown files (up to 50, 1GB total)
- **Processing:** Client-side
- **Options:** File ordering, separator style, generate TOC
- **Output:** Single merged markdown file

---

## Tech Stack

| Component | Technology | Reason |
|-----------|------------|--------|
| Framework | Next.js 14+ (App Router) | Best for you to learn, great docs |
| Styling | Tailwind CSS | Fast, minimal, no CSS files |
| Language | JavaScript | Your current skill level |
| Hosting | Vercel | Free, automatic, zero config |
| State | Component-level + localStorage | Simple, no complex state management |
| PDF Conversion | Marker API | Best quality for LLM prep |
| HTML Processing | Turndown.js, Readability | Client-side, fast, private |

---

## Key Design Decisions

### Architecture
- **Client-heavy:** Most processing in browser for privacy and cost
- **API routes:** Only for proxying external APIs and bypassing CORS
- **No database:** Everything processes in real-time, no storage
- **No authentication:** Users provide their own API keys

### User Experience
- **Minimal design:** Functional over flashy
- **Single-purpose tools:** No complex pipelines
- **Instant feedback:** Clear status messages and progress
- **Privacy-first:** No tracking, no data retention

### Technical
- **Modern browsers only:** No legacy support
- **Mobile support:** Eventually, desktop first
- **localStorage:** For preferences and API keys
- **Dark mode:** Based on system preferences

---

## Project Structure

```
ai-doc-prep/
├── src/
│   ├── app/                    # Pages & routing
│   │   ├── page.js            # Homepage
│   │   ├── pdf-to-markdown/
│   │   ├── html-to-markdown/
│   │   ├── merge-markdown/
│   │   ├── help/
│   │   ├── about/
│   │   └── api/               # API routes
│   ├── components/            # React components
│   ├── lib/                   # Business logic
│   └── hooks/                 # Custom hooks
├── public/                    # Static assets
└── [config files]
```

---

## Implementation Phases

### Phase 1: Setup (Day 1) ✓
- [x] Initialize Next.js project
- [x] Install dependencies
- [x] Setup Tailwind
- [x] Create project structure
- [x] Initialize Git & GitHub

### Phase 2: Core UI (Day 1-2)
- [ ] Create layout components (Header, Footer)
- [ ] Create homepage with tiles
- [ ] Create reusable components (Button, FileUpload)
- [ ] Setup routing
- [ ] Test navigation

### Phase 3: PDF Tool (Day 2-3)
- [ ] Create /api/marker route
- [ ] Create PDF tool page
- [ ] Implement file upload
- [ ] Implement options panel
- [ ] Implement API key input
- [ ] Test with real PDFs

### Phase 4: HTML Tool (Day 3-4)
- [ ] Create /api/fetch-url route
- [ ] Install Turndown & Readability
- [ ] Create HTML tool page
- [ ] Implement tab interface (file/URL)
- [ ] Implement HTML processing
- [ ] Test with various HTML sources

### Phase 5: Merge Tool (Day 4-5)
- [ ] Create merge processing logic
- [ ] Create merge tool page
- [ ] Implement multi-file upload
- [ ] Implement drag-to-reorder
- [ ] Implement separator options
- [ ] Test with multiple files

### Phase 6: Polish & Deploy (Day 5-7)
- [ ] Create Help page
- [ ] Create About page
- [ ] Add error handling
- [ ] Mobile responsive testing
- [ ] Cross-browser testing
- [ ] Deploy to Vercel
- [ ] Final testing on production

---

## User Flows

### PDF Conversion Flow
```
1. User visits homepage
2. Clicks "PDF to Markdown" tile
3. Enters/retrieves Marker API key (from localStorage)
4. Uploads PDF file
5. Configures options (paginate, use LLM, etc.)
6. Clicks "Convert to Markdown"
7. Sees "Processing..." message
8. File auto-downloads when complete
9. Sees success message
```

### HTML Conversion Flow (File)
```
1. User clicks "HTML to Markdown"
2. Uploads HTML file
3. (Optional) Configures options
4. Clicks "Convert"
5. Instant processing (client-side)
6. File downloads
```

### HTML Conversion Flow (URL)
```
1. User clicks "HTML to Markdown"
2. Switches to "Paste URL" tab
3. Enters URL
4. Clicks "Fetch & Convert"
5. Server fetches HTML
6. Client processes HTML
7. File downloads
```

### Merge Flow
```
1. User clicks "Merge Markdowns"
2. Uploads multiple .md files
3. (Optional) Reorders by dragging
4. Configures separator style
5. Clicks "Merge Files"
6. Instant processing (client-side)
7. Merged file downloads
```

---

## Data Flow

### PDF Tool
```
Client → Upload file → /api/marker → Marker API
                                    ↓
Client ← Download result ← /api/marker ← Marker API
```

### HTML Tool (File)
```
Client → Process file → Download
(entirely client-side)
```

### HTML Tool (URL)
```
Client → /api/fetch-url → External website
                        ↓
Client ← HTML ← /api/fetch-url
       ↓
Process locally → Download
```

### Merge Tool
```
Client → Process files → Download
(entirely client-side)
```

---

## API Integrations

### Marker API (Datalab.to)
- **Purpose:** PDF to Markdown conversion
- **Authentication:** User's API key (X-API-Key header)
- **Endpoint:** https://www.datalab.to/api/v1/marker
- **Method:** POST (multipart/form-data)
- **Cost:** Free for personal use (<$2M revenue)

### No Other APIs
- HTML processing is client-side
- Merge is client-side
- No analytics APIs
- No authentication APIs

---

## Security & Privacy

### Data Handling
- **No server storage:** Files deleted immediately after processing
- **No logging:** Don't log file contents or user data
- **No tracking:** No analytics, no cookies (except localStorage)

### API Keys
- **Stored locally:** In browser's localStorage only
- **Never logged:** Never sent to our servers (except forwarded to external APIs)
- **User responsibility:** Users manage their own keys

### Best Practices
- **Input validation:** Check file types, sizes
- **Error handling:** Don't expose internal errors
- **CORS:** Handle properly for URL fetching
- **HTTPS:** Vercel provides automatic SSL

---

## Performance Targets

### Page Load
- **Homepage:** <1s first load
- **Tool pages:** <1s first load
- **Subsequent navigation:** Instant (client-side routing)

### Processing
- **HTML conversion:** <1s (client-side)
- **Merge:** <3s for 50 files (client-side)
- **PDF conversion:** Depends on Marker API (minutes for large files)

### File Sizes
- **Maximum:** 1GB per file
- **Recommended:** <100MB for best experience
- **Browser limit:** ~2GB total memory

---

## Testing Strategy

### Manual Testing
- [ ] Each tool with small files
- [ ] Each tool with large files
- [ ] Each tool with edge cases
- [ ] Error scenarios
- [ ] All browsers
- [ ] Mobile devices

### Test Cases

**PDF Tool:**
- [ ] Small PDF (<10MB)
- [ ] Large PDF (>100MB)
- [ ] Scanned PDF (OCR)
- [ ] PDF with tables
- [ ] Invalid API key
- [ ] Network timeout

**HTML Tool:**
- [ ] Simple HTML file
- [ ] Complex website
- [ ] URL with CORS issues
- [ ] Invalid URL
- [ ] JavaScript-heavy site

**Merge Tool:**
- [ ] 2 files
- [ ] 50 files
- [ ] Large files (500MB)
- [ ] Different separators
- [ ] Reordering

---

## Documentation Deliverables

- [x] README.md - Main documentation
- [x] ARCHITECTURE.md - Technical architecture
- [x] IMPLEMENTATION_GUIDE.md - Step-by-step guide
- [x] DESIGN_SYSTEM.md - UI/UX specifications
- [x] PROJECT_PLAN.md - This document

---

## Success Criteria

### Launch (v1.0)
- [ ] All 3 tools functional
- [ ] Deployed to Vercel
- [ ] Mobile responsive
- [ ] Dark mode works
- [ ] No critical bugs
- [ ] Documentation complete

### Post-Launch
- [ ] You and friends use it regularly
- [ ] No major issues reported
- [ ] Easy to add new tools
- [ ] Learnings documented

---

## Future Enhancements (Post v1.0)

### New Tools
- Token counter for different LLM models
- Markdown splitter (chunk by tokens/size)
- Text cleaner (remove extra whitespace)
- Format converter (MD to plain text)

### Improvements
- Batch processing (multiple files at once)
- Progress percentage for PDF conversion
- Preview before download
- Custom output filename
- Drag & drop files on homepage

### Polish
- Loading skeletons
- Better error messages
- Keyboard shortcuts
- Tutorial/onboarding
- Better mobile experience

---

## Risk Assessment

### Technical Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Marker API downtime | High | Clear error message, suggest retry |
| Browser memory limits | Medium | Warn users about file size limits |
| CORS issues with URLs | Medium | Server-side fetching via API route |
| Vercel function timeout | Low | Use streaming if needed |

### User Experience Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Unclear API key setup | High | Clear instructions in Help page |
| Slow PDF processing | Medium | Set expectations with messaging |
| Large file crashes | Medium | File size warnings |
| Browser compatibility | Low | Modern browsers only, show warning |

---

## Deployment Checklist

### Pre-Deployment
- [ ] All features tested locally
- [ ] Error handling implemented
- [ ] Loading states working
- [ ] Mobile responsive
- [ ] Dark mode working
- [ ] No console errors
- [ ] Git committed

### Deployment
- [ ] Push to GitHub
- [ ] Connect to Vercel
- [ ] Configure build settings
- [ ] Deploy to production
- [ ] Test production site
- [ ] Check all tools work

### Post-Deployment
- [ ] Share with friends
- [ ] Monitor for errors
- [ ] Gather feedback
- [ ] Document issues
- [ ] Plan improvements

---

## Learning Goals

As a first-year CS student, this project teaches:

1. **Web Development:**
   - React components and hooks
   - Client/server architecture
   - API integration
   - State management

2. **Best Practices:**
   - Project structure
   - Code organization
   - Error handling
   - User experience design

3. **DevOps:**
   - Git workflow
   - Deployment process
   - Environment management
   - Production debugging

4. **Product Thinking:**
   - User needs analysis
   - Feature prioritization
   - MVP development
   - Iteration based on feedback

---

## Resources & References

### Documentation
- [Next.js Docs](https://nextjs.org/docs)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Marker API Docs](https://documentation.datalab.to/)
- [Turndown Docs](https://github.com/mixmark-io/turndown)

### Inspiration
- [iLovePDF](https://www.ilovepdf.com/) - UI/UX reference
- [Smallpdf](https://smallpdf.com/) - Feature ideas
- [PDF24](https://www.pdf24.org/) - Tool organization

### Tools
- [Vercel](https://vercel.com/) - Hosting
- [GitHub](https://github.com/) - Version control
- [Cursor](https://cursor.sh/) - IDE

---

## Contact & Feedback

- **GitHub Repository:** [Your repo URL]
- **Issues:** [Your issues URL]
- **Developer:** CS Student, First Year
- **Purpose:** Learning project + personal tool

---

## Project Status

**Current Phase:** Planning Complete ✓
**Next Step:** Begin Phase 2 (Core UI Implementation)
**Estimated Completion:** 7 days from start
**Last Updated:** 2025-11-10

---

## Notes

- Keep it simple - don't over-engineer
- Privacy first - no data collection
- Learn as you go - document learnings
- Ship fast - iterate based on usage
- Have fun - it's a hobby project!

---

**Ready to start implementation!** 🚀
