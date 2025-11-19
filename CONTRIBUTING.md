# Contributing to iLoveMD

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)
- [Diagnostics Tool](#diagnostics-tool)
- [LLM Instructions](#llm-instructions)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Git
- A code editor (VS Code, Cursor, etc.)

### Setting Up Your Development Environment

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/iLoveMD.git
   cd iLoveMD
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Open your browser** to `http://localhost:3000`

### Project Structure

See `ARCHITECTURE.md` for more details. Key directories:
- `src/app/` - Next.js pages and API routes (App Router)
- `src/components/` - React components (layout, common, tools, home)
- `src/lib/` - Business logic (processors, API clients, utilities)
- `src/hooks/` - Custom React hooks
- `public/` - Static assets

---

## Development Workflow

### Branches

- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/*` - New features
- `fix/*` - Bug fixes
- `docs/*` - Documentation updates

### Creating a New Branch

```bash
git checkout -b feature/your-feature-name
```

### Making Changes

1. Make your changes in your feature branch
2. Test your changes thoroughly
3. Ensure code follows the style guide
4. Update documentation if needed
5. Commit your changes with clear messages

**Small commits:**
- Easier to review and understand
- Easier to revert if something breaks
- Better git history for debugging
- Clear, focused changes

**Small PRs:**
- Faster review cycles
- Less likely to have merge conflicts
- Easier to test thoroughly
- Reduces risk of introducing bugs

**Commit Size:**
- **One logical change per commit** - Don't mix unrelated changes
- **Self-contained** - Commit should work on its own (build passes)
- **Clear message** - Describe what and why, not how
- Examples:
  - ✅ "Add deduplication logic to prevent duplicate logs"
  - ✅ "Fix console.log interception for CI compatibility"
  - ❌ "Fix stuff and add features and update docs"

**PR Size:**
- **One feature or fix per PR** - Don't combine multiple features
- **Reviewable in 15-30 minutes** - Keep PR diff under ~300 lines when possible
- **Address feedback first** - Fix PR review comments before adding new features

**When to Split a PR:**
- If PR review finds issues → Fix issues first, then open new PR for additional features
- If implementing multiple features → Create separate PRs for each
- If PR grows beyond scope → Extract new work into separate branch/PR

---

## Code Style

### General Guidelines

- **Languages**: JavaScript, TypeScript, CSS, HTML
- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS only (no custom CSS files)
- **State Management**: Component-level + localStorage (no Redux/Context)
- **No emojis**: Use text instead of emojis in code and UI

### JavaScript Style (Extends to TypeScript)

```javascript
// Component structure
'use client' // Only when needed

import { useState } from 'react'
import useLocalStorage from '@/hooks/useLocalStorage'

export default function ComponentName({ prop1, prop2 }) {
  // State
  const [localState, setLocalState] = useState(null)
  const [storedValue, setStoredValue] = useLocalStorage('key', defaultValue)

  // Handlers
  const handleAction = () => {
    // Logic here
  }

  // Render
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Content */}
    </div>
  )
}
```

### Naming Conventions

- **Components**: PascalCase (e.g., `Button.tsx`, `FileUpload.tsx`)
- **Utilities**: camelCase (e.g., `downloadUtils.ts`)
- **Pages**: lowercase (e.g., `page.tsx`, `layout.tsx`)
- **Services**: camelCase (e.g., `storageService.ts`, `markerApiService.ts`)
- **Types**: lowercase (e.g., `index.ts` in types directory)

### Tailwind CSS

- Use Tailwind utility classes
- No custom CSS unless absolutely necessary
- Use responsive breakpoints: `md:`, `lg:`
- Follow spacing conventions: 4px base unit

### File Organization

- One component per file
- Group related components in subdirectories
- Use index files for easier imports when appropriate
- Place business logic in `lib/`, not in components

---

## Testing

### Manual Testing

Before submitting your PR, test:

1. **Functionality**: Does your feature work as expected?
2. **Edge cases**: Try invalid inputs, large files, etc.
3. **Responsive design**: Test on mobile, tablet, and desktop
4. **Cross-browser**: Test on Chrome, Firefox, and Safari
5. **Build**: Run `npm run build` to ensure no errors

### Test Checklist

- [ ] Feature works in development mode
- [ ] Feature works in production build
- [ ] No console errors or warnings
- [ ] Responsive on all screen sizes
- [ ] Works in Chrome, Firefox, Safari
- [ ] No accessibility issues

---

## Submitting Changes

### Commit Messages

Use clear, descriptive commit messages:

```
Add PDF validation to FileUpload component

- Added file type checking
- Added size limit validation
- Updated error messages
```

Format:
- First line: Summary (50 chars or less)
- Blank line
- Detailed description if needed

### Pull Request Process

1. **Update documentation** if you've changed functionality
2. **Update CHANGELOG.md** with your changes
3. **Ensure all tests pass** (manual testing)
4. **Create a Pull Request** with a clear title and description

### PR Description Template

```markdown
## Description
Brief description of what this PR does.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code refactoring

## Changes Made
- Change 1
- Change 2
- Change 3

## Testing Done
- Tested scenario A
- Tested scenario B

## Screenshots (if applicable)
Add screenshots here

## Checklist
- [ ] Code follows style guidelines
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Manual testing completed
- [ ] Build succeeds
```

---

## Reporting Bugs

### Before Reporting

1. Check if the bug has already been reported in Issues
2. Try to reproduce the bug in the latest version
3. Collect relevant information (browser, OS, steps to reproduce)

### Bug Report Template

```markdown
**Description**
Clear description of the bug

**Steps to Reproduce**
1. Go to '...'
2. Click on '...'
3. See error

**Expected Behavior**
What you expected to happen

**Actual Behavior**
What actually happened

**Environment**
- OS: [e.g., macOS 13]
- Browser: [e.g., Chrome 120]
- Node version: [e.g., 18.17.0]

**Screenshots**
If applicable, add screenshots

**Additional Context**
Any other relevant information
```

---

## Suggesting Features

### Feature Request Template

```markdown
**Problem Statement**
What problem does this feature solve?

**Proposed Solution**
How would this feature work?

**Alternatives Considered**
What other solutions did you consider?

**Additional Context**
Any other relevant information
```

## Project Philosophy

When contributing, keep these principles in mind:

- **Privacy First**: No data storage, no tracking, no accounts
- **User's API Keys**: Users provide their own API keys
- **Client-Heavy**: Most processing happens in the browser
- **Simple**: Single-purpose tools, no complex pipelines
- **Free**: No server costs, hosted on Vercel free tier

## Key Constraints

- **No Complex State Management**: Keep it component-level
- **No Server-Side File Storage**: Everything client-side or proxied
- **No Authentication**: Anonymous by design
- **No Analytics**: Privacy-first approach

---

## Diagnostics Tool

### What It Is

Website-wide logging panel that captures every user interaction, application event, and error across all pages. Logs are the primary debugging tool - they replace the inability to see the browser console, network tab, or application state directly. 

While users can view the logs, the primary purpose is to give complete visibility into:
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

## LLM Instructions

````
# Session Management

## Session Initialization

1. Read **all** documentation **fully** (CHANGELOG.md is exempt from a *full* read)
2. Explore the codebase
3. Ask questions

These steps should be your first to-do (a session will begin with a system prompt, followed by an initial user request).

**IMPORTANT: Don't skip session initialization steps.**

## Session Conclusion

1. **Test Before Committing (can skip for small safe changes)**
   - Run `npm test` - All tests must pass
   - Run `npm run build` - Must pass without errors
   - Run `npm run lint` - Must pass without errors
   - Run `npm test -- --coverage` - Verify coverage remains above 70%
   - Manual testing - Test the feature in browser (happy path + edge cases)
   - API testing (if applicable) - Test API routes work correctly

2. **Update Documentation**
   - Update CHANGELOG.md
   - Update README.md *(optional)*
   - Update ARCHITECTURE.md *(optional)*
   - Update CONTRIBUTING.md *(optional)*

3. **Commit and Push**
   - Commit code changes first
   - Then commit documentation updates
   - Push all changes to branch

---

# Documentation

Before updating documentation, read the **full** file (CHANGELOG.md is exempt from a *full* read).

---

# CI/CD Pipeline

The project has automated CI/CD workflows in `.github/workflows/`:
- **Build verification** on Node 18.x and 20.x
- **Security audits** for dependencies
- **Test Coverage** for testing
- **Code quality checks** (console.log detection, bundle size)
- **PR labeling** and automation

When adding features with new dependencies, test commands, or API endpoints, update the CI/CD workflows accordingly.

---

# Testing

## Test Infrastructure

The project uses a comprehensive testing setup with high coverage standards:

**Testing Stack:**
- **Vitest 2.1.9** - Fast test runner with ESM support
- **React Testing Library 16.1.0** - Component testing with user-centric queries
- **@testing-library/user-event** - Realistic user interaction simulation
- **@testing-library/jest-dom** - DOM assertion matchers
- **jsdom 25.0.1** - Browser environment simulation

**Current Test Coverage: 71.47%** (exceeds 70% threshold)
- **335 tests total** (329 passing + 6 skipped)
- **Statements**: 71.47%
- **Branches**: 92.64%
- **Functions**: 88.07%

## Running Tests

**Run all tests:**
```bash
npm test
```

**Run tests with coverage report:**
```bash
npm test -- --coverage
```

**Run specific test file:**
```bash
npm test -- src/components/common/Button.test.tsx
```

**Run tests in watch mode (auto-rerun on changes):**
```bash
npm test -- --watch
```

**Run tests in CI mode (single run, no watch):**
```bash
npm test -- --run
```

## Test Coverage by Category

**Components (99.8% coverage):**
- `src/components/common/Button.test.tsx` - Button variants, loading states, interactions
- `src/components/common/FileUpload.test.tsx` - File upload, drag-drop, validation
- `src/components/common/ErrorBoundary.test.tsx` - Error catching, fallback UI, recovery

**Services (98.09% coverage):**
- `src/lib/services/batchConversionService.test.ts` - Batch processing, retry logic, concurrency
- `src/lib/services/markerApiService.test.ts` - API calls, polling, validation
- `src/lib/services/storageService.test.ts` - localStorage operations

**Utilities (99.57% coverage):**
- `src/lib/utils/downloadUtils.test.ts` - File downloads, blob creation
- `src/lib/utils/formatUtils.test.ts` - String formatting, size calculations
- `src/lib/utils/classNames.test.ts` - CSS class utilities

**API Routes (74.69% coverage):**
- `src/app/api/marker/route.test.ts` - GET endpoint polling, error handling

**Contexts (94.25% coverage):**
- `src/contexts/LogContext.test.tsx` - Logging system, storage, error handlers, network interception

## Testing Patterns and Conventions

**Test File Naming:**
- Test files use `.test.ts` or `.test.tsx` extension
- Place test files alongside the code they test (e.g., `Button.tsx` → `Button.test.tsx`)

**Test Structure:**
```typescript
describe('ComponentName', () => {
  describe('specific functionality', () => {
    it('should do something specific', () => {
      // Arrange
      const { result } = renderHook(() => useMyHook())

      // Act
      act(() => {
        result.current.doSomething()
      })

      // Assert
      expect(result.current.value).toBe(expected)
    })
  })
})
```

**Common Testing Techniques:**

**Component Testing:**
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

it('should handle user interaction', async () => {
  render(<MyComponent onSubmit={mockFn} />)

  const button = screen.getByRole('button')
  await userEvent.click(button)

  expect(mockFn).toHaveBeenCalled()
})
```

**Hook Testing:**
```typescript
import { renderHook, act } from '@testing-library/react'

it('should update state', () => {
  const { result } = renderHook(() => useMyHook())

  act(() => {
    result.current.updateValue('new value')
  })

  expect(result.current.value).toBe('new value')
})
```

**Async Testing:**
```typescript
import { waitFor } from '@testing-library/react'

it('should handle async operation', async () => {
  render(<AsyncComponent />)

  await waitFor(() => {
    expect(screen.getByText('Loaded')).toBeInTheDocument()
  })
})
```

**Mocking:**
```typescript
// Mock external dependencies
vi.mock('@/contexts/LogContext', () => ({
  useLogs: () => ({ addLog: vi.fn() })
}))

// Mock fetch
global.fetch = vi.fn().mockResolvedValue(new Response('{}'))
```

### Testing Checklist for New Features

When adding a new feature, ensure you write tests that cover:

**Component Tests:**
- [ ] Rendering with default props
- [ ] Rendering with all prop variations
- [ ] User interactions (clicks, inputs, submissions)
- [ ] State changes and updates
- [ ] Error states and edge cases
- [ ] Accessibility (keyboard navigation, ARIA attributes)
- [ ] Loading and disabled states

**Service/Utility Tests:**
- [ ] Happy path (expected inputs and outputs)
- [ ] Error handling (invalid inputs, network errors)
- [ ] Edge cases (null, undefined, empty values, boundary conditions)
- [ ] Async operations (promises, timeouts, retries)
- [ ] Side effects (localStorage, API calls)

**API Route Tests:**
- [ ] Request validation (missing params, invalid types)
- [ ] Successful responses (200, 201)
- [ ] Error responses (400, 401, 404, 500)
- [ ] Network errors (timeout, connection refused)
- [ ] Request/response data structure

**Coverage Standards:**
- Maintain **70%+ overall coverage**
- Aim for **95%+ coverage** on new code
- All critical paths must be tested
- Complex logic requires comprehensive test cases

## Skipped Tests

Some tests are intentionally skipped due to test environment limitations:

**LogContext.test.tsx (6 skipped tests):**
- Counter restoration from sessionStorage (global module state)
- Storage quota exceeded handling (complex test environment interaction)
- Storage unavailable handling (module state persistence)
- Promise rejection events (PromiseRejectionEvent not in jsdom)
- Fetch header redaction (fetch wrapping complexity with mocks)
- Fetch timing information (fetch wrapping complexity with mocks)

**All skipped tests include:**
- Clear rationale comments
- Implementation line references
- Verification method (manual testing, integration testing, browser testing)

## What NOT to Test

- **Third-party libraries** - Trust that React, Next.js, Vitest work correctly
- **Implementation details** - Test behavior, not internal state
- **Trivial code** - Constants, simple getters, obvious logic
- **Browser APIs** - Trust that fetch, localStorage, etc. work correctly
- **Next.js framework code** - Trust the framework

---

## What NOT to Do

- **Don't add complex state management** - Keep it simple
- **Don't add features not in plan** - Ask user first
- **Don't use emojis** - Keep it professional
- **Don't skip session inialization and conclusion** - Keep it consistent
````
