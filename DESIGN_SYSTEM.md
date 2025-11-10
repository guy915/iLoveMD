# Design System & UI Specifications

This document defines the visual design, components, and user experience patterns for AI Doc Prep.

## Design Principles

1. **Minimal & Functional** - No unnecessary elements, everything serves a purpose
2. **Clear Hierarchy** - Important actions are obvious
3. **Fast & Responsive** - Instant feedback for user actions
4. **Accessible** - Works for all users
5. **Consistent** - Same patterns throughout

---

## Color Palette

### Light Mode

```css
Background:     #ffffff
Surface:        #f9fafb (gray-50)
Border:         #e5e7eb (gray-200)
Text Primary:   #111827 (gray-900)
Text Secondary: #6b7280 (gray-500)
Primary:        #3b82f6 (blue-500)
Primary Hover:  #2563eb (blue-600)
Success:        #10b981 (green-500)
Error:          #ef4444 (red-500)
Warning:        #f59e0b (amber-500)
```

### Dark Mode

```css
Background:     #111827 (gray-900)
Surface:        #1f2937 (gray-800)
Border:         #374151 (gray-700)
Text Primary:   #f9fafb (gray-50)
Text Secondary: #9ca3af (gray-400)
Primary:        #3b82f6 (blue-500)
Primary Hover:  #60a5fa (blue-400)
Success:        #10b981 (green-500)
Error:          #ef4444 (red-500)
Warning:        #f59e0b (amber-500)
```

### Usage Guidelines

- **Primary color (blue):** Main actions, links, selected states
- **Success (green):** Successful operations, confirmations
- **Error (red):** Errors, warnings, destructive actions
- **Surface:** Cards, panels, elevated elements
- **Border:** Dividers, outlines, separators

---

## Typography

### Font Family
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
             'Helvetica Neue', Arial, sans-serif;
```

### Type Scale

| Element | Size | Weight | Line Height | Usage |
|---------|------|--------|-------------|-------|
| H1 | 2.25rem (36px) | 700 | 1.2 | Page titles |
| H2 | 1.875rem (30px) | 700 | 1.3 | Section titles |
| H3 | 1.5rem (24px) | 600 | 1.4 | Subsection titles |
| H4 | 1.25rem (20px) | 600 | 1.4 | Card titles |
| Body Large | 1.125rem (18px) | 400 | 1.6 | Hero text |
| Body | 1rem (16px) | 400 | 1.5 | Main content |
| Body Small | 0.875rem (14px) | 400 | 1.5 | Secondary text |
| Caption | 0.75rem (12px) | 400 | 1.5 | Helper text |

### Usage Examples

```jsx
// Page title
<h1 className="text-4xl font-bold mb-4">
  PDF to Markdown
</h1>

// Section title
<h2 className="text-3xl font-bold mb-6">
  Options
</h2>

// Card title
<h3 className="text-xl font-semibold mb-2">
  Merge Markdowns
</h3>

// Body text
<p className="text-base text-gray-600 dark:text-gray-400">
  Convert PDFs to clean markdown
</p>

// Small text
<p className="text-sm text-gray-500">
  Supported: PDF, up to 1GB
</p>
```

---

## Spacing System

Based on 4px base unit:

```
0   = 0px
1   = 4px
2   = 8px
3   = 12px
4   = 16px
6   = 24px
8   = 32px
12  = 48px
16  = 64px
24  = 96px
```

### Common Usage

```
Padding inside buttons:     px-6 py-3 (24px, 12px)
Padding inside cards:       p-6 or p-8 (24px, 32px)
Margin between sections:    mb-8 or mb-12 (32px, 48px)
Gap between elements:       gap-4 or gap-6 (16px, 24px)
```

---

## Layout

### Container Widths

```css
max-width: 1280px  /* max-w-7xl - Main container */
max-width: 1024px  /* max-w-5xl - Grid container */
max-width: 896px   /* max-w-4xl - Tool pages */
max-width: 768px   /* max-w-3xl - Narrow content */
```

### Responsive Breakpoints

```css
sm: 640px   /* Small devices (large phones) */
md: 768px   /* Medium devices (tablets) */
lg: 1024px  /* Large devices (desktops) */
xl: 1280px  /* Extra large devices */
```

### Grid System

```jsx
// Tool grid on homepage
<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
  {/* Tool tiles */}
</div>

// Two-column layout
<div className="grid md:grid-cols-2 gap-8">
  {/* Content */}
</div>
```

---

## Components

### Button

#### Primary Button
```jsx
<button className="px-6 py-3 bg-primary-600 text-white rounded-lg
                   font-medium hover:bg-primary-700 transition-colors
                   disabled:opacity-50 disabled:cursor-not-allowed">
  Convert
</button>
```

#### Secondary Button
```jsx
<button className="px-6 py-3 bg-gray-200 text-gray-900 rounded-lg
                   font-medium hover:bg-gray-300 transition-colors
                   dark:bg-gray-700 dark:text-gray-100">
  Cancel
</button>
```

#### States
- **Default:** Base colors
- **Hover:** Darker shade
- **Active:** Even darker
- **Disabled:** 50% opacity, no pointer events
- **Loading:** Show "Processing..." text

### Input Fields

#### Text Input
```jsx
<input
  type="text"
  className="w-full px-4 py-2 border border-gray-300 rounded-lg
             focus:outline-none focus:ring-2 focus:ring-primary-500
             dark:bg-gray-800 dark:border-gray-700"
  placeholder="Enter value"
/>
```

#### Checkbox
```jsx
<label className="flex items-center gap-2 cursor-pointer">
  <input
    type="checkbox"
    className="w-4 h-4 text-primary-600 rounded
               focus:ring-2 focus:ring-primary-500"
  />
  <span>Enable feature</span>
</label>
```

#### Radio Button
```jsx
<label className="flex items-center gap-2 cursor-pointer">
  <input
    type="radio"
    name="option"
    className="w-4 h-4 text-primary-600
               focus:ring-2 focus:ring-primary-500"
  />
  <span>Option A</span>
</label>
```

### Cards & Panels

#### Tool Tile (Homepage)
```jsx
<div className="p-8 bg-white dark:bg-gray-800 rounded-lg
                border border-gray-200 dark:border-gray-700
                hover:border-primary-500 hover:shadow-lg
                transition-all cursor-pointer">
  <div className="text-4xl mb-4">FILE</div>
  <h3 className="text-xl font-semibold mb-2">Title</h3>
  <p className="text-gray-600 dark:text-gray-400">Description</p>
</div>
```

#### Options Panel
```jsx
<div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg
                border border-gray-200 dark:border-gray-700">
  <h3 className="font-semibold mb-4">Options</h3>
  {/* Options content */}
</div>
```

### File Upload Area

```jsx
<div className="border-2 border-dashed border-gray-300
                dark:border-gray-700 rounded-lg p-12 text-center
                hover:border-primary-400 transition-colors
                cursor-pointer">
  <div className="text-4xl mb-4">FILE</div>
  <p className="text-lg mb-2">Drop file here or click to browse</p>
  <p className="text-sm text-gray-500">Supported: PDF, up to 1GB</p>
</div>

<!-- Active state (dragging) -->
<div className="border-2 border-dashed border-primary-500
                bg-primary-50 dark:bg-primary-900/20 rounded-lg...">
```

### Status Messages

#### Info
```jsx
<div className="p-4 bg-blue-50 dark:bg-blue-900/20
                border border-blue-200 dark:border-blue-800
                rounded-lg text-blue-800 dark:text-blue-200">
  Processing... This may take a while.
</div>
```

#### Success
```jsx
<div className="p-4 bg-green-50 dark:bg-green-900/20
                border border-green-200 dark:border-green-800
                rounded-lg text-green-800 dark:text-green-200">
  Conversion complete! Download started.
</div>
```

#### Error
```jsx
<div className="p-4 bg-red-50 dark:bg-red-900/20
                border border-red-200 dark:border-red-800
                rounded-lg text-red-800 dark:text-red-200">
  Error: Invalid API key
</div>
```

### Progress Bar

```jsx
<div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
  <div
    className="bg-primary-600 h-2 rounded-full transition-all"
    style={{ width: '60%' }}
  />
</div>
```

### Navigation Links

```jsx
<Link
  href="/pdf-to-markdown"
  className="text-gray-700 dark:text-gray-300
             hover:text-primary-600 dark:hover:text-primary-400
             transition-colors"
>
  PDF to MD
</Link>
```

---

## Page Layouts

### Homepage Layout

```
┌────────────────────────────────────────────────┐
│  Header (full width)                           │
└────────────────────────────────────────────────┘

        ┌──────────────────────────────┐
        │  Hero Section (centered)     │
        │  - Title                     │
        │  - Subtitle                  │
        └──────────────────────────────┘

        ┌──────────────────────────────┐
        │  Tool Grid (3 columns)       │
        │  ┌─────┐ ┌─────┐ ┌─────┐    │
        │  │Tile │ │Tile │ │Tile │    │
        │  └─────┘ └─────┘ └─────┘    │
        └──────────────────────────────┘

┌────────────────────────────────────────────────┐
│  Footer (full width)                           │
└────────────────────────────────────────────────┘
```

### Tool Page Layout

```
┌────────────────────────────────────────────────┐
│  Header (full width)                           │
└────────────────────────────────────────────────┘

        ┌──────────────────────────────┐
        │  Page Title & Description    │
        └──────────────────────────────┘

        ┌──────────────────────────────┐
        │  File Upload Area            │
        └──────────────────────────────┘

        ┌──────────────────────────────┐
        │  API Key Input (if needed)   │
        └──────────────────────────────┘

        ┌──────────────────────────────┐
        │  Options Panel               │
        │  - Checkboxes                │
        │  - Radio buttons             │
        │  - Text inputs               │
        └──────────────────────────────┘

        ┌──────────────────────────────┐
        │  Convert Button (centered)   │
        └──────────────────────────────┘

        ┌──────────────────────────────┐
        │  Status Message (conditional)│
        └──────────────────────────────┘

┌────────────────────────────────────────────────┐
│  Footer (full width)                           │
└────────────────────────────────────────────────┘
```

---

## Interactions & Animations

### Hover Effects

```css
/* Buttons */
hover:bg-primary-700 transition-colors

/* Cards */
hover:border-primary-500 hover:shadow-lg transition-all

/* Links */
hover:text-primary-600 transition-colors
```

### Focus States

```css
/* All interactive elements */
focus:outline-none focus:ring-2 focus:ring-primary-500
```

### Loading States

```jsx
// Button loading
<button disabled>
  Processing...
</button>

// Spinner (optional)
<div className="animate-spin">⏳</div>
```

### Transitions

All transitions use `transition-colors` or `transition-all` with default duration (150ms).

---

## Responsive Design

### Mobile (<768px)

- Single column layout
- Full-width components
- Hamburger menu for navigation
- Larger touch targets (min 44×44px)
- Reduced padding (p-4 instead of p-8)

### Tablet (768px-1024px)

- Two-column grid where appropriate
- Slightly larger padding
- Full navigation visible

### Desktop (>1024px)

- Three-column grid for tool tiles
- Maximum comfortable reading width
- Full navigation always visible
- Hover states enabled

### Implementation

```jsx
// Responsive grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

// Responsive padding
<div className="px-4 sm:px-6 lg:px-8">

// Responsive text
<h1 className="text-2xl sm:text-3xl lg:text-4xl">
```

---

## Accessibility

### Semantic HTML

```jsx
// Use proper heading hierarchy
<h1> → <h2> → <h3>

// Use semantic elements
<header>, <main>, <footer>, <nav>, <section>

// Label inputs
<label htmlFor="api-key">API Key</label>
<input id="api-key" />
```

### ARIA Labels

```jsx
// Buttons without text
<button aria-label="Close">X</button>

// Status messages
<div role="alert">Error occurred</div>

// Loading states
<button aria-busy="true">Processing...</button>
```

### Keyboard Navigation

- All interactive elements focusable
- Logical tab order
- Visible focus indicators
- Escape key closes modals
- Enter key submits forms

### Color Contrast

- Text: Minimum 4.5:1 ratio
- Large text: Minimum 3:1 ratio
- Interactive elements: Minimum 3:1 ratio

---

## Icons & Text Labels

### Usage

Use text labels for all UI elements:

```
PDF files
Markdown
Web/HTML
Success
Error
Settings
```

Always use clear text labels for UI elements.

---

## Dark Mode Implementation

### System Preference Detection

```jsx
// Automatically follows system preference
<html lang="en">
  <body className="dark:bg-gray-900">
```

### Toggle (Optional Future Feature)

```jsx
const [theme, setTheme] = useState('system')

// Apply theme
<html className={theme === 'dark' ? 'dark' : ''}>
```

### Dark Mode Classes

All components should have dark mode variants:

```jsx
className="bg-white dark:bg-gray-900
           text-gray-900 dark:text-gray-100
           border-gray-200 dark:border-gray-800"
```

---

## Error States

### Form Validation

```jsx
// Invalid input
<input className="border-red-500 focus:ring-red-500" />
<p className="text-red-600 text-sm mt-1">Error message</p>

// Valid input (optional)
<input className="border-green-500 focus:ring-green-500" />
```

### Error Messages

- **Be specific:** "Invalid API key" not "Error"
- **Be helpful:** Suggest solutions
- **Be visible:** Red color, icon, prominent position
- **Be dismissible:** Option to clear error

---

## Loading States

### Patterns

1. **Button loading:** Change text to "Processing..."
2. **Progress bar:** Show percentage if available
3. **Spinner:** For indeterminate progress
4. **Disabled inputs:** Prevent changes during processing

### Implementation

```jsx
{processing && (
  <div className="text-center">
    <div className="animate-pulse">Processing...</div>
    <p className="text-sm text-gray-500 mt-2">
      This may take a few minutes for large files
    </p>
  </div>
)}
```

---

## Success States

### Patterns

1. **Success message:** Green banner with checkmark
2. **Auto-download:** File downloads automatically
3. **Download button:** Manual download option
4. **Clear state:** Option to start over

### Implementation

```jsx
{status === 'success' && (
  <div className="p-4 bg-green-50 rounded-lg text-green-800">
    Conversion complete! Your download should start automatically.
    <button className="ml-4 underline">Download again</button>
  </div>
)}
```

---

## Copy & Microcopy

### Button Labels

- **Primary action:** "Convert to Markdown" (specific)
- **Secondary:** "Cancel", "Reset", "Clear"
- **Loading:** "Processing...", "Converting..."

### Helper Text

- Be concise: "Up to 1GB" not "Maximum file size is 1 gigabyte"
- Be friendly: "Drop file here" not "File input area"
- Be clear: "This may take a while" not "Please wait"

### Error Messages

- "Invalid API key. Check your key and try again."
- "File too large. Maximum size is 1GB."
- "Conversion failed. Please try again or contact support."

---

## Performance Guidelines

### Images

- Use SVG for icons (scalable, small)
- Optimize PNGs/JPEGs
- Use Next.js Image component
- Lazy load below the fold

### Code

- Code split by route
- Dynamic imports for heavy libraries
- Tree-shake unused code
- Minimize bundle size

### UX

- Show immediate feedback (<100ms)
- Progress indicators for >1s operations
- Skeleton screens for loading
- Optimistic UI updates

---

## Testing Checklist

### Visual Testing

- [ ] All components match design
- [ ] Consistent spacing
- [ ] Proper alignment
- [ ] Dark mode works
- [ ] Responsive on all breakpoints

### Functional Testing

- [ ] All buttons work
- [ ] Forms validate correctly
- [ ] File uploads work
- [ ] Downloads work
- [ ] localStorage persists

### Accessibility Testing

- [ ] Keyboard navigation works
- [ ] Screen reader friendly
- [ ] Color contrast passes
- [ ] Focus indicators visible
- [ ] ARIA labels correct

### Browser Testing

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile browsers

---

This design system should be treated as a living document and updated as the project evolves.
