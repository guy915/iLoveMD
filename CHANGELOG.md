# Changelog

All notable changes to the AI Doc Prep project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Removed dark mode support (light mode only for now)
  - Removed all `dark:` Tailwind classes from components
  - Simplified `globals.css` to remove dark mode media query
  - Removed `darkMode: 'class'` from `tailwind.config.js`
  - Updated Header, Footer, ToolTile, FileUpload, and page.js
  - Build test successful - no errors

### Planned
- Phase 3: PDF to Markdown tool
- Phase 4: HTML to Markdown tool
- Phase 5: Merge Markdown tool
- Phase 6: Polish & Deploy

---

## [0.2.0] - 2025-11-10

### Phase 2: Core UI & Layout ✅

#### Added
- **Custom Hooks**:
  - `src/hooks/useLocalStorage.js` - localStorage wrapper with SSR safety
    - Handles JSON parsing/stringifying
    - Graceful error handling
    - Checks for `window` existence for Next.js SSR compatibility
- **Layout Components**:
  - `src/components/layout/Header.js` - Site header with navigation
    - Logo and site name linking to homepage
    - Desktop navigation menu (PDF, HTML, Merge, Help, About)
    - Mobile hamburger menu with responsive breakpoint
    - Dark mode support
  - `src/components/layout/Footer.js` - Site footer
    - Copyright text
    - Dark mode support
    - Auto-pushed to bottom with flex layout
- **Common Components**:
  - `src/components/common/Button.js` - Reusable button component
    - Primary and secondary variants
    - Loading state with "Processing..." text
    - Disabled state with opacity and cursor changes
    - Consistent styling with Tailwind classes
  - `src/components/common/FileUpload.js` - Drag-drop file upload component
    - Drag-and-drop zone with visual feedback
    - Click to browse fallback
    - File size validation (configurable, default 1GB)
    - File type validation via accept prop
    - Error message display
    - Selected file name display
    - Dark mode support
- **Home Components**:
  - `src/components/home/ToolTile.js` - Homepage tool cards
    - Icon, title, and description props
    - Hover effects (border color + shadow)
    - Next.js Link integration
    - Responsive padding and typography
    - Dark mode support

#### Updated
- `src/app/layout.js` - Integrated Header and Footer
  - Added Header above main content
  - Added Footer below main content
  - Maintained flex layout for sticky footer
- `src/app/page.js` - Complete homepage redesign
  - Hero section with title and tagline
  - 3-column responsive tool grid
  - ToolTile components for each tool:
    - PDF to Markdown
    - HTML to Markdown
    - Merge Markdowns
  - Responsive breakpoints (mobile: 1 col, tablet: 2 cols, desktop: 3 cols)
- `CHECKLIST.md` - Marked all Phase 2 tasks as complete
- `CLAUDE.md` - Updated current status to Phase 2 Complete

#### Testing
- ✅ Next.js production build successful
- ✅ No console errors or warnings
- ✅ All navigation links functional (though target pages don't exist yet)
- ✅ Mobile menu opens/closes correctly
- ✅ Component styling matches design system
- ✅ Dark mode works across all components
- ✅ Responsive layout verified

#### Technical Decisions
- **useLocalStorage hook**: Centralized localStorage logic for reuse across tools
- **Client components**: Header uses `'use client'` for mobile menu state
- **FileUpload component**: Flexible with props for different file types and sizes
- **Button component**: Simple variant system, can be extended in future
- **ToolTile component**: Link wrapper for better accessibility and SEO

#### Git
- All Phase 2 components committed
- Documentation updates committed
- Changes pushed to branch `claude/explore-codebase-011CUzmX2ZtEB5AiYhocyGKj`

---

## [0.1.0] - 2025-11-10

### Phase 1: Project Setup ✅

#### Fixed
- Added `.gitkeep` files to empty directories to ensure they're tracked by Git
  - Addresses Copilot AI review feedback on PR #1
  - Directories now properly visible in version control:
    - `src/components/layout/`, `src/components/common/`, `src/components/tools/`, `src/components/home/`
    - `src/lib/processors/`, `src/lib/api/`, `src/lib/utils/`, `src/lib/storage/`
    - `src/hooks/`

#### Added
- Initialized Next.js 14 project with App Router
- Created project structure with organized directories:
  - `src/app/` - Pages and routing (App Router)
  - `src/components/` - React components (layout, common, tools, home)
  - `src/lib/` - Business logic (processors, api, utils, storage)
  - `src/hooks/` - Custom React hooks
  - `public/` - Static assets
- Installed core dependencies:
  - `next` ^14.2.0 - Next.js framework
  - `react` ^18.3.1 - React library
  - `react-dom` ^18.3.1 - React DOM
  - `turndown` ^7.2.2 - HTML to Markdown conversion
  - `@mozilla/readability` ^0.6.0 - HTML content extraction
- Installed dev dependencies:
  - `tailwindcss` ^3.4.1 - Utility-first CSS framework
  - `postcss` ^8.4.35 - CSS processor
  - `autoprefixer` ^10.4.17 - PostCSS plugin
  - `eslint` ^8.57.0 - JavaScript linter
  - `eslint-config-next` ^14.2.0 - Next.js ESLint config

#### Configured
- **Tailwind CSS**:
  - Custom primary color palette (blue shades)
  - Dark mode with 'class' strategy
  - Content paths for all source files
- **PostCSS**: Basic configuration with Tailwind and Autoprefixer
- **Next.js**: Default configuration with future optimizations ready
- **ESLint**: Next.js core web vitals configuration
- **Import aliases**: `@/*` pointing to `src/*` for clean imports
- **Git**: `.gitignore` configured for Next.js projects

#### Created
- `src/app/globals.css` - Global styles with Tailwind directives and CSS variables
- `src/app/layout.js` - Root layout with metadata
- `src/app/page.js` - Temporary homepage placeholder
- `tailwind.config.js` - Tailwind configuration
- `postcss.config.js` - PostCSS configuration
- `next.config.js` - Next.js configuration
- `jsconfig.json` - JavaScript configuration with path aliases
- `.eslintrc.json` - ESLint configuration
- `.gitignore` - Git ignore patterns

#### Documentation
- Created comprehensive documentation suite:
  - `ARCHITECTURE.md` - Technical architecture and system design
  - `CHECKLIST.md` - Implementation progress tracker
  - `CLAUDE.md` - AI assistant context file
  - `DESIGN_SYSTEM.md` - UI/UX specifications
  - `IMPLEMENTATION_GUIDE.md` - Step-by-step code guide
  - `PROJECT_PLAN.md` - High-level project overview
  - `README.md` - User-facing documentation
  - `CHANGELOG.md` - This file

#### Updated
- CHECKLIST.md: Marked all Phase 1 tasks as complete
- CLAUDE.md: Updated status to "Phase 1 Complete"
- Added detailed notes in CHECKLIST.md documenting Phase 1 completion

#### Testing
- ✅ Next.js build test passed successfully
- ✅ All configurations working correctly
- ✅ Project structure verified

#### Git
- Initial project setup committed
- Phase 1 completion committed
- Documentation updates committed
- All changes pushed to branch `claude/catch-up-project-011CUzh4VWADLESiAuk68JCz`

---

## Project Milestones

### Phase 1: Project Setup ✅ (2025-11-10)
**Goal**: Initialize project and set up development environment
**Status**: Complete
**Duration**: ~1 hour
**Commits**: 3

### Phase 2: Core UI & Layout ✅ (2025-11-10)
**Goal**: Build shared layout components and homepage
**Status**: Complete
**Duration**: ~1 hour
**Components Built**: useLocalStorage, Header, Footer, Button, FileUpload, ToolTile, Homepage

### Phase 3: PDF Tool 🎯 (Ready to Start)
**Goal**: Implement PDF conversion using Marker API
**Status**: Not started

### Phase 4: HTML Tool (Upcoming)
**Goal**: Implement HTML conversion with client-side processing
**Status**: Not started

### Phase 5: Merge Tool (Upcoming)
**Goal**: Implement markdown merging with client-side processing
**Status**: Not started

### Phase 6: Polish & Deploy (Upcoming)
**Goal**: Create help/about pages, final testing, and deploy
**Status**: Not started

---

## Development Notes

### 2025-11-10 (Phase 2)
- Built all core UI components for the application
- useLocalStorage hook provides consistent state persistence across tools
- Header component includes responsive navigation with mobile menu
- FileUpload component handles drag-drop and validation elegantly
- Homepage now displays all three tool options with clear calls to action
- Dark mode support verified across all new components
- Build test successful - no errors or warnings
- Ready to proceed with Phase 3: PDF to Markdown Tool

### 2025-11-10 (Phase 1)
- Project initialized successfully with Next.js 14 and App Router
- JavaScript chosen over TypeScript per project requirements
- Tailwind CSS configured with custom primary colors and dark mode support
- All core dependencies installed and tested
- Documentation structure established for easy reference
- Build test successful - production build working correctly
- Ready to proceed with Phase 2: Core UI & Layout

---

## Technical Decisions

### Framework & Language
- **Next.js 14 with App Router**: Modern approach, better for learning
- **JavaScript (not TypeScript)**: Matches student's current skill level
- **Tailwind CSS**: Faster development, no custom CSS files needed

### Project Structure
- **src/ directory**: Clean separation of source code
- **Component organization**: Grouped by purpose (layout, common, tools, home)
- **lib/ directory**: Business logic separated from UI components

### Configuration
- **Dark mode**: System preference based, can be extended later
- **Import aliases**: `@/*` for cleaner imports
- **ESLint**: Next.js recommended config for code quality

---

## Links

- **Repository**: https://github.com/guy915/AI-Doc-Prep
- **Branch**: claude/catch-up-project-011CUzh4VWADLESiAuk68JCz
- **Deployment**: TBD (Vercel)

---

**Changelog Format**: [Keep a Changelog](https://keepachangelog.com/)
**Versioning**: [Semantic Versioning](https://semver.org/)
