# AI Doc Prep - Claude Context File

---

## Project Overview

**Name:** AI Doc Prep
**Type:** Web application for preparing documents for LLMs

### What It Does

Converts documents to markdown (optimized for LLMs) with 3 tools:
1. **PDF → Markdown** - Uses Marker API (user's key)
2. **HTML → Markdown** - Client-side processing (Turndown.js)
3. **Merge Markdowns** - Combines multiple .md files

---

## Session Management

### When Starting a Session

1. Read **all** documentation **fully**
2. Explore the codebase
3. Ask questions

Your first to-do's should be these steps (a session will begin with a system prompt, followed by an initial user request).

**IMPORTANT: Never skip session initialization steps!**

### When Finishing a Session

1. **Test Before Committing**
   - Run `npm run build` - Must pass without errors
   - Run `npm run lint` - Must pass without errors
   - Manual testing - Test the feature in browser (happy path + edge cases)
   - API testing (if applicable) - Test API routes work correctly

2. **Update Documentation**
   - Update CHANGELOG.md
   - Update CHECKLIST.md
   - Update README.md *(optional)*
   - Update ARCHITECTURE.md *(optional)*
   - Update CONTRIBUTING.md *(optional)*
   - Update CLAUDE.md *(optional)*

3. **Commit and Push**
   - Commit code changes first
   - Then commit documentation updates
   - Push all changes to branch
  
**IMPORTANT: Never skip session conclusion steps!**

---

## Development API Keys

**Test Marker API Key:** `w4IU5bCYNudH_JZ0IKCUIZAo8ive3gc6ZPk6mzLtqxQ`

**Currently hardcoded in:**
- `src/app/pdf-to-markdown/page.js` (line 11) - Pre-filled as default value in useState hook (not persisted between sessions)

---

## CI/CD Pipeline

The project has automated CI/CD workflows in `.github/workflows/`:
- **Build verification** on Node 18.x and 20.x
- **Security audits** for dependencies
- **Code quality checks** (console.log detection, bundle size)
- **PR labeling** and automation

When adding features with new dependencies, test commands, or API endpoints, consider updating the CI/CD workflows accordingly.

---

## Diagnostic Logging System

### What It Is

Website-wide logging panel that captures every user interaction, application event, and error across all pages. Think of it as Claude's eyes and ears into what's happening in the user's browser.

Logs are the primary debugging tool - they replace the inability to see the browser console, network tab, or application state directly. Claude should feel free to continue developing and enhancing the logging system based on debugging needs.

While users can view the logs, the primary purpose is to give Claude complete visibility into:
- What the user did (step by step)
- What the application did in response
- Where and why things failed
- Timing and performance of operations

### What It Logs

**Currently Tracked Events:**

**Navigation & Page Events:**
- Page loads and component mounts (Header, pages, tools)
- Navigation link clicks (header menu, logo clicks, tool tiles)
- Mobile menu toggles (open/close)
- Route changes and browser navigation
- 404 errors with pathname tracking

**User Interactions:**
- File uploads (drag-drop events, browser file selection)
- File validation (success/failure with file metadata: name, size, type)
- Button clicks and form submissions
- Tool tile clicks with destination tracking

**Application Events:**
- localStorage operations (API key saves/loads, preference updates)
- File processing operations (PDF conversion, HTML conversion)
- Download triggers (when user downloads converted files)
- API calls with full timing data (request sent, response received, duration in ms)
- Polling operations (attempt count, elapsed time)

**Error Tracking:**
- Validation errors (file size limits, type mismatches)
- Network errors (API failures, HTTP status codes, timeout errors)
- 404 errors (invalid routes, automatic logging)
- Application crashes (via ErrorBoundary integration)
- API errors with full context (endpoint, request ID, error message, stack trace)

**Performance Metrics:**
- API response times (milliseconds precision)
- Polling durations (elapsed time per attempt)
- Total operation times (end-to-end conversion timing)
- Network request timing (submit request, poll requests)

**Each log includes:**
- Sequential ID (persists across navigation, starts at 1)
- Timestamp (HH:MM:SS format)
- Type (info/success/error)
- Descriptive message (what happened)
- Structured data (file metadata, API responses, error details, timing, request IDs)

### How to Maintain Logging

The diagnostic logging system exists to:
- **Trace user actions** - Know exactly what the user did before an error
- **Debug issues faster** - See the full context of what happened
- **Monitor application flow** - Understand how features are being used
- **Catch edge cases** - Identify unexpected behaviors early
- **Enable remote debugging** - Give Claude eyes into what's happening in the user's browser

### What to Log

**Log these events:**

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

---

## What NOT to Do

- **Don't add complex state management** - Keep it simple
- **Don't store files server-side** - Everything client/proxy only
- **Don't add features not in plan** - Ask user first
- **Don't add authentication or analytics** - Privacy-first, no tracking
- **Don't use emojis** - Use text labels instead
- **Don't skip session inialization framework** - Always include the steps in your initial to-do's
- **Don't skip testing or documentation updates** - Always update docs with code changes
