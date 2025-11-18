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
              // Set default page format when enabling paginate
              if (checked && !options.pageFormat) {
                onOptionChange('pageFormat', 'separators_only')
              }
            }}
            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            disabled={disabled}
          />
          <span className="ml-3">
            <span className="block text-sm font-medium text-gray-900">Add page separators</span>
            <span className="block text-sm text-gray-500">Include page breaks in the output</span>
          </span>
        </label>

        {/* Page format options (shown when paginate is enabled) */}
        {options.paginate && (
          <div className="ml-7 space-y-2 border-l-2 border-gray-200 pl-4">
            <div className="text-sm font-medium text-gray-700 mb-2">Page format:</div>

            <label className="flex items-start cursor-pointer">
              <input
                type="radio"
                name="pageFormat"
                value="separators_only"
                checked={options.pageFormat === 'separators_only'}
                onChange={(e) => onOptionChange('pageFormat', e.target.value as PageFormatOption)}
                className="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                disabled={disabled}
              />
              <span className="ml-3">
                <span className="block text-sm text-gray-900">Separators only</span>
                <span className="block text-xs text-gray-500">Add --- between pages</span>
              </span>
            </label>

            <label className="flex items-start cursor-pointer">
              <input
                type="radio"
                name="pageFormat"
                value="with_numbers"
                checked={options.pageFormat === 'with_numbers'}
                onChange={(e) => onOptionChange('pageFormat', e.target.value as PageFormatOption)}
                className="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                disabled={disabled}
              />
              <span className="ml-3">
                <span className="block text-sm text-gray-900">With page numbers</span>
                <span className="block text-xs text-gray-500">Add &quot;Page X&quot; and --- between pages</span>
              </span>
            </label>
          </div>
        )}

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
              // If disabling LLM, must also reset disable_image_extraction
              // because image extraction requires LLM to be enabled
              if (!newValue) {
                onOptionChange('disable_image_extraction', false)
              }
            }}
            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            disabled={disabled}
          />
          <span className="ml-3">
            <span className="block text-sm font-medium text-gray-900">Use LLM enhancement</span>
            <span className="block text-sm text-gray-500">Improve accuracy with AI (slower, costs more)</span>
          </span>
        </label>

        <label className="flex items-start">
          <input
            type="checkbox"
            checked={options.disable_image_extraction}
            onChange={(e) => onOptionChange('disable_image_extraction', e.target.checked)}
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
