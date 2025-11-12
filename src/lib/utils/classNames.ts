/**
 * Utility for merging class names conditionally
 * Lightweight alternative to classnames/clsx libraries
 * @param classes - Array of class names or conditional expressions
 * @returns Merged class name string
 */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}
