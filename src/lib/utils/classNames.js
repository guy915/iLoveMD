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

/**
 * Helper function for conditional class names
 * @param {boolean} condition - Condition to check
 * @param {string} truthyClass - Class to apply if condition is true
 * @param {string} falsyClass - Class to apply if condition is false
 * @returns {string} The appropriate class name
 *
 * @example
 * conditional(isActive, 'bg-blue-500', 'bg-gray-500')
 * // => 'bg-blue-500' if isActive, otherwise 'bg-gray-500'
 */
export function conditional(condition, truthyClass, falsyClass = '') {
  return condition ? truthyClass : falsyClass
}

export default cn
