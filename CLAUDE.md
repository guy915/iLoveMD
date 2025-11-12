# AI Doc Prep - Claude Context File

---

## Project Overview

**Name:** AI Doc Prep
**Type:** Web application for preparing documents for LLMs
**Status:** Planning complete, ready for implementation
**Timeline:** ~1 week build
**Developer:** First-year CS student, low web dev experience

### What It Does

Converts documents to markdown (optimized for LLMs) with 3 tools:
1. **PDF → Markdown** - Uses Marker API (user's key)
2. **HTML → Markdown** - Client-side processing (Turndown.js)
3. **Merge Markdowns** - Combines multiple .md files

### Key Philosophy
- **Privacy first:** No data storage, no accounts, no tracking
- **User's API keys:** We provide interface, they pay for services
- **Client-heavy:** Most processing in browser
- **Simple:** Single-purpose tools, no complex pipelines
- **Free:** Hosted on Vercel free tier

---

## Tech Stack

```
Framework:     Next.js 14+ (App Router)
Styling:       Tailwind CSS
Language:      JavaScript (NOT TypeScript)
State:         Component-level + localStorage + React Context (LogContext)
Hosting:       Vercel (free)
Domain:        ai-doc-prep.vercel.app
```

### External Dependencies
- `turndown` - HTML to Markdown conversion
- `@mozilla/readability` - HTML content extraction
- Marker API (Datalab.to) - PDF to Markdown (user's key)

---

## Current Status

**Check CHECKLIST.md for exact progress**

Current phase: **Phase 2 Complete**
Next task: **Phase 3 - PDF to Markdown Tool**

---

## Development API Keys

**Test Marker API Key:** `w4IU5bCYNudH_JZ0IKCUIZAo8ive3gc6ZPk6mzLtqxQ`

**Currently hardcoded in:**
- `src/app/pdf-to-markdown/page.js` (line 11) - Hardcoded in `useState` default value

**⚠️ CRITICAL TODO BEFORE PRODUCTION:**
- **Remove hardcoded API key** from pdf-to-markdown/page.js
- Change from: `useState('w4IU5bCYNudH_JZ0IKCUIZAo8ive3gc6ZPk6mzLtqxQ')`
- Change to: `useState('')` (empty string)
- Ensure users are prompted to enter their own API key
- Add validation that prevents conversion without user-provided key
- Update UI to show "Get API Key" link prominently

---

## Project Structure

```
ai-doc-prep/
├── src/
│   ├── app/                    # Pages (Next.js App Router)
│   │   ├── page.js            # Homepage with 3 tiles
│   │   ├── layout.js          # Root layout (Header/Footer)
│   │   ├── not-found.js       # 404 page with logging
│   │   ├── loading.js         # Global loading state
│   │   ├── pdf-to-markdown/   # PDF tool page
│   │   ├── html-to-markdown/  # HTML tool page
│   │   ├── merge-markdown/    # Merge tool page
│   │   ├── help/              # Help/FAQ page
│   │   ├── about/             # About page
│   │   └── api/               # API routes
│   │       ├── marker/        # Proxy to Marker API
│   │       └── fetch-url/     # Fetch HTML (CORS bypass)
│   │
│   ├── components/
│   │   ├── layout/            # Header, Footer, GlobalDiagnosticPanel
│   │   ├── common/            # Button, FileUpload, ErrorBoundary, etc.
│   │   ├── home/              # ToolTile
│   │   └── tools/             # Tool-specific components
│   │
│   ├── contexts/
│   │   └── LogContext.js      # Global diagnostic logging context
│   │
│   ├── lib/
│   │   ├── processors/        # Business logic for each tool
│   │   ├── api/               # API client functions
│   │   ├── utils/             # File handling, downloads
│   │   └── storage/           # localStorage wrapper
│   │
│   └── hooks/
│       └── useLocalStorage.js # Custom hook for persistence
│
├── assets/
│   ├── test/                  # Test files for development
│   │   └── sample.pdf         # Minimal test PDF (572 bytes)
│   └── README.md              # Assets documentation
│
└── [Documentation files listed below]
```

---

## Key Documentation Files

When you need details, reference these:

| File | Purpose | When to Read |
|------|---------|--------------|
| **CHECKLIST.md** | Progress tracker | Start of every session to see status |
| **IMPLEMENTATION_GUIDE.md** | Step-by-step code | When implementing features |
| **ARCHITECTURE.md** | Technical design | When unclear about data flow |
| **DESIGN_SYSTEM.md** | UI/UX specs | When styling components |
| **PROJECT_PLAN.md** | Master plan | When need big picture |
| **README.md** | User-facing docs | When writing help content |

---

## Architecture Quick Reference

### Data Flows

**PDF Tool:**
```
Client → /api/marker → Marker API → Result → Download
```

**HTML Tool (File):**
```
Client → Process locally (Turndown.js) → Download
```

**HTML Tool (URL):**
```
Client → /api/fetch-url → Fetch HTML → Process locally → Download
```

**Merge Tool:**
```
Client → Process locally → Download
```

### State Management

**Component-level state:** File, processing status, errors
**localStorage:** API keys, user preferences
**No global state:** Each tool page is independent

### localStorage Schema
```javascript
{
  "markerApiKey": "string",
  "pdfOptions": { paginate, useLLM, forceOCR, mode, outputFormat },
  "htmlOptions": { preserveImages, preserveLinks },
  "mergeOptions": { separatorStyle, generateTOC, ordering }
}
```

**Note:** Light mode only - dark mode removed for simplicity.

---

## Implementation Phases

1. **Phase 1 (Day 1):** Project setup - Next.js, dependencies, structure
2. **Phase 2 (Day 1-2):** Core UI - Header, Footer, Homepage, reusable components
3. **Phase 3 (Day 2-3):** PDF tool - API route + tool page
4. **Phase 4 (Day 3-4):** HTML tool - URL fetching + processing
5. **Phase 5 (Day 4-5):** Merge tool - Multi-file handling
6. **Phase 6 (Day 5-7):** Polish - Help/About pages, testing, deploy

**Always check CHECKLIST.md for task-level breakdown**

---

## Common Commands

```bash
# Development
npm run dev              # Start dev server (localhost:3000)
npm run build           # Build for production
npm run start           # Run production build

# Git workflow
git status              # Check current state
git add .               # Stage changes
git commit -m "msg"     # Commit
git push                # Push to branch

# Deployment (after GitHub push)
# Just connect repo to Vercel dashboard - auto-deploys
```

---

## Key Design Decisions

### Why Next.js?
- Student is learning, needs good docs
- App Router for modern patterns
- API routes for proxying external APIs
- Vercel deployment is seamless

### Why Client-side Processing?
- **Privacy:** Files never leave user's browser
- **Cost:** No server compute costs
- **Speed:** Instant for HTML/Merge tools

### Why User's API Keys?
- **Cost:** Free for student, no API bills
- **Privacy:** Keys stored locally, never on our servers
- **Simple:** No auth/payment systems needed

### Why localStorage?
- **Persistence:** Saves preferences between sessions
- **No backend:** No database needed
- **Simple:** Built-in browser API

---

## Important Constraints

### Technical
- **File size limit:** 1GB per file (browser memory)
- **Browser support:** Modern only (Chrome/Firefox/Safari latest)
- **No TypeScript:** Student preference, keep it simple
- **No complex state:** Keep it component-level

### Design
- **Minimal UI:** Functional over flashy
- **iLovePDF-inspired:** Tile layout, simple flows
- **Light mode only:** No dark mode (simplified for now)
- **Mobile:** Desktop first, mobile eventually

### User Experience
- **No accounts:** Everything anonymous
- **No tracking:** No analytics, no cookies (except localStorage)
- **Fast feedback:** Show status for all operations
- **Clear errors:** User-friendly messages, actionable

---

## Testing Before Pushing Code

**CRITICAL: Always test changes before committing and pushing to GitHub.**

### Pre-Push Testing Checklist

Run these tests in order before every push:

#### 1. Build & Lint Check (Required)
```bash
npm run build    # Must pass without errors
npm run lint     # Check for code quality issues
```

#### 2. Development Server Test (Required)
```bash
npm run dev      # Start in background
# Wait 3-5 seconds for server to start
```

#### 3. API Endpoint Testing with curl (If applicable)

**Test API routes locally:**
```bash
# Test POST endpoints
curl -X POST http://localhost:3000/api/marker \
  -F "file=@assets/test/sample.pdf" \
  -F "apiKey=test_key" \
  -w "\nHTTP: %{http_code}\n"

# Test GET endpoints
curl http://localhost:3000/api/marker?param=value \
  -H "x-api-key: test_key"
```

**Test external APIs directly:**
```bash
# Test if external API is reachable and working
curl -X POST https://www.datalab.to/api/v1/marker \
  -H "X-Api-Key: YOUR_KEY" \
  -F "file=@assets/test/sample.pdf" \
  -F "output_format=markdown" \
  -w "\nHTTP: %{http_code}\n"
```

#### 4. Response Structure Validation

**Check response format:**
- Verify JSON structure matches expected format
- Confirm success/error flags are present
- Check all required fields exist
- Validate error messages are user-friendly

#### 5. Code Cleanup & Refactoring (Required)

**Before committing, clean up the code:**

**Remove clutter:**
- Delete unused imports, variables, functions
- Remove commented-out code blocks
- Clean up debug statements (console.log, etc.)
- Remove temporary test code

**Refactor for clarity:**
- Extract repeated code into reusable functions
- Simplify complex conditionals
- Improve variable/function names for clarity
- Break down large functions into smaller ones

**Optimize performance:**
- Remove unnecessary re-renders (React)
- Optimize database queries or API calls
- Reduce bundle size where possible
- Cache expensive computations

**Code hygiene:**
- Consistent formatting (let Prettier handle this)
- Add missing error handling
- Ensure proper async/await usage
- Validate all user inputs

**Quick checks:**
```bash
# Find debug code left behind
grep -r "console.log" src/ --exclude-dir=node_modules

# Check for TODO/FIXME comments
grep -r "TODO\|FIXME" src/ --exclude-dir=node_modules
```

#### 6. Documentation Updates (Required)

**Before committing, ensure all docs are updated:**
- [ ] CHECKLIST.md - Mark completed tasks
- [ ] CHANGELOG.md - Document changes made
- [ ] CLAUDE.md - Update if workflow/structure changed
- [ ] Code comments - Add/update as needed
- [ ] README files - Update if features changed

### What Can Be Tested

**✓ Can Test:**
- Build/compilation errors
- Lint errors and warnings
- Local API routes (localhost)
- External API accessibility
- Response formats and structures
- File operations
- Code logic and structure

**✗ Cannot Test:**
- Browser UI interactions (no Selenium)
- Visual appearance
- Client-side JavaScript execution
- Full end-to-end user flows
- Download behavior in browser

### Testing Workflow Example

```bash
# 1. Build check
npm run build

# 2. Start dev server
npm run dev &
sleep 5

# 3. Test API endpoint
curl -X POST http://localhost:3000/api/marker \
  -F "file=@assets/test/sample.pdf" \
  -F "apiKey=test"

# 4. Check logs for errors
# Review terminal output

# 5. Code cleanup check
grep -r "console.log" src/ --exclude-dir=node_modules
grep -r "TODO\|FIXME" src/ --exclude-dir=node_modules
# Review code for refactoring opportunities

# 6. Update documentation
# Update CHECKLIST.md, CLAUDE.md, CHANGELOG.md, etc.

# 7. If all good, commit
git add .
git commit -m "Descriptive message"
git push
```

### Error Response Checklist

When testing APIs, verify:
- [ ] 400 errors return helpful messages
- [ ] 401/403 errors indicate auth issues
- [ ] 500 errors are caught and logged
- [ ] Error details are included for debugging
- [ ] Success responses have consistent structure

### When to Skip User Testing

Only push without user browser testing if:
- Documentation-only changes
- Build configuration changes
- Code comments/formatting
- Non-functional changes

**For any functional code changes, user should test in browser after push.**

---

## What to Do When Starting a Session

1. **Read CHECKLIST.md** - See current progress
2. **Check last "Notes & Issues" section** - Understand any blockers
3. **Reference IMPLEMENTATION_GUIDE.md** - Get phase-specific code
4. **Reference DESIGN_SYSTEM.md** - For styling/components
5. **Ask user:** "Should we continue where you left off, or...?"

---

## What NOT to Do

**Don't use TypeScript** - Project is JavaScript only
**Don't add complex state management** - Keep it simple
**Don't store files server-side** - Everything client/proxy only
**Don't add features not in plan** - Ask user first
**Don't use our API keys** - Users provide their own
**Don't add authentication** - No accounts by design
**Don't add analytics** - Privacy-first approach
**Don't over-engineer** - This is a learning project, keep it simple
**Don't use emojis** - No emojis in code, documentation, or UI elements
**Don't skip testing** - Always run build/lint and test APIs before pushing
**Don't skip documentation updates** - Update all relevant docs with every change

---

## Code Style Preferences

### Component Structure
```javascript
'use client'  // When needed
import { useState } from 'react'
import useLocalStorage from '@/hooks/useLocalStorage'

export default function ComponentName() {
  // State
  const [localState, setLocalState] = useState(null)
  const [storedValue, setStoredValue] = useLocalStorage('key', defaultValue)

  // Handlers
  const handleAction = () => { }

  // Render
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Content */}
    </div>
  )
}
```

### Styling
- **Use Tailwind classes** - No custom CSS unless necessary
- **Responsive:** Use `md:` and `lg:` breakpoints
- **Dark mode:** Use `dark:` variant classes
- **Spacing:** Follow 4px base unit (gap-4, p-6, etc.)
- **No Emojis:** Never use emojis in code, UI, or documentation - use text labels instead

### File Naming
- **Components:** PascalCase (e.g., `Button.js`)
- **Utilities:** camelCase (e.g., `downloadUtils.js`)
- **Pages:** lowercase (e.g., `page.js`)
- **Hooks:** camelCase with 'use' prefix (e.g., `useLocalStorage.js`)

---

## Testing Approach

### Manual Testing Priority
1. **Happy path:** Each tool with normal files
2. **Edge cases:** Large files, empty files, invalid inputs
3. **Error scenarios:** No API key, network errors, invalid files
4. **Responsive:** Mobile/tablet/desktop
5. **Cross-browser:** Chrome, Firefox, Safari

### Test Files Available
**In Repository (assets/test/):**
- `sample.pdf` - Minimal test PDF (572 bytes, 1 page) for quick testing

**Additional Test Files Needed:**
- Small PDF (~1MB)
- Large PDF (~100MB)
- Scanned PDF (for OCR testing)
- Simple HTML file
- Complex website URL
- Multiple markdown files

### Quick Testing
```bash
# Use the included sample PDF for quick testing
# Location: /assets/test/sample.pdf
# This is a minimal valid PDF for development testing
```

---

## Helpful Context

### Student's Background
- **First-year CS student**
- **Low web dev experience** - Be clear and educational
- **Comfortable with:** Git, basic JavaScript
- **Learning:** React, Next.js, web architecture
- **Mac user, Cursor IDE**

### Project Goals
1. **Learning:** Understand modern web development
2. **Utility:** Actually use this tool personally
3. **Portfolio:** Demonstrate skills
4. **Simple:** Don't over-complicate

### Timeline
- **Target:** ~1 week from start to deployment
- **No pressure:** This is a hobby project
- **Flexible:** Can extend if needed

---

## Quick Troubleshooting

**"Module not found" error:**
- Check imports use `@/` alias
- Verify file exists in correct directory
- Run `npm install` if package missing

**"Hydration error" in Next.js:**
- Add `'use client'` directive
- Check for SSR issues with localStorage
- Ensure no mismatched HTML

**File upload not working:**
- Check MIME types in accept attribute
- Verify file size validation
- Test FormData construction

**API route 404:**
- Verify route.js naming (not route.ts)
- Check it's in app/api/ directory
- Restart dev server

**Tailwind classes not applying:**
- Check tailwind.config.js content paths
- Verify globals.css has @tailwind directives
- Restart dev server

---

## When User Says...

**"Let's continue"** → Read CHECKLIST.md, find current phase, continue
**"Start Phase X"** → Read relevant section of IMPLEMENTATION_GUIDE.md
**"How do I style this?"** → Reference DESIGN_SYSTEM.md
**"Why did we decide X?"** → Check PROJECT_PLAN.md or ARCHITECTURE.md
**"It's not working"** → Debug systematically, check console errors
**"Let's add a feature"** → Discuss if it fits scope, update docs if yes

---

## Feature Implementation Workflow

**IMPORTANT: After completing ANY feature or phase, ALWAYS update documentation in this order:**

1. **Update CHECKLIST.md**
   - Mark completed tasks with [x]
   - Update phase status
   - Add notes in "Notes & Issues" section
   - Update footer with current phase

2. **Update CHANGELOG.md**
   - Add all changes under appropriate version/phase
   - List what was Added, Changed, Fixed, or Removed
   - Include technical decisions and testing results
   - Update phase milestones

3. **Update CLAUDE.md** (if needed)
   - Update "Current Status" section
   - Update "Next Action" at footer
   - Add any new patterns or decisions to relevant sections

4. **Update PROJECT_PLAN.md** (if needed)
   - Mark implementation phases as complete
   - Update project status

5. **Commit and Push**
   - Commit code changes first
   - Then commit documentation updates
   - Push all changes to branch

**Never skip documentation updates!** It ensures continuity between sessions.

---

## CI/CD Pipeline Maintenance

**IMPORTANT: Keep CI/CD workflows up to date as features are added.**

### When to Update CI/CD

Update `.github/workflows/` when:
- **New test commands added** - Add to CI workflow
- **New build steps required** - Update build job
- **New dependencies with security implications** - Update security audit
- **New file types or directories** - Update relevant checks
- **Performance-critical code added** - Consider bundle size checks
- **New API endpoints created** - Add endpoint testing if applicable

### CI/CD Update Checklist

When adding features, ask yourself:
- [ ] Does this need to be tested in CI? (new scripts, builds, etc.)
- [ ] Should this be part of the security audit? (new dependencies, APIs)
- [ ] Does this affect bundle size? (large libraries, heavy dependencies)
- [ ] Are there new patterns to lint for? (code quality checks)
- [ ] Should this block merges if it fails? (critical vs informational)

### Example Updates

**Adding a new tool:**
- Update code quality checks to scan new directories
- Add any new secret patterns to detect
- Update bundle size baseline if significantly changed

**Adding external API:**
- Add API key pattern to secret detection
- Consider adding API accessibility test
- Document any rate limits or testing concerns

---

## Diagnostic Logging Maintenance

**IMPORTANT: Maintain comprehensive logging as features are added.**

### Purpose: Logs Are For Claude (AI Assistant)

**The diagnostic logging system is primarily a tool for Claude (the AI assistant) to debug issues effectively.**

While users can view the logs, the primary purpose is to give Claude complete visibility into:
- What the user did (step by step)
- What the application did in response
- Where and why things failed
- Timing and performance of operations

**For the user:** Logs provide some transparency, but are mainly useful for copying/pasting to Claude when asking for help.

**For Claude:** Logs are the primary debugging tool - they replace the inability to see the browser console, network tab, or application state directly.

**Important:** Claude should feel free to continue developing and enhancing the logging system based on their own preferences and debugging needs. Add whatever logs, timing information, or context would be most helpful for diagnosing issues. The logging system is yours to evolve as features are added.

### Logging Philosophy

**Log EVERYTHING** - Every user interaction, every state change, every error.

The diagnostic logging system exists to:
- **Trace user actions** - Know exactly what the user did before an error
- **Debug issues faster** - See the full context of what happened
- **Monitor application flow** - Understand how features are being used
- **Catch edge cases** - Identify unexpected behaviors early
- **Enable remote debugging** - Give Claude eyes into what's happening in the user's browser

### What to Log

**ALWAYS log these events:**

**User Interactions:**
- Button clicks (with button label/purpose)
- Link clicks (with destination)
- Form submissions (with form identifier)
- File uploads (with file metadata: name, size, type)
- Drag-and-drop events
- Modal/dialog opens and closes
- Tab/section switches
- Settings changes

**Application State:**
- Component mounts (page loads)
- Route changes (navigation)
- API calls (request + response)
- Data validation (success and failures)
- localStorage operations (reads/writes)
- File operations (downloads, conversions)

**Errors and Warnings:**
- Validation errors (with context)
- API errors (with status codes and messages)
- File processing errors (with file details)
- Network errors (with endpoint and error)
- Unexpected states (edge cases)
- React errors (via ErrorBoundary)

### How to Add Logging

**For client components:**
```javascript
'use client'
import { useLogs } from '@/contexts/LogContext'

export default function MyComponent() {
  const { addLog } = useLogs()

  const handleClick = () => {
    addLog('info', 'Button clicked: My Action')
    // ... rest of handler
  }

  useEffect(() => {
    addLog('info', 'MyComponent mounted')
  }, [addLog])

  return (...)
}
```

**For API routes:**
```javascript
// Log in the API route handler
console.log('[API] /api/my-endpoint - Request received', { params })
// These will show in server logs and can be viewed during development
```

### Logging Standards

**Log types:**
- `'info'` - Normal operations, user actions, state changes
- `'success'` - Successful completions, validations passed
- `'error'` - Errors, failures, validation failures

**Log messages:**
- Be descriptive and specific
- Include action and context
- Use present tense ("Button clicked", not "Button was clicked")
- Include identifiers when relevant

**Log data:**
- Include relevant context as second parameter
- Sanitize sensitive information (API keys, passwords)
- Keep objects small (don't log massive responses)
- Use structured data for better readability

**Examples:**
```javascript
// Good
addLog('info', 'File selected for upload', {
  name: file.name,
  size: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
  type: file.type
})

// Bad
addLog('info', 'File selected')
```

### Logging Checklist for New Features

When adding a feature, ensure you log:
- [ ] Component mount (page load)
- [ ] All user interactions (clicks, inputs, submissions)
- [ ] All state changes (data updates, mode switches)
- [ ] All API calls (request + response summary)
- [ ] All validation events (success and failures)
- [ ] All errors and edge cases
- [ ] All file operations (if applicable)
- [ ] All navigation (if feature changes routes)

**Never assume something is too small to log.** The goal is comprehensive traceability.

---

## Session Handoff

**At end of each session:**
1. Complete Feature Implementation Workflow (above)
2. Verify all changes committed and pushed
3. Ensure CHANGELOG.md is current
4. Leave clear notes for next session

**At start of next session:**
1. Read this file (CLAUDE.md)
2. Read CHECKLIST.md for status
3. Read latest CHANGELOG.md entries
4. Check Notes section for context
5. Ask user where to continue

---

## Remember

- **Simplicity is key** - Don't over-engineer
- **Privacy matters** - No data storage/tracking
- **Education focus** - Explain decisions to student
- **User's in control** - Ask before major changes
- **Have fun** - It's a learning project!

---

**Last Updated:** 2025-11-10
**Current Status:** Phase 2 complete, ready for Phase 3
**Next Action:** Build PDF to Markdown tool
