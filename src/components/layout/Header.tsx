'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useCallback, useEffect } from 'react'
import { NAV_LINKS } from '@/lib/constants'
import type { NavLink } from '@/types'
import { useLogs } from '@/contexts/LogContext'
import GlobalDiagnosticPanel from './GlobalDiagnosticPanel'

/**
 * Navigation link component that handles both internal and external links
 */
function NavLinkItem({
  link,
  onClick,
  className
}: {
  link: NavLink
  onClick: () => void
  className: string
}) {
  if (link.external) {
    return (
      <a
        key={link.href}
        href={link.href}
        className={className}
        onClick={onClick}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${link.shortLabel} (opens in new tab)`}
      >
        {link.shortLabel}
      </a>
    )
  }

  return (
    <Link
      key={link.href}
      href={link.href}
      className={className}
      onClick={onClick}
    >
      {link.shortLabel}
    </Link>
  )
}

/**
 * Header component with navigation menu
 * Includes responsive mobile menu with hamburger toggle
 */
export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { addLog } = useLogs()

  // Log when Header mounts (page load)
  useEffect(() => {
    addLog('info', 'Header component mounted - Page loaded')
  }, [addLog])

  // Memoize toggle function to prevent unnecessary re-renders
  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen(prev => {
      const newState = !prev
      addLog('info', `Mobile menu ${newState ? 'opened' : 'closed'}`)
      return newState
    })
  }, [addLog])

  // Memoize close menu function
  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false)
    addLog('info', 'Mobile menu closed')
  }, [addLog])

  // Log navigation clicks
  const handleNavClick = useCallback((linkLabel: string, linkHref: string) => {
    addLog('info', `Navigation clicked: ${linkLabel}`, { href: linkHref })
  }, [addLog])

  return (
    <header className="bg-white border-b border-gray-200">
      <nav className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Diagnostic Panel */}
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2"
              onClick={() => addLog('info', 'Logo clicked - Navigating to home')}
            >
              <Image
                src="/logo.svg"
                alt="iLoveLLM"
                width={120}
                height={40}
                style={{ height: 'auto' }}
                priority
              />
            </Link>
            <GlobalDiagnosticPanel />
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <NavLinkItem
                key={link.href}
                link={link}
                onClick={() => handleNavClick(link.shortLabel, link.href)}
                className="hover:text-primary-600"
              />
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
              <NavLinkItem
                key={link.href}
                link={link}
                onClick={() => {
                  handleNavClick(link.shortLabel, link.href)
                  closeMobileMenu()
                }}
                className="block py-2"
              />
            ))}
          </div>
        )}
      </nav>
    </header>
  )
}
