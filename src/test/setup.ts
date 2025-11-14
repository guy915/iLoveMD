/**
 * Vitest Test Setup
 *
 * This file runs before each test file and sets up:
 * - Testing library matchers (@testing-library/jest-dom)
 * - Browser API mocks (localStorage, sessionStorage, URL, etc.)
 * - Global test utilities
 */

import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Cleanup after each test (unmount React components)
afterEach(() => {
  cleanup()
})

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
    get length() {
      return Object.keys(store).length
    },
    key: (index: number) => {
      const keys = Object.keys(store)
      return keys[index] || null
    },
  }
})()

global.localStorage = localStorageMock as Storage

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
    get length() {
      return Object.keys(store).length
    },
    key: (index: number) => {
      const keys = Object.keys(store)
      return keys[index] || null
    },
  }
})()

global.sessionStorage = sessionStorageMock as Storage

// Mock URL.createObjectURL and revokeObjectURL (used in downloadUtils)
global.URL.createObjectURL = vi.fn(() => 'mock-object-url')
global.URL.revokeObjectURL = vi.fn()

// Mock window.matchMedia (used in some components)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Suppress console errors in tests (optional - can be removed if you want to see them)
// Uncomment to hide expected errors during testing:
// global.console.error = vi.fn()
// global.console.warn = vi.fn()
