'use client'
import Link from 'next/link'
import { useState, useCallback } from 'react'
import { NAV_LINKS } from '@/lib/constants'

/**
 * Header component with navigation menu
 * Includes responsive mobile menu with hamburger toggle
 */
export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Memoize toggle function to prevent unnecessary re-renders
  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen(prev => !prev)
  }, [])

  // Memoize close menu function
  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false)
  }, [])

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
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="hover:text-primary-600"
              >
                {link.shortLabel}
              </Link>
            ))}
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            className="md:hidden text-2xl"
            onClick={toggleMobileMenu}
            aria-label="Toggle mobile menu"
            aria-expanded={mobileMenuOpen}
          >
            <span aria-hidden="true">&#9776;</span>
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 space-y-2">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block py-2"
                onClick={closeMobileMenu}
              >
                {link.shortLabel}
              </Link>
            ))}
          </div>
        )}
      </nav>
    </header>
  )
}
