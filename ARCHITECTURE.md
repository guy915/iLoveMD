# Architecture Documentation

## System Overview

AI Doc Prep is a client-heavy web application built with Next.js that processes documents for LLM consumption. Most processing happens client-side for privacy and cost efficiency, with API routes used only when necessary.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Client (Browser)                  │
│  ┌──────────────────────────────────────────────┐  │
│  │         React Components (Next.js)            │  │
│  │  - File uploads                               │  │
│  │  - User interactions                          │  │
│  │  - Client-side processing (HTML, Merge)      │  │
│  └──────────────┬───────────────────────────────┘  │
│                 │                                    │
│  ┌──────────────▼───────────────────────────────┐  │
│  │          localStorage                         │  │
│  │  - API keys                                   │  │
│  │  - User preferences                           │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────┬───────────────────────────────────┘
                  │
                  │ (Only for PDF & URL fetching)
                  │
┌─────────────────▼───────────────────────────────────┐
│            Next.js API Routes (Server)              │
│  ┌──────────────────────────────────────────────┐  │
│  │  /api/marker     - Proxy to Marker API       │  │
│  │  /api/fetch-url  - Fetch URLs (CORS bypass)  │  │
│  └──────────────┬───────────────────────────────┘  │
└─────────────────┼───────────────────────────────────┘
                  │
        ┌─────────┴──────────┐
        │                    │
┌───────▼────────┐  ┌────────▼─────────┐
│  Marker API    │  │  External URLs   │
│  (Datalab.to)  │  │  (Web scraping)  │
└────────────────┘  └──────────────────┘
```

## Processing Flows

### PDF to Markdown Flow

```
1. User uploads PDF
   ├─ Client validates file (type, size)
   └─ File stored temporarily in memory

2. User configures options
   └─ Options stored in component state

3. User clicks "Convert"
   ├─ Create FormData with file + options + API key
   ├─ POST to /api/marker
   │
   ├─ API Route receives request
   │  ├─ Extract file, options, API key
   │  ├─ Build Marker API request
   │  ├─ Forward to Marker API
   │  ├─ Wait for response (may take minutes)
   │  └─ Return result to client
   │
   └─ Client receives result
      ├─ Display success message
      └─ Trigger file download
```

### HTML to Markdown Flow (File Upload)

```
1. User uploads HTML file
   └─ File read into memory (FileReader API)

2. Client-side preprocessing
   ├─ Remove scripts, styles, nav, ads
   ├─ Extract main content (Readability.js)
   └─ Normalize whitespace

3. Client-side conversion
   ├─ Convert HTML → Markdown (Turndown.js)
   └─ Configure tables, code blocks, lists

4. Download result
   └─ No server involved - entirely client-side
```

### HTML to Markdown Flow (URL)

```
1. User pastes URL
   └─ Validate URL format

2. Fetch HTML content
   ├─ POST to /api/fetch-url (CORS bypass)
   ├─ API Route fetches URL
   └─ Returns HTML to client

3. Same as file upload flow
   ├─ Client-side preprocessing
   ├─ Client-side conversion
   └─ Download result
```

### Merge Markdowns Flow

```
1. User uploads multiple MD files
   └─ Files read into memory (FileReader API)

2. User reorders files (optional)
   └─ Drag and drop updates order array

3. User configures merge options
   └─ Separator style, TOC, etc.

4. Client-side processing
   ├─ Concatenate files in order
   ├─ Add separators between files
   ├─ Generate TOC if requested
   └─ No server involved

5. Download result
   └─ Trigger download of merged file
```

## State Management

### Component-Level State

Each tool page manages its own state independently:

```javascript
// Example: PDF tool state
{
  // Temporary state (lost on page reload)
  file: File | null,
  processing: boolean,
  status: 'idle' | 'processing' | 'success' | 'error',
  result: string | null,
  error: string | null,

  // Persistent state (stored in localStorage)
  apiKey: string,
  options: {
    paginate: boolean,
    useLLM: boolean,
    forceOCR: boolean,
    mode: 'fast' | 'accurate',
    outputFormat: 'markdown' | 'json' | 'html' | 'chunks',
    pageRange: string,
    maxPages: number
  }
}
```

### localStorage Schema

```javascript
{
  // API Keys
  "markerApiKey": "string",

  // Tool Preferences
  "pdfOptions": {
    "paginate": false,
    "useLLM": false,
    "forceOCR": false,
    "mode": "accurate",
    "outputFormat": "markdown"
  },

  "htmlOptions": {
    "preserveImages": true,
    "preserveLinks": true
  },

  "mergeOptions": {
    "separatorStyle": "pageBreak",
    "generateTOC": false,
    "ordering": "upload"
  },

  // UI Preferences
  "theme": "system" | "light" | "dark"
}
```

## Component Architecture

### Layout Hierarchy

```
RootLayout
├── Header
│   ├── Logo (link to home)
│   ├── Navigation
│   │   ├── NavLink (PDF to MD)
│   │   ├── NavLink (HTML to MD)
│   │   ├── NavLink (Merge MD)
│   │   ├── NavLink (Help)
│   │   └── NavLink (About)
│   └── ThemeToggle
│
├── Page Content (varies by route)
│
└── Footer
    ├── Copyright
    └── Links
```

### Tool Page Structure

```
ToolPage
├── ToolHeader
│   ├── Title
│   └── Description
│
├── FileUploadArea
│   ├── DragDropZone
│   ├── FileInput
│   └── SelectedFileDisplay
│
├── OptionsPanel
│   ├── ApiKeyInput (if needed)
│   ├── ToggleSwitches
│   ├── RadioButtons
│   └── TextInputs
│
├── ProcessButton
│   └── (disabled when invalid state)
│
└── StatusDisplay
    ├── StatusMessage
    ├── ProgressBar (when processing)
    └── DownloadButton (when complete)
```

## API Routes

### /api/marker

**Purpose:** Proxy requests to Marker API

**Method:** POST

**Input:**
```javascript
FormData {
  file: File,
  apiKey: string,
  options: JSON string
}
```

**Processing:**
1. Extract form data
2. Validate inputs
3. Build Marker API request
4. Forward to Marker API with user's API key
5. Wait for response
6. Return result

**Output:**
```javascript
{
  success: boolean,
  data?: string,      // Converted markdown/json/html
  error?: string
}
```

**Error Handling:**
- Invalid API key → 401
- File too large → 413
- Marker API error → 502
- Timeout → 504

### /api/fetch-url

**Purpose:** Fetch HTML content from URL (bypass CORS)

**Method:** POST

**Input:**
```javascript
{
  url: string
}
```

**Processing:**
1. Validate URL
2. Fetch content with User-Agent header
3. Return HTML

**Output:**
```javascript
{
  success: boolean,
  html?: string,
  error?: string
}
```

**Error Handling:**
- Invalid URL → 400
- Fetch failed → 502
- Timeout → 504

## Client-Side Processing

### HTML Processing Pipeline

```javascript
// 1. Clean HTML
cleanHTML(html)
├─ Remove <script>, <style>
├─ Remove navigation, footer, ads
├─ Extract main content (Readability)
└─ Normalize whitespace

// 2. Convert to Markdown
convertToMarkdown(cleanedHTML, options)
├─ Use Turndown.js
├─ Configure: tables, codeBlocks, lists
├─ Preserve images (optional)
└─ Preserve links (optional)

// 3. Download
downloadFile(markdown, filename)
```

### Merge Processing Pipeline

```javascript
// 1. Read files
readFiles(files)
└─ Use FileReader API for each file

// 2. Order files
orderFiles(files, ordering)
├─ 'upload' → keep as-is
├─ 'alphabetical' → sort by name
└─ 'custom' → use drag-drop order

// 3. Merge
mergeFiles(orderedFiles, options)
├─ Add separators between files
├─ Generate TOC (optional)
└─ Combine into single string

// 4. Download
downloadFile(merged, filename)
```

## File Handling

### Upload Validation

```javascript
validateFile(file, type)
├─ Check file type (MIME type + extension)
├─ Check file size (max 1GB)
├─ Check file exists
└─ Return validation result
```

### Download Mechanism

```javascript
downloadFile(content, filename)
├─ Create Blob from content
├─ Create object URL
├─ Create temporary <a> element
├─ Trigger click
└─ Cleanup object URL
```

## Security Considerations

### API Key Storage
- Keys stored in localStorage (browser-based)
- Never sent to our servers (only to external APIs)
- User responsible for key security
- Clear instructions about key privacy

### File Processing
- Files processed in-memory (not saved)
- No server-side storage
- Immediate cleanup after processing

### CORS Handling
- URL fetching done server-side
- Prevents client-side CORS issues
- Adds proper User-Agent headers

### Input Validation
- File type validation
- File size limits
- URL validation
- API key format validation

## Performance Considerations

### Large File Handling
- FileReader for client-side files
- Streaming for API uploads (if supported)
- Progress indicators for long operations
- Memory cleanup after processing

### Code Splitting
- Each route loaded on demand
- Component-level code splitting
- Dynamic imports for heavy libraries

### Optimization
- Image optimization (Next.js Image)
- Font optimization (Next.js Font)
- Minimal external dependencies
- Tree-shaking enabled

## Error Handling Strategy

### Error Types
1. **Validation Errors** - User input issues
2. **Network Errors** - API/fetch failures
3. **Processing Errors** - Conversion failures
4. **System Errors** - Out of memory, etc.

### Error Display
- User-friendly messages
- Actionable suggestions
- Technical details in console
- No stack traces to users

### Recovery
- Allow retry without reload
- Clear error state
- Preserve user inputs
- Suggest alternative options

## Testing Strategy

### Unit Tests
- Utility functions
- Processing logic
- Validation functions

### Integration Tests
- API route functionality
- Component interactions
- localStorage operations

### E2E Tests
- Complete user flows
- File upload/download
- Error scenarios

### Manual Testing
- Cross-browser testing
- Mobile responsiveness
- Large file handling
- Edge cases

## Deployment Architecture

### Vercel Deployment

```
GitHub Repository
      ↓
  (git push)
      ↓
Vercel Build Pipeline
├─ Install dependencies
├─ Build Next.js app
├─ Optimize assets
└─ Deploy to CDN

Deployed Application
├─ Static pages (cached)
├─ API routes (serverless functions)
└─ Assets (CDN)
```

### Environment
- **Node.js Runtime:** 18.x
- **Build Command:** `npm run build`
- **Output Directory:** `.next`
- **Serverless Functions:** Automatic from API routes

## Monitoring & Debugging

### Client-Side
- Console logging (development)
- Error boundaries (React)
- Network tab inspection

### Server-Side
- Vercel function logs
- Error tracking (optional)
- API response logging

## Scalability Considerations

### Current Limitations
- Browser memory (client-side processing)
- API rate limits (Marker API)
- Serverless function timeout (Vercel: 10s free, 60s pro)

### Future Improvements
- WebWorkers for heavy processing
- Chunked file processing
- Queue system for batch operations
- Caching strategies

## Dependencies

### Core
- `next` - Framework
- `react`, `react-dom` - UI library
- `tailwindcss` - Styling

### Processing
- `turndown` - HTML → Markdown
- `@mozilla/readability` - Content extraction

### Utilities
- (Add as needed during implementation)

## Browser Compatibility

### Required Features
- ES6+ support
- FileReader API
- FormData API
- Fetch API
- localStorage API
- Blob API

### Fallbacks
- None (modern browsers required)
- Graceful degradation messages for old browsers
