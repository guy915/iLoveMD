# AI Doc Prep - Claude Context File

---

## Project Overview

**Name:** AI Doc Prep
**Type:** Web application for preparing documents for LLMs
**Status:** Phase 3 complete (MVP), Phase 4 next
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

- **Framework:** Next.js 14+ (App Router)
- **Styling:** Tailwind CSS
- **Language:** JavaScript (NOT TypeScript)
- **Hosting:** Vercel

See **ARCHITECTURE.md** for complete tech stack details and dependencies.

---

## Current Status

**Check CHECKLIST.md for exact progress**

Current phase: **Phase 3 Complete (MVP)**
Next task: **Phase 4 - HTML to Markdown Tool**

**Note:** Phase 3 implemented core PDF conversion functionality. Advanced options (multiple output formats, pagination, LLM enhancement, etc.) are deferred to future iterations.

---

## Key Documentation Files

When you need details, reference these:

| File | Purpose | When to Read |
|------|---------|--------------|
| **CHECKLIST.md** | Progress tracker | Start of every session to see status |
| **ARCHITECTURE.md** | Technical design & decisions | When unclear about data flow or tech choices |
| **CONTRIBUTING.md** | Code style & workflow | When writing code or submitting changes |
| **README.md** | User-facing docs | When writing help content |
| **CHANGELOG.md** | Development history | To understand what changed and why |

---

## Architecture Quick Reference

See **ARCHITECTURE.md** for complete technical details including:
- Data flows for all three tools
- State management strategy
- localStorage schema
- Project structure
- Component architecture
- API route specifications

---

## Implementation Phases

See **CHECKLIST.md** for the complete implementation checklist with detailed task breakdowns for all 6 phases.

---

## Development Guidelines

See **CONTRIBUTING.md** for complete guidelines including:
- Code style and naming conventions
- Testing procedures (build, lint, manual testing)
- Git workflow and commit message format
- Pull request process

**Quick reminders:**
- JavaScript only (NOT TypeScript)
- Tailwind CSS only (no custom CSS)
- No emojis in code or UI
- Always run `npm run build` and `npm run lint` before pushing
- Keep commits and PRs small and focused

---

## Diagnostic Logging System

**IMPORTANT: This application has a comprehensive diagnostic logging system built specifically for Claude to debug issues remotely.**

### What It Is

A website-wide logging panel that captures every user interaction, application event, and error across all pages. Think of it as Claude's eyes and ears into what's happening in the user's browser.

### Purpose: Built For Claude

**The diagnostic logging system is primarily a tool for Claude (the AI assistant) to debug issues effectively.**

While users can view the logs, the primary purpose is to give Claude complete visibility into:
- What the user did (step by step)
- What the application did in response
- Where and why things failed
- Timing and performance of operations

**For the user:** Logs provide transparency and are useful for copying/pasting to Claude when asking for help.

**For Claude:** Logs are the primary debugging tool - they replace the inability to see the browser console, network tab, or application state directly. Claude should feel free to continue developing and enhancing the logging system based on debugging needs.

### Where to Find It

**In the Header** - Next to the logo on every page, there's a "Diagnostic Logs" button with a badge showing log count.

**Always visible** - Never hides, even when empty (shows "No logs yet" message).

**Click to expand/collapse** - Shows full log panel with all events.

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

### How to Use It (For Claude)

**When debugging:**
1. Ask user to click "Copy" button in diagnostic panel
2. User pastes the logs in their message to you
3. You receive complete context: metadata, statistics, legend, and full log history
4. Reference specific logs by ID (e.g., "check log #5")

**What you get in copied logs:**
- **About section**: Explains what the logs are (for user context)
- **What this tool tracks**: Complete list of all tracked events
- **Session details**: Date, time, URL, browser info
- **Statistics**: Total logs, breakdown by type (errors, successes, info)
- **Legend**: Explains log format and types
- **Full log history**: Every event with timestamps and data

**Benefits for Claude:**
- Complete operation timeline with millisecond precision
- Full visibility into user actions leading to errors
- Network request/response details
- Error context (what, when, why, stack traces)
- No need to ask "what did you click?" or "can you check the console?"

### Log Persistence

**Logs persist across:**
- Page navigation within the site
- Browser back/forward buttons
- Route changes

**Logs reset on:**
- Manual "Clear" button click
- Page refresh (F5)
- Browser close
- Application crash

**Stored in sessionStorage** (`diagnosticLogs` key) for persistence.

### How to Maintain Logging

**Logging Philosophy:** Log EVERYTHING - Every user interaction, every state change, every error.

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

## Session Management

### What to Do When Starting a Session

1. **Read CHECKLIST.md** - See current progress and any blockers
2. **Read CHANGELOG.md** - Understand recent changes and decisions
3. **Reference ARCHITECTURE.md** - For technical design and decisions
4. **Reference CONTRIBUTING.md** - For code style and conventions
5. **Ask user:** "Should we continue where you left off, or...?"

### Feature Implementation Workflow

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
   - Add any new patterns or decisions to relevant sections

4. **Commit and Push**
   - Commit code changes first
   - Then commit documentation updates
   - Push all changes to branch

**Never skip documentation updates!** It ensures continuity between sessions.

### Session Handoff

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

## Key Design Principles

- **Privacy first:** No data storage, no tracking, client-side processing
- **User's API keys:** Users provide their own keys (we don't pay for services)
- **Simple:** Single-purpose tools, no over-engineering
- **No TypeScript:** JavaScript only (student preference)
- **No complex state:** Component-level + localStorage only

See **ARCHITECTURE.md** for detailed design decisions and constraints.

---

## Development API Keys

**Test Marker API Key:** `w4IU5bCYNudH_JZ0IKCUIZAo8ive3gc6ZPk6mzLtqxQ`

**Currently hardcoded in:**
- `src/app/pdf-to-markdown/page.js` (line 12) - Pre-filled as default value in useLocalStorage hook

**TODO before production:**
- Remove hardcoded API key from pdf-to-markdown/page.js
- Change default value from the key to empty string: `useLocalStorage('markerApiKey', '')`
- Test that users are properly prompted to enter their own key

---

## Common Commands & Troubleshooting

See **CONTRIBUTING.md** for development commands and **README.md** for troubleshooting guide.

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

## CI/CD Pipeline

The project has automated CI/CD workflows in `.github/workflows/`:
- **Build verification** on Node 18.x and 20.x
- **Security audits** for dependencies
- **Code quality checks** (console.log detection, bundle size)
- **PR labeling** and automation

When adding features with new dependencies, test commands, or API endpoints, consider updating the CI/CD workflows accordingly.

---

## What NOT to Do

- **Don't use TypeScript** - Project is JavaScript only
- **Don't add complex state management** - Keep it simple
- **Don't store files server-side** - Everything client/proxy only
- **Don't add features not in plan** - Ask user first
- **Don't add authentication or analytics** - Privacy-first, no tracking
- **Don't use emojis** - Use text labels instead
- **Don't skip testing or documentation updates** - Always update docs with code changes

---

## When User Says...

**"Let's continue"** → Read CHECKLIST.md, find current phase, continue
**"How do I style this?"** → Reference CONTRIBUTING.md code style section
**"Why did we decide X?"** → Check ARCHITECTURE.md tech decisions table
**"It's not working"** → Ask for diagnostic logs, debug systematically
**"Let's add a feature"** → Discuss if it fits scope, update docs if yes

---

## Remember

- **Simplicity is key** - Don't over-engineer
- **Privacy matters** - No data storage/tracking
- **Education focus** - Explain decisions to student
- **User's in control** - Ask before major changes
- **Have fun** - It's a learning project!

---

**Last Updated:** 2025-11-12
**Current Status:** Phase 3 complete (MVP), ready for Phase 4
**Next Action:** Build HTML to Markdown tool
