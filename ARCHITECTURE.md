# Architecture Documentation

## System Overview

iLoveLLM is a client-heavy web application built with Next.js that processes documents for LLM consumption. Most processing happens client-side for privacy and cost efficiency, with API routes used only when necessary. 

## Tech Stack Decisions

| Technology | Choice |
|------------|--------|
| Framework | Next.js 14 (App Router) |
| Styling | Tailwind CSS |
| Languages | JavaScript + TypeScript + CSS + HTML |
| Hosting | Vercel |
| State | Component-level + localStorage + React Context |
| PDF Conversion | Marker API |

## Draft Project Structure

```
ilovellm/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # Root layout with diagnostic logging
│   │   ├── page.tsx            # Homepage with tool tiles
│   │   ├── pdf-to-markdown/    # PDF tool (complete)
│   │   ├── merge-markdown/     # Markdown merge tool
│   │   ├── loading.tsx         # Global loading state
│   │   ├── not-found.tsx       # Custom 404 page
│   │   └── api/
│   │       └── marker/         # Proxy to Marker API
│   ├── components/             # React components
│   │   ├── layout/             # Header, Footer, GlobalDiagnosticPanel
│   │   ├── common/             # Button, FileUpload, ErrorBoundary
│   │   └── home/               # ToolTile
│   ├── contexts/               # React Context providers
│   │   └── LogContext.tsx      # Diagnostic logging context
│   ├── hooks/                  # Custom React hooks
│   │   ├── useFileSelection.ts       # File selection and validation logic
│   │   ├── useConversionWorkflow.ts  # PDF conversion workflow orchestration
│   │   └── useMergeMarkdown.ts       # Markdown merging logic
│   ├── lib/                    # Business logic
│   │   ├── constants.ts        # Centralized constants
│   │   ├── services/           # Business services
│   │   │   ├── storageService.ts          # localStorage abstraction
│   │   │   ├── markerApiService.ts        # Marker API client
│   │   │   ├── batchConversionService.ts  # Batch PDF conversion
│   │   │   ├── filenameService.ts         # Filename generation and conflict resolution
│   │   │   ├── fileValidationService.ts   # File validation and filtering
│   │   │   └── downloadService.ts         # File download with File System API
│   │   └── utils/              # Pure utility functions
│   │       ├── downloadUtils.ts  # File download helpers
│   │       ├── classNames.ts     # CSS class utilities
│   │       └── formatUtils.ts    # String formatting utilities
│   └── types/                  # TypeScript type definitions
│       └── index.ts            # Shared types
├── assets/                     # Test files and resources
├── public/                     # Static assets
└── README.md
```

## High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Client (Browser)                  │
│  ┌──────────────────────────────────────────────┐  │
│  │         React Components (Next.js)            │  │
│  │  - File uploads                               │  │
│  │  - User interactions                          │  │
│  │  - Client-side processing (Merge)            │  │
│  └──────────────┬───────────────────────────────┘  │
│                 │                                    │
│  ┌──────────────▼───────────────────────────────┐  │
│  │          localStorage                         │  │
│  │  - API keys                                   │  │
│  │  - User preferences                           │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────┬───────────────────────────────────┘
                  │
                  │ (Only for PDF)
                  │
┌─────────────────▼───────────────────────────────────┐
│            Next.js API Routes (Server)              │
│  ┌──────────────────────────────────────────────┐  │
│  │  /api/marker     - Proxy to Marker API       │  │
│  └──────────────┬───────────────────────────────┘  │
└─────────────────┼───────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────┐
│                   Marker API                        │
│                  (Datalab.to)                       │
└─────────────────────────────────────────────────────┘
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

## Client-Side Processing

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

## Modularity and Code Organization

### Architectural Layers

The application follows a layered architecture to improve modularity and separation of concerns:

```
┌─────────────────────────────────────────┐
│   Presentation Layer (React Components) │
│   - Page components (UI only)           │
│   - Reusable UI components              │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│   Custom Hooks Layer                    │
│   - Business logic orchestration        │
│   - State management                    │
│   - Side effects handling               │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│   Service Layer                         │
│   - Business operations                 │
│   - API communication                   │
│   - File operations                     │
│   - Data transformation                 │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│   Infrastructure Layer                  │
│   - External APIs (Marker, Gemini)      │
│   - Browser APIs (File System, Storage) │
│   - Third-party libraries               │
└─────────────────────────────────────────┘
```

### Custom Hooks Pattern

**Purpose**: Extract business logic from components to enable:
- Reusability across multiple components
- Easier testing (no need to render components)
- Better separation of concerns (UI vs. business logic)
- Improved readability and maintainability

**Current Hooks**:

1. **`useFileSelection`**
   - **Responsibility**: File selection, validation, and unique naming
   - **Used by**: PDF conversion and Markdown merge pages
   - **Features**: Type filtering, size validation, duplicate handling, folder detection
   - **Benefits**: Centralized file handling logic, consistent validation across tools

2. **`useConversionWorkflow`**
   - **Responsibility**: PDF to Markdown conversion workflow orchestration
   - **Used by**: PDF to Markdown page
   - **Features**: Mode switching (paid/free), batch processing, progress tracking, error handling
   - **Benefits**: Separates conversion logic from UI, enables testing conversion flows in isolation

3. **`useMergeMarkdown`**
   - **Responsibility**: Markdown file merging and management
   - **Used by**: Merge Markdown page
   - **Features**: File sorting, merging with separators, header insertion, validation
   - **Benefits**: Reusable merging logic, testable without UI

**Usage Example**:
```typescript
// Before (business logic in component)
export default function MyPage() {
  const [files, setFiles] = useState([])
  const [error, setError] = useState('')

  const handleFileSelect = (fileList: FileList) => {
    // 50+ lines of validation and state management
  }

  return <div>...</div>
}

// After (business logic in hook)
export default function MyPage() {
  const {
    files,
    error,
    handleFilesSelect,
    handleClearFiles
  } = useFileSelection({ fileType: 'pdf' })

  return <div>...</div>
}
```

### Service Layer Pattern

**Purpose**: Centralize business operations and domain logic outside of React components.

**Design Principles**:
- **Single Responsibility**: Each service handles one domain (files, downloads, validation)
- **Pure Functions**: Services are stateless and side-effect free when possible
- **Testability**: Easy to test without browser environment
- **Reusability**: Can be used by hooks, components, or other services

**Current Services**:

1. **`FilenameService`**
   - Generates unique filenames with numerical suffixes for duplicates
   - Detects folder names from file paths
   - Checks if files were renamed
   - **Example**: `document.pdf` → `document.md`, `document (1).md`, `document (2).md`

2. **`FileValidationService`**
   - Filters files by type (PDF, Markdown)
   - Validates file sizes (individual and batch)
   - Filters folder files (immediate vs. subfolders)
   - Validates file types and extensions
   - **Benefits**: Consistent validation rules, centralized file size limits

3. **`DownloadService`**
   - Handles file downloads with File System Access API
   - Provides fallback for browsers without File System API
   - Manages blob URLs and cleanup
   - **Example**: Download markdown files with "Save As" dialog when supported

4. **Existing Services**:
   - `markerApiService` - Marker API client for PDF conversion
   - `batchConversionService` - Batch PDF processing with concurrency control
   - `storageService` - localStorage abstraction for settings persistence

**Usage Example**:
```typescript
import { generateUniqueFilename } from '@/lib/services/filenameService'
import { validateFileSize } from '@/lib/services/fileValidationService'
import { downloadService } from '@/lib/services/downloadService'

// Generate unique name
const existingNames = new Set(['document.md', 'report.md'])
const filename = generateUniqueFilename(file, existingNames) // 'document (1).md'

// Validate size
const validation = validateFileSize(file, 100 * 1024 * 1024) // 100MB
if (!validation.valid) {
  console.error(validation.error)
}

// Download file
downloadService.downloadFile(content, 'output.md')
```

### Benefits of This Architecture

1. **Improved Testability**
   - Services can be tested in isolation without UI
   - Hooks can be tested with `renderHook` without full component rendering
   - 55 new service tests added with 100% coverage

2. **Reduced Component Complexity**
   - Pages focus on UI rendering and user interaction
   - Business logic moved to hooks and services
   - Easier to understand and maintain

3. **Better Reusability**
   - Services can be used across multiple components
   - Hooks can be composed together
   - No code duplication between similar features

4. **Easier Refactoring**
   - Changes to business logic don't require component changes
   - Service interfaces provide clear contracts
   - Type safety ensures correct usage

5. **Dependency Injection Ready**
   - Services can be easily mocked for testing
   - Hooks accept dependencies as parameters
   - Future: Can implement DI container if needed

### Future Improvements

**Phase 2 Candidates** (not yet implemented):
- Extract page components to use new hooks/services
- Implement repository pattern for API access
- Add strategy pattern for paid/free mode conversion
- Create domain models and value objects
- Implement error handling middleware

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

### Testing Framework

**Stack:**
- **Vitest** - Fast, modern test runner with native TypeScript/ESM support
- **@testing-library/react** - Component testing with user-centric queries
- **@testing-library/jest-dom** - DOM matchers for assertions
- **jsdom** - Browser environment simulation
- **MSW** - API mocking for integration tests

**Configuration:**
- Test files: `**/*.{test,spec}.{ts,tsx}`
- Environment: jsdom (browser APIs available)
- Coverage thresholds: 70% (statements, branches, functions, lines)
- Setup file: `src/test/setup.ts` (mocks localStorage, sessionStorage, URL APIs)

**Commands:**
```bash
npm test              # Watch mode
npm run test:ui       # Interactive UI
npm run test:run      # CI mode (single run)
npm run test:coverage # Generate coverage report
```

### Unit Tests
**Target: 80%+ coverage**
- Utility functions (`formatUtils`, `downloadUtils`, `classNames`)
- Service layer validation (`markerApiService`, `batchConversionService`)
- Storage abstraction (`storageService`)
- Type guards and validators

**Status:** Foundation established (classNames.test.ts implemented)

### Integration Tests
**Target: 70%+ coverage**
- API route functionality (`/api/marker` POST/GET handlers)
- Component interactions (Button, FileUpload, ErrorBoundary)
- localStorage operations (storageService with mocks)
- Context providers (LogContext)

**Status:** Framework configured, tests planned

### E2E Tests
**Target: Future implementation**
- Complete user flows (PDF upload → conversion → download)
- File upload/download workflows
- Error scenarios and recovery
- Cross-browser compatibility

**Recommended tool:** Playwright (better Next.js support than Cypress)

**Status:** Deferred until unit/integration coverage is established

### Manual Testing
- Cross-browser testing (Chrome, Firefox, Safari, Edge)
- Mobile responsiveness (iOS Safari, Chrome Android)
- Large file handling (edge cases, memory limits)
- Network failure scenarios

### CI/CD Integration

Tests run automatically on every PR and push:
- **Build jobs** (Node 18.x, 20.x): Run `npm run test:run` before build
- **Test coverage job**: Generates coverage report, uploads as artifact
- **Coverage retention**: 7 days for review and analysis

## Design System Summary

### Theme
- Clean, minimal design inspired by iLovePDF

### Color Palette
```
Primary:    #3b82f6 (blue-500) - Main actions, links
Success:    #10b981 (green-500) - Successful operations
Error:      #ef4444 (red-500) - Errors, warnings
Background: #ffffff - Page background
Surface:    #f9fafb (gray-50) - Cards, panels
Text:       #111827 (gray-900) - Primary text
Border:     #e5e7eb (gray-200) - Dividers
```

Full design details (typography, spacing, components) are defined in code via Tailwind CSS configuration and component implementations.

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
