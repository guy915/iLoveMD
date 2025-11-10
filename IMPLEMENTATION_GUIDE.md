# Implementation Guide

This guide provides a step-by-step roadmap for implementing AI Doc Prep.

## Implementation Phases

### Phase 1: Project Setup (Day 1)
### Phase 2: Core UI & Layout (Day 1-2)
### Phase 3: PDF Tool (Day 2-3)
### Phase 4: HTML Tool (Day 3-4)
### Phase 5: Merge Tool (Day 4-5)
### Phase 6: Polish & Deploy (Day 5-7)

---

## Phase 1: Project Setup

### 1.1 Initialize Next.js Project

```bash
npx create-next-app@latest ai-doc-prep
# Choose:
# - TypeScript? No (using JavaScript)
# - ESLint? Yes
# - Tailwind CSS? Yes
# - src/ directory? Yes
# - App Router? Yes
# - Import alias? Yes (@/*)

cd ai-doc-prep
```

### 1.2 Install Dependencies

```bash
npm install turndown @mozilla/readability
```

### 1.3 Clean Up Boilerplate

```bash
# Remove default files
rm src/app/page.module.css
rm src/app/globals.css  # We'll recreate it

# Create directory structure
mkdir -p src/components/layout
mkdir -p src/components/common
mkdir -p src/components/tools
mkdir -p src/components/home
mkdir -p src/lib/processors
mkdir -p src/lib/api
mkdir -p src/lib/utils
mkdir -p src/lib/storage
mkdir -p src/hooks
```

### 1.4 Setup Tailwind Config

```javascript
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        }
      }
    },
  },
  plugins: [],
}
```

### 1.5 Create Global Styles

```css
/* src/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --foreground: #111827;
  --background: #ffffff;
}

@media (prefers-color-scheme: dark) {
  :root {
    --foreground: #f9fafb;
    --background: #111827;
  }
}

body {
  color: var(--foreground);
  background: var(--background);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}
```

### 1.6 Initialize Git

```bash
git init
git add .
git commit -m "Initial project setup"
```

### 1.7 Create GitHub Repository

```bash
# Create repo on GitHub, then:
git remote add origin https://github.com/yourusername/ai-doc-prep.git
git branch -M main
git push -u origin main
```

**Checkpoint:** Project initialized, dependencies installed, Git setup complete.

---

## Phase 2: Core UI & Layout

### 2.1 Create Custom Hooks

```javascript
// src/hooks/useLocalStorage.js
'use client'
import { useState, useEffect } from 'react'

export default function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(initialValue)

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const item = window.localStorage.getItem(key)
      if (item) {
        setStoredValue(JSON.parse(item))
      }
    } catch (error) {
      console.error('Error reading from localStorage:', error)
    }
  }, [key])

  const setValue = (value) => {
    try {
      setStoredValue(value)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(value))
      }
    } catch (error) {
      console.error('Error writing to localStorage:', error)
    }
  }

  return [storedValue, setValue]
}
```

### 2.2 Create Layout Components

```javascript
// src/components/layout/Header.js
'use client'
import Link from 'next/link'
import { useState } from 'react'

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-semibold text-lg">
            📄 AI Doc Prep
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <Link href="/pdf-to-markdown" className="hover:text-primary-600">
              PDF to MD
            </Link>
            <Link href="/html-to-markdown" className="hover:text-primary-600">
              HTML to MD
            </Link>
            <Link href="/merge-markdown" className="hover:text-primary-600">
              Merge MD
            </Link>
            <Link href="/help" className="hover:text-primary-600">
              Help
            </Link>
            <Link href="/about" className="hover:text-primary-600">
              About
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            ☰
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 space-y-2">
            <Link href="/pdf-to-markdown" className="block py-2">
              PDF to MD
            </Link>
            <Link href="/html-to-markdown" className="block py-2">
              HTML to MD
            </Link>
            <Link href="/merge-markdown" className="block py-2">
              Merge MD
            </Link>
            <Link href="/help" className="block py-2">
              Help
            </Link>
            <Link href="/about" className="block py-2">
              About
            </Link>
          </div>
        )}
      </nav>
    </header>
  )
}
```

```javascript
// src/components/layout/Footer.js
export default function Footer() {
  return (
    <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
          © 2025 AI Doc Prep. Free tool for preparing documents for LLMs.
        </p>
      </div>
    </footer>
  )
}
```

### 2.3 Create Root Layout

```javascript
// src/app/layout.js
import './globals.css'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

export const metadata = {
  title: 'AI Doc Prep',
  description: 'Prepare documents for LLMs - Convert PDFs, HTML, and merge markdown files',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}
```

### 2.4 Create Homepage

```javascript
// src/components/home/ToolTile.js
import Link from 'next/link'

export default function ToolTile({ icon, title, description, href }) {
  return (
    <Link
      href={href}
      className="block p-8 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-500 hover:shadow-lg transition-all"
    >
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-600 dark:text-gray-400">{description}</p>
    </Link>
  )
}
```

```javascript
// src/app/page.js
import ToolTile from '@/components/home/ToolTile'

export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">AI Doc Prep</h1>
        <p className="text-xl text-gray-600 dark:text-gray-400">
          Prepare your documents for LLMs
        </p>
      </div>

      {/* Tool Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
        <ToolTile
          icon="📄→📝"
          title="PDF to Markdown"
          description="Convert PDFs to clean markdown using Marker AI"
          href="/pdf-to-markdown"
        />
        <ToolTile
          icon="🌐→📝"
          title="HTML to Markdown"
          description="Convert HTML files or URLs to markdown"
          href="/html-to-markdown"
        />
        <ToolTile
          icon="📝+📝→📝"
          title="Merge Markdowns"
          description="Combine multiple markdown files into one"
          href="/merge-markdown"
        />
      </div>
    </div>
  )
}
```

### 2.5 Create Reusable Components

```javascript
// src/components/common/Button.js
export default function Button({
  children,
  onClick,
  disabled,
  loading,
  variant = 'primary'
}) {
  const baseClasses = "px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
  const variantClasses = variant === 'primary'
    ? "bg-primary-600 text-white hover:bg-primary-700"
    : "bg-gray-200 text-gray-900 hover:bg-gray-300"

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses}`}
    >
      {loading ? 'Processing...' : children}
    </button>
  )
}
```

```javascript
// src/components/common/FileUpload.js
'use client'
import { useState } from 'react'

export default function FileUpload({
  onFileSelect,
  accept,
  maxSize = 1024 * 1024 * 1024, // 1GB
  label = "Drop file here or click to browse"
}) {
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [error, setError] = useState(null)

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const validateAndSelect = (file) => {
    setError(null)

    if (!file) return

    if (file.size > maxSize) {
      setError(`File too large. Maximum size: ${Math.round(maxSize / 1024 / 1024)}MB`)
      return
    }

    setSelectedFile(file)
    onFileSelect(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSelect(e.dataTransfer.files[0])
    }
  }

  const handleChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSelect(e.target.files[0])
    }
  }

  return (
    <div>
      <div
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
          dragActive
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
            : 'border-gray-300 dark:border-gray-700 hover:border-primary-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input').click()}
      >
        <input
          id="file-input"
          type="file"
          accept={accept}
          onChange={handleChange}
          className="hidden"
        />
        <div className="text-4xl mb-4">📄</div>
        <p className="text-lg mb-2">{label}</p>
        {selectedFile && (
          <p className="text-sm text-primary-600 font-medium">
            Selected: {selectedFile.name}
          </p>
        )}
        <p className="text-sm text-gray-500 mt-2">
          Supported: {accept}, up to {Math.round(maxSize / 1024 / 1024)}MB
        </p>
      </div>
      {error && (
        <p className="text-red-600 text-sm mt-2">{error}</p>
      )}
    </div>
  )
}
```

**Checkpoint:** Core UI complete, homepage works, navigation works.

---

## Phase 3: PDF Tool Implementation

### 3.1 Create API Route

```javascript
// src/app/api/marker/route.js
import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const apiKey = formData.get('apiKey')
    const options = JSON.parse(formData.get('options'))

    // Validate inputs
    if (!file || !apiKey) {
      return NextResponse.json(
        { success: false, error: 'Missing file or API key' },
        { status: 400 }
      )
    }

    // Build Marker API request
    const markerFormData = new FormData()
    markerFormData.append('file', file)
    markerFormData.append('output_format', options.outputFormat || 'markdown')
    markerFormData.append('paginate', options.paginate || false)
    markerFormData.append('use_llm', options.useLLM || false)
    markerFormData.append('force_ocr', options.forceOCR || false)
    markerFormData.append('mode', options.mode || 'accurate')

    if (options.pageRange) {
      markerFormData.append('page_range', options.pageRange)
    }
    if (options.maxPages) {
      markerFormData.append('max_pages', options.maxPages)
    }

    // Call Marker API
    const response = await fetch('https://www.datalab.to/api/v1/marker', {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
      },
      body: markerFormData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Marker API error: ${response.status} - ${errorText}`)
    }

    const result = await response.text()

    return NextResponse.json({
      success: true,
      data: result,
      format: options.outputFormat
    })

  } catch (error) {
    console.error('API route error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
```

### 3.2 Create Utility Functions

```javascript
// src/lib/utils/downloadUtils.js
export function downloadFile(content, filename, mimeType = 'text/markdown') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function getFileExtension(format) {
  const extensions = {
    'markdown': '.md',
    'json': '.json',
    'html': '.html',
    'chunks': '.json'
  }
  return extensions[format] || '.md'
}
```

### 3.3 Create PDF Tool Page

```javascript
// src/app/pdf-to-markdown/page.js
'use client'
import { useState } from 'react'
import FileUpload from '@/components/common/FileUpload'
import Button from '@/components/common/Button'
import useLocalStorage from '@/hooks/useLocalStorage'
import { downloadFile, getFileExtension } from '@/lib/utils/downloadUtils'

export default function PdfToMarkdown() {
  const [file, setFile] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  const [apiKey, setApiKey] = useLocalStorage('markerApiKey', '')
  const [options, setOptions] = useLocalStorage('pdfOptions', {
    paginate: false,
    useLLM: false,
    forceOCR: false,
    mode: 'accurate',
    outputFormat: 'markdown',
    pageRange: '',
    maxPages: ''
  })

  const handleConvert = async () => {
    if (!file || !apiKey) {
      setError('Please select a file and enter API key')
      return
    }

    setProcessing(true)
    setStatus('processing')
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('apiKey', apiKey)
      formData.append('options', JSON.stringify(options))

      const response = await fetch('/api/marker', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Conversion failed')
      }

      // Download result
      const extension = getFileExtension(options.outputFormat)
      const filename = file.name.replace(/\.[^/.]+$/, '') + extension
      downloadFile(result.data, filename)

      setStatus('success')
    } catch (err) {
      setError(err.message)
      setStatus('error')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">PDF to Markdown</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Convert PDFs to clean markdown using Marker AI
        </p>
      </div>

      {/* File Upload */}
      <div className="mb-8">
        <FileUpload
          onFileSelect={setFile}
          accept=".pdf"
          label="Drop PDF file here or click to browse"
        />
      </div>

      {/* API Key */}
      <div className="mb-8">
        <label className="block text-sm font-medium mb-2">
          Marker API Key
        </label>
        <div className="flex gap-2">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your Marker API key"
            className="flex-1 px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
          />
          <a
            href="https://www.datalab.to/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 hover:underline text-sm py-2"
          >
            Get API key
          </a>
        </div>
      </div>

      {/* Options */}
      <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <h3 className="font-semibold mb-4">Options</h3>

        <div className="space-y-4">
          {/* Output Format */}
          <div>
            <label className="block text-sm font-medium mb-2">Output Format</label>
            <div className="flex gap-4">
              {['markdown', 'json', 'html', 'chunks'].map((format) => (
                <label key={format} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="outputFormat"
                    value={format}
                    checked={options.outputFormat === format}
                    onChange={(e) => setOptions({...options, outputFormat: e.target.value})}
                  />
                  {format}
                </label>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={options.paginate}
              onChange={(e) => setOptions({...options, paginate: e.target.checked})}
            />
            Paginate (include page numbers)
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={options.useLLM}
              onChange={(e) => setOptions({...options, useLLM: e.target.checked})}
            />
            Use LLM Enhancement (slower, more accurate)
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={options.forceOCR}
              onChange={(e) => setOptions({...options, forceOCR: e.target.checked})}
            />
            Force OCR (for scanned documents)
          </label>

          {/* Mode */}
          <div>
            <label className="block text-sm font-medium mb-2">Mode</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="mode"
                  value="fast"
                  checked={options.mode === 'fast'}
                  onChange={(e) => setOptions({...options, mode: e.target.value})}
                />
                Fast
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="mode"
                  value="accurate"
                  checked={options.mode === 'accurate'}
                  onChange={(e) => setOptions({...options, mode: e.target.value})}
                />
                Accurate
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Convert Button */}
      <div className="text-center mb-8">
        <Button
          onClick={handleConvert}
          disabled={!file || !apiKey}
          loading={processing}
        >
          Convert to Markdown
        </Button>
      </div>

      {/* Status Messages */}
      {status === 'processing' && (
        <div className="text-center text-blue-600">
          Processing... This may take a while for large files.
        </div>
      )}
      {status === 'success' && (
        <div className="text-center text-green-600">
          Conversion complete! Download started.
        </div>
      )}
      {error && (
        <div className="text-center text-red-600">
          Error: {error}
        </div>
      )}
    </div>
  )
}
```

**Checkpoint:** PDF tool complete and functional.

---

## Phase 4: HTML Tool (Simplified implementation notes)

### 4.1 Install dependencies (already done in Phase 1)
### 4.2 Create /api/fetch-url route
### 4.3 Create HTML processing utilities in /lib/processors/htmlProcessor.js
### 4.4 Create /html-to-markdown/page.js with tabs for file/URL input
### 4.5 Integrate Turndown.js for conversion

**Similar structure to PDF tool, reference ARCHITECTURE.md for details.**

---

## Phase 5: Merge Tool (Simplified implementation notes)

### 5.1 Create merge utilities in /lib/processors/mergeProcessor.js
### 5.2 Create /merge-markdown/page.js
### 5.3 Implement multi-file upload
### 5.4 Implement drag-to-reorder
### 5.5 Implement merge logic with separators

**All client-side, no API routes needed.**

---

## Phase 6: Polish & Deploy

### 6.1 Create Help Page

```javascript
// src/app/help/page.js
export default function Help() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">Help & FAQ</h1>
      {/* Add FAQ content */}
    </div>
  )
}
```

### 6.2 Create About Page

```javascript
// src/app/about/page.js
export default function About() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">About AI Doc Prep</h1>
      {/* Add about content */}
    </div>
  )
}
```

### 6.3 Test Everything

- [ ] All tools work with various file sizes
- [ ] Error messages display correctly
- [ ] localStorage persists preferences
- [ ] Mobile responsive
- [ ] Dark mode works
- [ ] Cross-browser testing

### 6.4 Deploy to Vercel

```bash
# Push to GitHub
git add .
git commit -m "Complete implementation"
git push

# Deploy via Vercel dashboard or CLI
npm i -g vercel
vercel --prod
```

### 6.5 Final Polish

- [ ] Add metadata for SEO
- [ ] Add favicon
- [ ] Test deployed version
- [ ] Share with friends

---

## Troubleshooting Common Issues

### Issue: Next.js hydration errors
**Solution:** Make sure client components use `'use client'` directive

### Issue: localStorage not working
**Solution:** Check for SSR issues, always check `typeof window !== 'undefined'`

### Issue: File upload not working
**Solution:** Check file size limits, MIME types, FormData construction

### Issue: API route timeout
**Solution:** Vercel free tier has 10s timeout, upgrade or optimize

---

## Next Steps After v1

1. Add token counter tool
2. Add markdown splitter
3. Improve mobile UI
4. Add batch processing
5. Add more customization options
6. Performance optimizations
7. Accessibility improvements

---

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Marker API Documentation](https://documentation.datalab.to/)
- [Turndown Documentation](https://github.com/mixmark-io/turndown)
- [Vercel Deployment Guide](https://vercel.com/docs)
