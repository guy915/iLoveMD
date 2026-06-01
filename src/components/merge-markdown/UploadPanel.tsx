import { useRef, ChangeEvent } from 'react'
import Button from '@/components/common/Button'
import { FILE_SIZE } from '@/lib/constants'
import { useLogs } from '@/contexts/LogContext'
import type { MarkdownFile, SortMode, SeparatorStyle } from '@/types/markdown'

interface UploadPanelProps {
  files: MarkdownFile[]
  sortMode: SortMode
  separatorStyle: SeparatorStyle
  addHeaders: boolean
  onFileSelect: (e: ChangeEvent<HTMLInputElement>) => void
  onFolderSelect: (e: ChangeEvent<HTMLInputElement>) => void
  onToggleAlphabetical: () => void
  onSeparatorChange: (style: SeparatorStyle) => void
  onHeadersChange: (enabled: boolean) => void
  onMergeAndDownload: () => void
  onClearAll: () => void
}

/**
 * Component for the upload panel.
 * On desktop: fixed right sidebar (w-80).
 * On mobile: full-width horizontal toolbar at the top.
 */
export function UploadPanel({
  files,
  sortMode,
  separatorStyle,
  addHeaders,
  onFileSelect,
  onFolderSelect,
  onToggleAlphabetical,
  onSeparatorChange,
  onHeadersChange,
  onMergeAndDownload,
  onClearAll
}: UploadPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const { addLog } = useLogs()

  const handleUploadClick = () => {
    addLog('info', 'Upload Files button clicked')
    fileInputRef.current?.click()
  }

  const handleFolderUploadClick = () => {
    addLog('info', 'Upload Folder button clicked')
    folderInputRef.current?.click()
  }

  return (
    <>
      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown"
        multiple
        onChange={onFileSelect}
        className="hidden"
      />
      <input
        ref={folderInputRef}
        type="file"
        /* @ts-ignore - webkitdirectory is not in TypeScript types but works in browsers */
        webkitdirectory=""
        directory=""
        onChange={onFolderSelect}
        className="hidden"
      />

      {/* ─── Mobile: top toolbar (visible below md) ─── */}
      <div className="md:hidden bg-white border-b border-gray-200 px-4 py-3">
        {/* Row 1: Upload buttons + file count */}
        <div className="flex items-center gap-2 mb-3">
          <Button onClick={handleUploadClick} variant="primary" className="flex-1 text-sm">
            Upload Files
          </Button>
          <Button onClick={handleFolderUploadClick} variant="secondary" className="flex-1 text-sm">
            Upload Folder
          </Button>
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {files.length}/{FILE_SIZE.MAX_MERGE_FILES}
          </span>
        </div>

        {/* Row 2: Sort + Options inline */}
        <div className="flex items-center gap-3 text-sm min-w-0">
          {/* Sort toggle */}
          <button
            onClick={onToggleAlphabetical}
            aria-pressed={sortMode !== 'none'}
            className="px-2.5 py-1.5 text-xs font-medium rounded bg-primary-600 text-white hover:bg-primary-700 transition-colors shrink-0"
          >
            {sortMode === 'reverseAlphabetical' ? 'Z → A' : 'A → Z'}
          </button>

          {/* Headers toggle */}
          <label className="flex items-center gap-1 cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={addHeaders}
              onChange={(e) => {
                onHeadersChange(e.target.checked)
                addLog('info', `File headers ${e.target.checked ? 'enabled' : 'disabled'}`)
              }}
              className="w-3.5 h-3.5 text-primary-600 rounded"
            />
            <span className="text-xs text-gray-700">Headers</span>
          </label>

          {/* Separator selector */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs text-gray-500 truncate min-w-0 inline-block" title="Separation">
              Separation:
            </span>
            <label className="flex items-center gap-1 cursor-pointer shrink-0">
              <input
                type="radio"
                name="separator-mobile"
                value="newline"
                checked={separatorStyle === 'newline'}
                onChange={(e) => {
                  onSeparatorChange(e.target.value as SeparatorStyle)
                  addLog('info', 'Separator changed to: newline')
                }}
                className="w-3.5 h-3.5 text-primary-600"
              />
              <span className="text-xs text-gray-700">Newline</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer shrink-0">
              <input
                type="radio"
                name="separator-mobile"
                value="page-break"
                checked={separatorStyle === 'page-break'}
                onChange={(e) => {
                  onSeparatorChange(e.target.value as SeparatorStyle)
                  addLog('info', 'Separator changed to: page break')
                }}
                className="w-3.5 h-3.5 text-primary-600"
              />
              <span className="text-xs text-gray-700">Page break</span>
            </label>
          </div>
        </div>
      </div>

      {/* ─── Desktop: right sidebar (hidden below md) ─── */}
      <div className="hidden md:flex w-80 bg-white border-l border-gray-200 p-6 flex-col">
        <div className="space-y-6 flex-1 overflow-y-auto">
          {/* Upload Section */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Upload Files</h2>
            <div className="space-y-2">
              <Button
                onClick={handleUploadClick}
                variant="primary"
                className="w-full"
              >
                Upload Files
              </Button>
              <Button
                onClick={handleFolderUploadClick}
                variant="secondary"
                className="w-full"
              >
                Upload Folder
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {files.length} / {FILE_SIZE.MAX_MERGE_FILES} files
            </p>
          </div>

          {/* Sorting Section */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Sort Files</h2>
            <button
              onClick={onToggleAlphabetical}
              aria-pressed={sortMode !== 'none'}
              className="w-full px-3 py-2 text-sm font-medium rounded transition-colors bg-primary-600 text-white hover:bg-primary-700"
            >
              {sortMode === 'reverseAlphabetical' ? 'Z → A' : 'A → Z'}
            </button>
          </div>

          {/* Merge Options */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Merge Options</h2>
            <div className="space-y-4">
              {/* Add Headers Checkbox */}
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addHeaders}
                  onChange={(e) => {
                    onHeadersChange(e.target.checked)
                    addLog('info', `File headers ${e.target.checked ? 'enabled' : 'disabled'}`)
                  }}
                  className="w-4 h-4 text-primary-600 focus:ring-primary-500 rounded"
                />
                <span className="text-sm text-gray-700">Add file headers</span>
              </label>

              {/* Separator Style */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Separator
                </label>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="separator"
                      value="newline"
                      checked={separatorStyle === 'newline'}
                      onChange={(e) => {
                        onSeparatorChange(e.target.value as SeparatorStyle)
                        addLog('info', 'Separator changed to: newline')
                      }}
                      className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">Newline</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="separator"
                      value="page-break"
                      checked={separatorStyle === 'page-break'}
                      onChange={(e) => {
                        onSeparatorChange(e.target.value as SeparatorStyle)
                        addLog('info', 'Separator changed to: page break')
                      }}
                      className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">Page break</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="space-y-3 pt-6 border-t border-gray-200">
          {/* Merge Button */}
          <Button
            onClick={onMergeAndDownload}
            variant="primary"
            disabled={files.length === 0}
            className="w-full"
          >
            Merge
          </Button>

          {/* Clear All Button */}
          <Button
            onClick={onClearAll}
            variant="secondary"
            disabled={files.length === 0}
            className="w-full"
          >
            Clear All
          </Button>
        </div>
      </div>
    </>
  )
}
