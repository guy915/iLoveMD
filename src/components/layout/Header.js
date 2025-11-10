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
            type="button"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle mobile menu"
            aria-expanded={mobileMenuOpen}
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
