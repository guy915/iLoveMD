'use client'
import Link from 'next/link'
import { useState } from 'react'

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="bg-white border-b border-gray-200">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-semibold text-lg">
            AI Doc Prep
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <Link href="/pdf-to-markdown" className="hover:text-primary-600">
              PDF
            </Link>
            <Link href="/html-to-markdown" className="hover:text-primary-600">
              HTML
            </Link>
            <Link href="/merge-markdown" className="hover:text-primary-600">
              Markdown
            </Link>
            <Link href="/help" className="hover:text-primary-600">
              Help
            </Link>
            <Link href="/about" className="hover:text-primary-600">
              About
            </Link>
            <Link href="/settings" className="hover:text-primary-600">
              Settings
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            className="md:hidden text-2xl"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle mobile menu"
            aria-expanded={mobileMenuOpen}
          >
            &#9776;
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 space-y-2">
            <Link href="/pdf-to-markdown" className="block py-2">
              PDF
            </Link>
            <Link href="/html-to-markdown" className="block py-2">
              HTML
            </Link>
            <Link href="/merge-markdown" className="block py-2">
              Markdown
            </Link>
            <Link href="/help" className="block py-2">
              Help
            </Link>
            <Link href="/about" className="block py-2">
              About
            </Link>
            <Link href="/settings" className="block py-2">
              Settings
            </Link>
          </div>
        )}
      </nav>
    </header>
  )
}
