/**
 * Tests for classNames utility (cn function)
 *
 * This is a simple example test to verify the testing infrastructure works.
 * More comprehensive tests will be added in subsequent PRs.
 */

import { describe, it, expect } from 'vitest'
import { cn } from './classNames'

describe('cn (classNames utility)', () => {
  it('should merge multiple class names', () => {
    expect(cn('class1', 'class2', 'class3')).toBe('class1 class2 class3')
  })

  it('should filter out falsy values', () => {
    expect(cn('class1', false, 'class2', null, 'class3', undefined)).toBe('class1 class2 class3')
  })

  it('should handle empty input', () => {
    expect(cn()).toBe('')
  })

  it('should handle all falsy values', () => {
    expect(cn(false, null, undefined)).toBe('')
  })

  it('should handle single class name', () => {
    expect(cn('single-class')).toBe('single-class')
  })

  it('should handle conditional classes', () => {
    const isActive = true
    const isDisabled = false
    expect(cn('base-class', isActive && 'active', isDisabled && 'disabled')).toBe('base-class active')
  })

  it('should preserve spaces in class names', () => {
    expect(cn('class-with spaces', 'another')).toBe('class-with spaces another')
  })

  it('should handle duplicate class names', () => {
    // Note: cn does not deduplicate - this is expected behavior
    expect(cn('duplicate', 'duplicate')).toBe('duplicate duplicate')
  })
})
