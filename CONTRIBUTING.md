# Contributing to iLoveLLM

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Git
- A code editor (VS Code, Cursor, etc.)

### Setting Up Your Development Environment

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/iLoveLLM.git
   cd iLoveLLM
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
