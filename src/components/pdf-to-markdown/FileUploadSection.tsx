import React from 'react'

interface FileUploadSectionProps {
  files: File[]
  folderName: string | null
  onFilesSelect: (files: FileList, fromFolder: boolean) => void
  onClearFiles: () => void
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void
}

/**
 * Component for file upload section with drag-drop support.
 * Includes file/folder selection and file list display.
 */
export function FileUploadSection({
  files,
  folderName,
  onFilesSelect,
  onClearFiles,
  onDrop
}: FileUploadSectionProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div
        className="border-2 border-dashed border-gray-300 rounded-lg relative"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <p className="text-lg py-4 font-medium text-gray-700 text-center">
          Drop PDF files here
        </p>

        <div className="flex items-stretch gap-0 min-h-[180px] border-t border-gray-300">
          {/* Files Button (Left Half) */}
          <label className="flex-1 cursor-pointer flex flex-col items-center justify-center hover:bg-gray-50 transition-colors rounded-bl-lg border-r border-gray-200 py-6">
            <input
              type="file"
              accept=".pdf,application/pdf"
              multiple
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  onFilesSelect(e.target.files, false)
                  e.target.value = ''
                }
              }}
              className="hidden"
            />
            <span className="text-base font-medium text-gray-700">
              Browse Files
            </span>
            <span className="text-sm text-gray-500 mt-1">
              Select individual PDFs
            </span>
          </label>

          {/* Soft Divider */}
          <div className="w-px bg-gray-200"></div>

          {/* Folder Button (Right Half) */}
          <label className="flex-1 cursor-pointer flex flex-col items-center justify-center hover:bg-gray-50 transition-colors rounded-br-lg border-l border-gray-200 py-6">
            <input
              type="file"
              accept=".pdf,application/pdf"
              multiple
              // @ts-ignore - webkitdirectory is not in TypeScript definitions
              webkitdirectory="true"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  onFilesSelect(e.target.files, true)
                  e.target.value = ''
                }
              }}
              className="hidden"
            />
            <span className="text-base font-medium text-gray-700">
              Browse Folders
            </span>
            <span className="text-sm text-gray-500 mt-1">
              Select entire folders
            </span>
          </label>
        </div>

        {files.length > 0 && (
          <div className="border-t border-gray-200 py-3 px-4 bg-gray-50 rounded-b-lg flex items-center justify-between">
            <p className="text-sm text-blue-600 font-medium">
              Selected: {files.length} PDF file{files.length > 1 ? 's' : ''}
              {folderName && ` from "${folderName}"`}
            </p>
            <button
              onClick={onClearFiles}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Clear All
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
