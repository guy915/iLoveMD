# Changelog

All notable changes to the AI Doc Prep project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Phase 2: Core UI & Layout components
- Phase 3: PDF to Markdown tool
- Phase 4: HTML to Markdown tool
- Phase 5: Merge Markdown tool
- Phase 6: Polish & Deploy

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

### Phase 2: Core UI & Layout 🎯 (In Progress)
**Goal**: Build shared layout components and homepage
**Status**: Ready to start
**Planned Components**: Header, Footer, Homepage, ToolTile, Button, FileUpload

### Phase 3: PDF Tool (Upcoming)
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

### 2025-11-10
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
