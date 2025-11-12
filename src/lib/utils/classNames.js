/**
 * Utility for merging className strings conditionally
 * A lightweight alternative to classnames/clsx libraries
 *
 * @param {...(string|Object|Array|undefined|null|boolean)} classes - Class names or objects
 * @returns {string} Merged class names
 *
 * @example
 * cn('base-class', isActive && 'active', 'another-class')
 * // => 'base-class active another-class'
 *
 * @example
 * cn('base', { 'active': isActive, 'disabled': isDisabled })
 * // => 'base active' (if isActive is true and isDisabled is false)
 */
export function cn(...classes) {
  return classes
    .flat()
    .map((cls) => {
      if (typeof cls === 'string') return cls;
      if (typeof cls === 'object' && cls !== null) {
        return Object.entries(cls)
          .filter(([, value]) => Boolean(value))
          .map(([key]) => key)
      }
      return '';
    })
    .flat()
    .filter((cls) => typeof cls === 'string' && cls.trim().length > 0)
    .join(' ')
    .trim()
}

export default cn
