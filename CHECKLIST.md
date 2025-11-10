# AI Doc Prep - Implementation Checklist

Track your progress through each implementation phase. Update checkboxes as you complete tasks.

**Current Status:** Phase 1 Complete ✓ | Ready for Phase 2

---

## Phase 1: Project Setup ✅

**Goal:** Initialize project and set up development environment

- [x] Initialize Next.js project with create-next-app
  - [x] Choose JavaScript (not TypeScript)
  - [x] Enable ESLint
  - [x] Enable Tailwind CSS
  - [x] Enable src/ directory
  - [x] Enable App Router
  - [x] Enable import alias (@/*)

- [x] Install dependencies
  - [x] `npm install turndown`
  - [x] `npm install @mozilla/readability`

- [x] Clean up boilerplate
  - [x] Remove default page.module.css
  - [x] Recreate globals.css with Tailwind
  - [x] Remove default Next.js content

- [x] Create directory structure
  - [x] src/components/layout/
  - [x] src/components/common/
  - [x] src/components/tools/
  - [x] src/components/home/
  - [x] src/lib/processors/
  - [x] src/lib/api/
  - [x] src/lib/utils/
  - [x] src/lib/storage/
  - [x] src/hooks/

- [x] Configure Tailwind
  - [x] Update tailwind.config.js with custom colors
  - [x] Enable dark mode (class strategy)
  - [x] Test Tailwind works

- [x] Create globals.css
  - [x] Add Tailwind directives
  - [x] Add CSS variables for theming
  - [x] Add base styles

- [x] Git setup
  - [x] Verify .gitignore includes node_modules, .next, .env.local
  - [x] Commit initial setup
  - [x] Push to branch

**Phase 1 Complete:** [x]

---

## Phase 2: Core UI & Layout 🎨

**Goal:** Build shared layout components and homepage

### 2.1 Custom Hooks

- [ ] Create useLocalStorage hook
  - [ ] File: src/hooks/useLocalStorage.js
  - [ ] Handle SSR safely (check typeof window)
  - [ ] Parse/stringify JSON
  - [ ] Error handling
  - [ ] Test with sample data

### 2.2 Layout Components

- [ ] Create Header component
  - [ ] File: src/components/layout/Header.js
  - [ ] Logo + site name (links to home)
  - [ ] Desktop navigation (PDF, HTML, Merge, Help, About)
  - [ ] Mobile hamburger menu
  - [ ] Responsive breakpoints
  - [ ] Test navigation links

- [ ] Create Footer component
  - [ ] File: src/components/layout/Footer.js
  - [ ] Copyright text
  - [ ] Links (if needed)
  - [ ] Simple and minimal

- [ ] Create root layout
  - [ ] File: src/app/layout.js
  - [ ] Import globals.css
  - [ ] Add Header and Footer
  - [ ] Flex column layout (header, main, footer)
  - [ ] Add metadata (title, description)

### 2.3 Homepage

- [ ] Create ToolTile component
  - [ ] File: src/components/home/ToolTile.js
  - [ ] Icon, title, description props
  - [ ] Hover effects
  - [ ] Link to tool page
  - [ ] Styling matches design system

- [ ] Create homepage
  - [ ] File: src/app/page.js
  - [ ] Hero section (title + tagline)
  - [ ] Tool grid (3 tiles)
  - [ ] Responsive grid layout
  - [ ] Test all tile links work

### 2.4 Reusable Components

- [ ] Create Button component
  - [ ] File: src/components/common/Button.js
  - [ ] Primary and secondary variants
  - [ ] Disabled state
  - [ ] Loading state
  - [ ] onClick handler

- [ ] Create FileUpload component
  - [ ] File: src/components/common/FileUpload.js
  - [ ] Drag and drop zone
  - [ ] File input (click to browse)
  - [ ] File validation (type, size)
  - [ ] Selected file display
  - [ ] Error messages
  - [ ] Test with various files

- [ ] Create StatusMessage component (optional)
  - [ ] Success, error, info, warning variants
  - [ ] Icons or emojis
  - [ ] Styling for each type

### 2.5 Testing Phase 2

- [ ] Homepage loads correctly
- [ ] Navigation works (all links)
- [ ] Mobile menu works
- [ ] Tiles look good on mobile/tablet/desktop
- [ ] Dark mode works (if implemented)
- [ ] No console errors

**Phase 2 Complete:** [ ]

---

## Phase 3: PDF to Markdown Tool 📄

**Goal:** Implement PDF conversion using Marker API

### 3.1 API Route

- [ ] Create Marker API route
  - [ ] File: src/app/api/marker/route.js
  - [ ] Handle POST requests
  - [ ] Extract file, apiKey, options from FormData
  - [ ] Build Marker API request
  - [ ] Forward to Marker API
  - [ ] Handle response
  - [ ] Error handling (401, 413, 502, 504)
  - [ ] Test with curl/Postman

### 3.2 Utility Functions

- [ ] Create download utilities
  - [ ] File: src/lib/utils/downloadUtils.js
  - [ ] downloadFile() function
  - [ ] getFileExtension() function
  - [ ] Test file downloads work

### 3.3 PDF Tool Page

- [ ] Create PDF tool page
  - [ ] File: src/app/pdf-to-markdown/page.js
  - [ ] 'use client' directive
  - [ ] State management (file, processing, status, error)
  - [ ] API key input with localStorage
  - [ ] Options with localStorage
  - [ ] File upload integration
  - [ ] Options panel UI
  - [ ] Convert button
  - [ ] Status messages
  - [ ] Download trigger

- [ ] Implement options panel
  - [ ] Output format (radio: markdown/json/html/chunks)
  - [ ] Paginate (checkbox)
  - [ ] Use LLM (checkbox)
  - [ ] Force OCR (checkbox)
  - [ ] Mode (radio: fast/accurate)
  - [ ] Advanced section (collapsible)
  - [ ] Page range (text input)
  - [ ] Max pages (number input)

- [ ] API key management
  - [ ] Input field (password type)
  - [ ] Save to localStorage
  - [ ] Link to get API key
  - [ ] Validation before convert

### 3.4 Testing Phase 3

- [ ] Upload small PDF (< 10MB)
- [ ] Upload large PDF (> 100MB)
- [ ] Test with invalid API key
- [ ] Test without API key
- [ ] Test all output formats
- [ ] Test with paginate enabled
- [ ] Test with LLM enhancement
- [ ] Test fast vs accurate mode
- [ ] Verify file downloads correctly
- [ ] Check error messages display
- [ ] Test localStorage persists options

**Phase 3 Complete:** [ ]

---

## Phase 4: HTML to Markdown Tool 🌐

**Goal:** Implement HTML conversion with client-side processing

### 4.1 API Route for URL Fetching

- [ ] Create fetch-url API route
  - [ ] File: src/app/api/fetch-url/route.js
  - [ ] Handle POST requests
  - [ ] Extract URL from body
  - [ ] Validate URL
  - [ ] Fetch HTML content
  - [ ] Add User-Agent header
  - [ ] Error handling
  - [ ] Test with various URLs

### 4.2 HTML Processing Utilities

- [ ] Create HTML processor
  - [ ] File: src/lib/processors/htmlProcessor.js
  - [ ] cleanHTML() function (remove scripts, styles, etc.)
  - [ ] convertToMarkdown() function (using Turndown)
  - [ ] Configure Turndown options
  - [ ] Test with sample HTML

### 4.3 HTML Tool Page

- [ ] Create HTML tool page
  - [ ] File: src/app/html-to-markdown/page.js
  - [ ] 'use client' directive
  - [ ] State management
  - [ ] Tab interface (File upload / URL)
  - [ ] File upload tab
  - [ ] URL input tab
  - [ ] Options panel
  - [ ] Convert button
  - [ ] Status messages
  - [ ] Download trigger

- [ ] Implement tab selector
  - [ ] Component: src/components/tools/TabSelector.js (optional)
  - [ ] Switch between file upload and URL input
  - [ ] Clear state when switching tabs

- [ ] Implement file processing
  - [ ] Read file with FileReader
  - [ ] Process HTML client-side
  - [ ] Convert to markdown
  - [ ] Trigger download

- [ ] Implement URL processing
  - [ ] Call /api/fetch-url
  - [ ] Receive HTML
  - [ ] Process client-side
  - [ ] Convert to markdown
  - [ ] Trigger download

### 4.4 Testing Phase 4

- [ ] Upload simple HTML file
- [ ] Upload complex HTML file
- [ ] Test with simple URL
- [ ] Test with complex website
- [ ] Test with invalid URL
- [ ] Test with URL that blocks CORS
- [ ] Verify markdown output quality
- [ ] Test preserve images option
- [ ] Test preserve links option
- [ ] Check error messages

**Phase 4 Complete:** [ ]

---

## Phase 5: Merge Markdown Tool 📝

**Goal:** Implement markdown merging with client-side processing

### 5.1 Merge Processing Utilities

- [ ] Create merge processor
  - [ ] File: src/lib/processors/mergeProcessor.js
  - [ ] readFiles() function
  - [ ] orderFiles() function
  - [ ] mergeFiles() function
  - [ ] generateTOC() function (optional)
  - [ ] Add separators logic
  - [ ] Test with sample files

### 5.2 Merge Tool Components

- [ ] Create FileList component
  - [ ] File: src/components/tools/FileList.js
  - [ ] Display uploaded files
  - [ ] Drag handles for reordering
  - [ ] Remove file buttons
  - [ ] File size display
  - [ ] Drag and drop reordering logic

### 5.3 Merge Tool Page

- [ ] Create merge tool page
  - [ ] File: src/app/merge-markdown/page.js
  - [ ] 'use client' directive
  - [ ] State management (files, options)
  - [ ] Multi-file upload
  - [ ] File list display
  - [ ] Reordering interface
  - [ ] Options panel
  - [ ] Merge button
  - [ ] Download trigger

- [ ] Implement multi-file upload
  - [ ] Accept multiple files
  - [ ] Limit to 50 files
  - [ ] Limit to 1GB total
  - [ ] Validate file types (.md)
  - [ ] Display file list

- [ ] Implement options
  - [ ] File ordering (upload/alphabetical/custom)
  - [ ] Separator style (none/page break/file header)
  - [ ] Generate TOC (checkbox)
  - [ ] Options stored in localStorage

### 5.4 Testing Phase 5

- [ ] Upload 2 markdown files
- [ ] Upload 10 markdown files
- [ ] Upload 50 markdown files
- [ ] Test file size limits
- [ ] Test reordering files
- [ ] Test alphabetical ordering
- [ ] Test different separator styles
- [ ] Test TOC generation (if implemented)
- [ ] Verify merged output is correct
- [ ] Test with large files (500MB)

**Phase 5 Complete:** [ ]

---

## Phase 6: Polish & Deploy 🚀

**Goal:** Create help/about pages, final testing, and deploy

### 6.1 Content Pages

- [ ] Create Help page
  - [ ] File: src/app/help/page.js
  - [ ] FAQ section
  - [ ] "How to get API key" instructions
  - [ ] "How to use each tool" guides
  - [ ] Troubleshooting section
  - [ ] File size/format information

- [ ] Create About page
  - [ ] File: src/app/about/page.js
  - [ ] Project description
  - [ ] Why it was built
  - [ ] Tech stack used
  - [ ] Developer info
  - [ ] GitHub link (if public)

### 6.2 Error Handling & Polish

- [ ] Add error boundaries (React)
- [ ] Improve error messages (user-friendly)
- [ ] Add loading states everywhere
- [ ] Add success animations/messages
- [ ] Test all edge cases
- [ ] Add file size warnings
- [ ] Add "processing may take a while" messages

### 6.3 Responsive Design

- [ ] Test on mobile (< 640px)
- [ ] Test on tablet (640px - 1024px)
- [ ] Test on desktop (> 1024px)
- [ ] Fix any layout issues
- [ ] Ensure touch targets are 44x44px minimum
- [ ] Test hamburger menu on mobile

### 6.4 Cross-Browser Testing

- [ ] Test on Chrome (latest)
- [ ] Test on Firefox (latest)
- [ ] Test on Safari (latest)
- [ ] Test on Edge (latest)
- [ ] Fix any browser-specific issues

### 6.5 Dark Mode

- [ ] Verify dark mode works on all pages
- [ ] Check color contrast in dark mode
- [ ] Test automatic system preference detection
- [ ] Add theme toggle (optional, future)

### 6.6 Accessibility

- [ ] Check keyboard navigation (tab through site)
- [ ] Add aria-labels where needed
- [ ] Verify focus indicators are visible
- [ ] Test with screen reader (optional)
- [ ] Check color contrast ratios

### 6.7 Performance

- [ ] Check Lighthouse score
- [ ] Optimize any slow pages
- [ ] Check bundle size
- [ ] Lazy load if needed

### 6.8 Final Testing

- [ ] All features work end-to-end
- [ ] localStorage persists correctly
- [ ] All links work
- [ ] No console errors or warnings
- [ ] No broken styles
- [ ] All forms validate properly

### 6.9 Documentation Updates

- [ ] Update README if needed
- [ ] Add screenshots (optional)
- [ ] Update any changed API details
- [ ] Mark all checklist items

### 6.10 Deployment

- [ ] Commit all changes to git
- [ ] Push to GitHub
- [ ] Go to vercel.com and sign in
- [ ] Import project from GitHub
- [ ] Configure build settings (should be automatic)
- [ ] Deploy to production
- [ ] Test production site thoroughly
- [ ] Verify all tools work on production
- [ ] Check API routes work on production
- [ ] Test with real API keys on production

### 6.11 Post-Deployment

- [ ] Share with friends
- [ ] Gather initial feedback
- [ ] Document any issues found
- [ ] Plan next improvements

**Phase 6 Complete:** [ ]

---

## 🎉 Project Complete!

- [ ] All phases completed
- [ ] Site deployed to Vercel
- [ ] All documentation updated
- [ ] Successfully processed test files
- [ ] Shared with intended users

---

## Future Enhancements (Post v1.0)

Track ideas for future versions:

- [ ] Add token counter tool
- [ ] Add markdown splitter tool
- [ ] Implement batch processing
- [ ] Add progress percentage for PDF
- [ ] Add preview before download
- [ ] Improve mobile experience
- [ ] Add keyboard shortcuts
- [ ] Add tutorial/onboarding
- [ ] Add custom output filename
- [ ] Support for more file formats

---

## Notes & Issues

Use this section to track issues, blockers, or notes during implementation:

```
Example:
- 2025-11-10: Started Phase 1, Next.js setup complete
- 2025-11-11: Issue with Turndown.js, resolved by updating config
- 2025-11-12: Deployed to Vercel, all tests passing
```

---

**Last Updated:** 2025-11-10
**Current Phase:** Planning Complete
**Next Task:** Begin Phase 1 - Initialize Next.js project
