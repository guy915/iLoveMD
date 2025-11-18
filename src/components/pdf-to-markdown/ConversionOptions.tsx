import { useState, useEffect } from 'react'
import type { MarkerOptions, PageFormatOption } from '@/types'
import type { ConversionMode } from '@/hooks/useConversionMode'

interface ConversionOptionsProps {
  mode: ConversionMode
  options: MarkerOptions
  onOptionChange: (key: keyof MarkerOptions, value: boolean | string) => void
  disabled?: boolean
}

/**
 * Component for conversion options checkboxes.
 * Options vary based on conversion mode (free vs paid).
 */
export function ConversionOptions({
  mode,
  options,
  onOptionChange,
  disabled = false
}: ConversionOptionsProps) {
  // Track user's intent for dependent options separately from their enabled state
  // This allows checkboxes to remain checked (but disabled) when dependencies are off
  const [pageNumbersIntent, setPageNumbersIntent] = useState(false)
  const [imageDescriptionsIntent, setImageDescriptionsIntent] = useState(false)

  // Sync intent with loaded options ONCE on mount (to load persisted preferences)
  // but do NOT re-sync on subsequent changes (to preserve user intent)
  useEffect(() => {
    setPageNumbersIntent(options.pageFormat === 'with_numbers')
    setImageDescriptionsIntent(options.disable_image_extraction)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty deps = only run on mount

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Conversion Options</h2>

      <div className="space-y-3">
        <label className="flex items-start">
          <input
            type="checkbox"
            checked={options.paginate}
            onChange={(e) => {
              const checked = e.target.checked
              onOptionChange('paginate', checked)
              // Set appropriate page format when toggling paginate
              if (checked) {
                // When enabling paginate, restore user's intent for page numbers
                onOptionChange('pageFormat', pageNumbersIntent ? 'with_numbers' : 'separators_only')
              } else {
                onOptionChange('pageFormat', 'none')
              }
            }}
            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            disabled={disabled}
          />
          <span className="ml-3">
            <span className="block text-sm font-medium text-gray-900">Add page separators</span>
            <span className="block text-sm text-gray-500">Add page breaks to the output</span>
          </span>
        </label>

        <label className="flex items-start">
          <input
            type="checkbox"
            checked={pageNumbersIntent}
            onChange={(e) => {
              const checked = e.target.checked
              setPageNumbersIntent(checked)
              // Only update actual option if paginate is enabled
              if (options.paginate) {
                onOptionChange('pageFormat', checked ? 'with_numbers' : 'separators_only')
              }
            }}
            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            disabled={disabled || !options.paginate}
          />
          <span className="ml-3">
            <span className="block text-sm font-medium text-gray-900">Add page numbers</span>
            <span className="block text-sm text-gray-500">
              {options.paginate
                ? 'Add page numbering to the output'
                : 'Requires page separators to be enabled'}
            </span>
          </span>
        </label>

        <label className="flex items-start">
          <input
            type="checkbox"
            checked={options.format_lines}
            onChange={(e) => onOptionChange('format_lines', e.target.checked)}
            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            disabled={disabled}
          />
          <span className="ml-3">
            <span className="block text-sm font-medium text-gray-900">Format lines</span>
            <span className="block text-sm text-gray-500">Apply line formatting to improve readability</span>
          </span>
        </label>

        {/* Local mode only options */}
        {mode === 'free' && (
          <label className="flex items-start">
            <input
              type="checkbox"
              checked={options.redo_inline_math ?? false}
              onChange={(e) => onOptionChange('redo_inline_math', e.target.checked)}
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              disabled={disabled}
            />
            <span className="ml-3">
              <span className="block text-sm font-medium text-gray-900">Format math expressions</span>
              <span className="block text-sm text-gray-500">
                Apply LaTeX formatting to improve readability
              </span>
            </span>
          </label>
        )}

        <label className="flex items-start">
          <input
            type="checkbox"
            checked={options.use_llm}
            onChange={(e) => {
              const newValue = e.target.checked
              onOptionChange('use_llm', newValue)
              // When re-enabling LLM, restore user's intent for image descriptions
              if (newValue && imageDescriptionsIntent) {
                onOptionChange('disable_image_extraction', true)
              } else if (!newValue) {
                // When disabling LLM, must also disable image extraction
                onOptionChange('disable_image_extraction', false)
              }
            }}
            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            disabled={disabled}
          />
          <span className="ml-3">
            <span className="block text-sm font-medium text-gray-900">LLM enhancement</span>
            <span className="block text-sm text-gray-500">Improve accuracy with AI</span>
          </span>
        </label>

        <label className="flex items-start">
          <input
            type="checkbox"
            checked={imageDescriptionsIntent}
            onChange={(e) => {
              const checked = e.target.checked
              setImageDescriptionsIntent(checked)
              // Only update actual option if use_llm is enabled
              if (options.use_llm) {
                onOptionChange('disable_image_extraction', checked)
              }
            }}
            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            disabled={disabled || !options.use_llm}
          />
          <span className="ml-3">
            <span className="block text-sm font-medium text-gray-900">Create image descriptions</span>
            <span className="block text-sm text-gray-500">
              {options.use_llm
                ? 'Replace images with text descriptions'
                : 'Requires LLM enhancement to be enabled'}
            </span>
          </span>
        </label>
      </div>
    </div>
  )
}
