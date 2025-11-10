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
State:         Component-level + localStorage (no Redux/Context)
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

Current phase: **Phase 2 Complete ✓**
Next task: **Phase 3 - PDF to Markdown Tool**

---

## Project Structure

```
ai-doc-prep/
├── src/
│   ├── app/                    # Pages (Next.js App Router)
│   │   ├── page.js            # Homepage with 3 tiles
│   │   ├── layout.js          # Root layout (Header/Footer)
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
│   │   ├── layout/            # Header, Footer
│   │   ├── common/            # Button, FileUpload, etc.
│   │   ├── home/              # ToolTile
│   │   └── tools/             # Tool-specific components
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

## What to Do When Starting a Session

1. **Read CHECKLIST.md** - See current progress
2. **Check last "Notes & Issues" section** - Understand any blockers
3. **Reference IMPLEMENTATION_GUIDE.md** - Get phase-specific code
4. **Reference DESIGN_SYSTEM.md** - For styling/components
5. **Ask user:** "Should we continue where you left off, or...?"

---

## What NOT to Do

❌ **Don't use TypeScript** - Project is JavaScript only
❌ **Don't add complex state management** - Keep it simple
❌ **Don't store files server-side** - Everything client/proxy only
❌ **Don't add features not in plan** - Ask user first
❌ **Don't use our API keys** - Users provide their own
❌ **Don't add authentication** - No accounts by design
❌ **Don't add analytics** - Privacy-first approach
❌ **Don't over-engineer** - This is a learning project, keep it simple

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

### Test Files Needed
- Small PDF (~1MB)
- Large PDF (~100MB)
- Scanned PDF (for OCR testing)
- Simple HTML file
- Complex website URL
- Multiple markdown files

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
