import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MergeMarkdownPage from './page'
import { FILE_SIZE } from '@/lib/constants'

// Mock LogContext
const mockAddLog = vi.fn()
vi.mock('@/contexts/LogContext', () => ({
  useLogs: () => ({
    addLog: mockAddLog,
  }),
}))

// Mock react-markdown and related plugins
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown-preview">{children}</div>,
}))

vi.mock('remark-gfm', () => ({ default: vi.fn() }))
vi.mock('remark-math', () => ({ default: vi.fn() }))
vi.mock('rehype-katex', () => ({ default: vi.fn() }))

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => `test-uuid-${Math.random()}`,
  },
})

// Helper to create mock File with markdown content
function createMockMarkdownFile(name: string, content: string, size?: number): File {
  const blob = new Blob([content], { type: 'text/markdown' })
  const actualSize = size ?? blob.size
  const file = new File([blob], name, { type: 'text/markdown' })

  Object.defineProperty(file, 'size', {
    value: actualSize,
    writable: false,
  })

  // Mock FileReader for content reading
  const originalFileReader = global.FileReader
  global.FileReader = class MockFileReader {
    onload: ((e: ProgressEvent<FileReader>) => void) | null = null
    onerror: (() => void) | null = null
    result: string | ArrayBuffer | null = null

    readAsText() {
      setTimeout(() => {
        this.result = content
        if (this.onload) {
          this.onload({ target: this } as ProgressEvent<FileReader>)
        }
      }, 0)
    }
  } as any

  return file
}

describe('MergeMarkdownPage', () => {
  beforeEach(() => {
    mockAddLog.mockClear()
    // Mock URL.createObjectURL and URL.revokeObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    global.URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render page title and description', () => {
      render(<MergeMarkdownPage />)
      expect(screen.getByText('Merge Markdown Files')).toBeInTheDocument()
      expect(screen.getByText('Combine multiple markdown files into one document')).toBeInTheDocument()
    })

    it('should render upload buttons', () => {
      render(<MergeMarkdownPage />)
      expect(screen.getByRole('button', { name: 'Upload Files' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Upload Folder' })).toBeInTheDocument()
    })

    it('should render sort button', () => {
      render(<MergeMarkdownPage />)
      expect(screen.getByText('A → Z')).toBeInTheDocument()
    })

    it('should render merge options', () => {
      render(<MergeMarkdownPage />)
      expect(screen.getByText('Merge Options')).toBeInTheDocument()
      expect(screen.getByText('Add file headers (# filename)')).toBeInTheDocument()
      expect(screen.getByText('Separator')).toBeInTheDocument()
    })

    it('should render merge and clear buttons', () => {
      render(<MergeMarkdownPage />)
      expect(screen.getByRole('button', { name: 'Merge & Download' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Clear All Files' })).toBeInTheDocument()
    })

    it('should show empty state when no files uploaded', () => {
      render(<MergeMarkdownPage />)
      expect(screen.getByText('No files uploaded')).toBeInTheDocument()
      expect(screen.getByText(/Click here, drag files, or/)).toBeInTheDocument()
    })

    it('should display file count', () => {
      render(<MergeMarkdownPage />)
      expect(screen.getByText(`0 / ${FILE_SIZE.MAX_MERGE_FILES} files`)).toBeInTheDocument()
    })

    it('should disable merge button when no files', () => {
      render(<MergeMarkdownPage />)
      const mergeButton = screen.getByRole('button', { name: 'Merge & Download' })
      expect(mergeButton).toBeDisabled()
    })

    it('should disable clear button when no files', () => {
      render(<MergeMarkdownPage />)
      const clearButton = screen.getByRole('button', { name: 'Clear All Files' })
      expect(clearButton).toBeDisabled()
    })
  })

  describe('file upload via button', () => {
    it('should upload valid markdown files', async () => {
      const { container } = render(<MergeMarkdownPage />)
      const file = createMockMarkdownFile('test.md', '# Hello World', 1000)

      const uploadButton = screen.getByRole('button', { name: 'Upload Files' })
      fireEvent.click(uploadButton)

      const input = container.querySelector('input[type="file"][accept=".md,.markdown"]') as HTMLInputElement
      fireEvent.change(input, { target: { files: [file] } })

      await waitFor(() => {
        expect(mockAddLog).toHaveBeenCalledWith('info', '1 file(s) selected for upload')
      })

      await waitFor(() => {
        expect(screen.getByText('test.md')).toBeInTheDocument()
      })
    })

    it('should log when upload button is clicked', () => {
      render(<MergeMarkdownPage />)
      const uploadButton = screen.getByRole('button', { name: 'Upload Files' })
      fireEvent.click(uploadButton)

      expect(mockAddLog).toHaveBeenCalledWith('info', 'Upload Files button clicked')
    })

    it('should log when file selection is cancelled', async () => {
      const { container } = render(<MergeMarkdownPage />)

      const uploadButton = screen.getByRole('button', { name: 'Upload Files' })
      fireEvent.click(uploadButton)

      const input = container.querySelector('input[type="file"][accept=".md,.markdown"]') as HTMLInputElement
      fireEvent.change(input, { target: { files: null } })

      await waitFor(() => {
        expect(mockAddLog).toHaveBeenCalledWith('info', 'File selection cancelled')
      })
    })

    it('should upload multiple files', async () => {
      const { container } = render(<MergeMarkdownPage />)
      const file1 = createMockMarkdownFile('file1.md', '# File 1', 1000)
      const file2 = createMockMarkdownFile('file2.md', '# File 2', 1000)

      const uploadButton = screen.getByRole('button', { name: 'Upload Files' })
      fireEvent.click(uploadButton)

      const input = container.querySelector('input[type="file"][accept=".md,.markdown"]') as HTMLInputElement
      fireEvent.change(input, { target: { files: [file1, file2] } })

      await waitFor(() => {
        expect(screen.getByText('file1.md')).toBeInTheDocument()
        expect(screen.getByText('file2.md')).toBeInTheDocument()
      })
    })

    it('should accept .markdown extension', async () => {
      const { container } = render(<MergeMarkdownPage />)
      const file = createMockMarkdownFile('test.markdown', '# Test', 1000)

      const uploadButton = screen.getByRole('button', { name: 'Upload Files' })
      fireEvent.click(uploadButton)

      const input = container.querySelector('input[type="file"][accept=".md,.markdown"]') as HTMLInputElement
      fireEvent.change(input, { target: { files: [file] } })

      await waitFor(() => {
        expect(screen.getByText('test.markdown')).toBeInTheDocument()
      })
    })
  })

  describe('folder upload via button', () => {
    it('should upload folder with markdown files', async () => {
      const { container } = render(<MergeMarkdownPage />)

      // Create files with webkitRelativePath
      const file1 = createMockMarkdownFile('test1.md', '# Test 1', 1000)
      const file2 = createMockMarkdownFile('test2.md', '# Test 2', 1000)

      Object.defineProperty(file1, 'webkitRelativePath', { value: 'folder/test1.md' })
      Object.defineProperty(file2, 'webkitRelativePath', { value: 'folder/test2.md' })

      const folderButton = screen.getByRole('button', { name: 'Upload Folder' })
      fireEvent.click(folderButton)

      const folderInput = container.querySelectorAll('input[type="file"]')[1] as HTMLInputElement
      fireEvent.change(folderInput, { target: { files: [file1, file2] } })

      await waitFor(() => {
        expect(mockAddLog).toHaveBeenCalledWith('info', 'Found 2 markdown file(s) in folder')
      })

      await waitFor(() => {
        expect(screen.getByText('test1.md')).toBeInTheDocument()
        expect(screen.getByText('test2.md')).toBeInTheDocument()
      })
    })

    it('should log when folder upload button is clicked', () => {
      render(<MergeMarkdownPage />)
      const folderButton = screen.getByRole('button', { name: 'Upload Folder' })
      fireEvent.click(folderButton)

      expect(mockAddLog).toHaveBeenCalledWith('info', 'Upload Folder button clicked')
    })

    it('should filter out files in subdirectories', async () => {
      const { container } = render(<MergeMarkdownPage />)

      const file1 = createMockMarkdownFile('test1.md', '# Test 1', 1000)
      const file2 = createMockMarkdownFile('test2.md', '# Test 2', 1000)

      Object.defineProperty(file1, 'webkitRelativePath', { value: 'folder/test1.md' })
      Object.defineProperty(file2, 'webkitRelativePath', { value: 'folder/subfolder/test2.md' })

      const folderButton = screen.getByRole('button', { name: 'Upload Folder' })
      fireEvent.click(folderButton)

      const folderInput = container.querySelectorAll('input[type="file"]')[1] as HTMLInputElement
      fireEvent.change(folderInput, { target: { files: [file1, file2] } })

      await waitFor(() => {
        expect(mockAddLog).toHaveBeenCalledWith('info', 'Found 1 markdown file(s) in folder')
      })

      await waitFor(() => {
        expect(screen.getByText('test1.md')).toBeInTheDocument()
      })
    })

    it('should show error when no markdown files in folder', async () => {
      const { container } = render(<MergeMarkdownPage />)

      const file = createMockMarkdownFile('test.txt', 'Not markdown', 1000)
      Object.defineProperty(file, 'webkitRelativePath', { value: 'folder/test.txt' })
      Object.defineProperty(file, 'name', { value: 'test.txt' })

      const folderButton = screen.getByRole('button', { name: 'Upload Folder' })
      fireEvent.click(folderButton)

      const folderInput = container.querySelectorAll('input[type="file"]')[1] as HTMLInputElement
      fireEvent.change(folderInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(mockAddLog).toHaveBeenCalledWith('error', 'No markdown files found in the immediate folder')
      })
    })

    it('should log when folder selection is cancelled', async () => {
      const { container } = render(<MergeMarkdownPage />)

      const folderButton = screen.getByRole('button', { name: 'Upload Folder' })
      fireEvent.click(folderButton)

      const folderInput = container.querySelectorAll('input[type="file"]')[1] as HTMLInputElement
      fireEvent.change(folderInput, { target: { files: null } })

      await waitFor(() => {
        expect(mockAddLog).toHaveBeenCalledWith('info', 'Folder selection cancelled')
      })
    })
  })

  describe('file validation', () => {
    it('should reject non-markdown files', async () => {
      const { container } = render(<MergeMarkdownPage />)

      // Create a file with .txt extension
      const file = new File(['content'], 'test.txt', { type: 'text/plain' })
      Object.defineProperty(file, 'size', { value: 1000 })

      const uploadButton = screen.getByRole('button', { name: 'Upload Files' })
      fireEvent.click(uploadButton)

      const input = container.querySelector('input[type="file"][accept=".md,.markdown"]') as HTMLInputElement
      fireEvent.change(input, { target: { files: [file] } })

      await waitFor(() => {
        expect(mockAddLog).toHaveBeenCalledWith(
          'error',
          '1 file(s) failed validation',
          expect.objectContaining({
            errors: expect.arrayContaining([expect.stringContaining('Not a markdown file')])
          })
        )
      })
    })

    it('should reject files that exceed individual size limit', async () => {
      const { container } = render(<MergeMarkdownPage />)

      const largeFile = createMockMarkdownFile('large.md', '# Large', FILE_SIZE.MAX_MERGE_FILE_SIZE + 1)

      const uploadButton = screen.getByRole('button', { name: 'Upload Files' })
      fireEvent.click(uploadButton)

      const input = container.querySelector('input[type="file"][accept=".md,.markdown"]') as HTMLInputElement
      fireEvent.change(input, { target: { files: [largeFile] } })

      await waitFor(() => {
        expect(mockAddLog).toHaveBeenCalledWith(
          'error',
          '1 file(s) failed validation',
          expect.objectContaining({
            errors: expect.arrayContaining([expect.stringContaining('File too large')])
          })
        )
      })
    })

    it('should enforce maximum file count limit', async () => {
      const { container } = render(<MergeMarkdownPage />)

      // Create more files than the limit
      const files = Array.from({ length: FILE_SIZE.MAX_MERGE_FILES + 5 }, (_, i) =>
        createMockMarkdownFile(`file${i}.md`, `# File ${i}`, 1000)
      )

      const uploadButton = screen.getByRole('button', { name: 'Upload Files' })
      fireEvent.click(uploadButton)

      const input = container.querySelector('input[type="file"][accept=".md,.markdown"]') as HTMLInputElement
      fireEvent.change(input, { target: { files: files } })

      // Wait for success message for first 200 files
      await waitFor(() => {
        expect(mockAddLog).toHaveBeenCalledWith(
          'success',
          `${FILE_SIZE.MAX_MERGE_FILES} file(s) added successfully`,
          expect.any(Object)
        )
      })

      // Check that error about skipped files was logged
      await waitFor(() => {
        const errorCalls = mockAddLog.mock.calls.filter(call => call[0] === 'error')
        const hasSkippedError = errorCalls.some(call =>
          call[1] === '1 file(s) failed validation' &&
          call[2]?.errors?.some((err: string) => err.includes('5 file(s) skipped'))
        )
        expect(hasSkippedError).toBe(true)
      })
    })

    it('should enforce total size limit across all files', async () => {
      const { container } = render(<MergeMarkdownPage />)

      // Upload first file that's 99GB (under 100GB total limit and 10GB individual limit... wait that's wrong)
      // Actually, we need files under 10GB each. Let's use 9GB files
      const file1Size = 9 * FILE_SIZE.BYTES_PER_GB // 9GB - valid individually

      // Upload first batch of files
      const file1 = createMockMarkdownFile('file1.md', '# File 1', file1Size)

      const uploadButton = screen.getByRole('button', { name: 'Upload Files' })
      fireEvent.click(uploadButton)

      let input = container.querySelector('input[type="file"][accept=".md,.markdown"]') as HTMLInputElement
      fireEvent.change(input, { target: { files: [file1] } })

      // First file should succeed
      await waitFor(() => {
        expect(mockAddLog).toHaveBeenCalledWith(
          'success',
          '1 file(s) added successfully',
          expect.any(Object)
        )
      })

      mockAddLog.mockClear()

      // Now upload 11 more files of 9GB each (11 * 9 = 99GB)
      // Plus the first 9GB = 108GB total, which exceeds 100GB
      const moreFiles = Array.from({ length: 12 }, (_, i) =>
        createMockMarkdownFile(`file${i+2}.md`, `# File ${i+2}`, file1Size)
      )

      fireEvent.click(uploadButton)
      input = container.querySelector('input[type="file"][accept=".md,.markdown"]') as HTMLInputElement
      fireEvent.change(input, { target: { files: moreFiles } })

      // Some files should succeed, but some should fail with total size limit error
      await waitFor(() => {
        const errorCalls = mockAddLog.mock.calls.filter(call => call[0] === 'error')
        const hasSizeError = errorCalls.some(call =>
          call[1].includes('failed validation') &&
          call[2]?.errors?.some((err: string) => err.includes('Would exceed total size limit'))
        )
        expect(hasSizeError).toBe(true)
      }, { timeout: 3000 })
    })

    it('should accept files with valid MIME types', async () => {
      const { container } = render(<MergeMarkdownPage />)

      const file1 = createMockMarkdownFile('test1.md', '# Test', 1000)
      Object.defineProperty(file1, 'type', { value: 'text/markdown' })

      const file2 = createMockMarkdownFile('test2.md', '# Test', 1000)
      Object.defineProperty(file2, 'type', { value: 'text/plain' })

      const file3 = createMockMarkdownFile('test3.md', '# Test', 1000)
      Object.defineProperty(file3, 'type', { value: '' })

      const uploadButton = screen.getByRole('button', { name: 'Upload Files' })
      fireEvent.click(uploadButton)

      const input = container.querySelector('input[type="file"][accept=".md,.markdown"]') as HTMLInputElement
      fireEvent.change(input, { target: { files: [file1, file2, file3] } })

      await waitFor(() => {
        expect(screen.getByText('test1.md')).toBeInTheDocument()
        expect(screen.getByText('test2.md')).toBeInTheDocument()
        expect(screen.getByText('test3.md')).toBeInTheDocument()
      })
    })

    it('should reject files with invalid MIME type', async () => {
      const { container } = render(<MergeMarkdownPage />)

      const file = createMockMarkdownFile('test.md', '# Test', 1000)
      Object.defineProperty(file, 'type', { value: 'application/pdf' })

      const uploadButton = screen.getByRole('button', { name: 'Upload Files' })
      fireEvent.click(uploadButton)

      const input = container.querySelector('input[type="file"][accept=".md,.markdown"]') as HTMLInputElement
      fireEvent.change(input, { target: { files: [file] } })

      await waitFor(() => {
        expect(mockAddLog).toHaveBeenCalledWith(
          'error',
          '1 file(s) failed validation',
          expect.objectContaining({
            errors: expect.arrayContaining([expect.stringContaining('Invalid file type')])
          })
        )
      })
    })
  })

  describe('drag and drop files', () => {
    it('should show drag overlay on drag enter', () => {
      const { container } = render(<MergeMarkdownPage />)
      const canvas = container.querySelector('.flex-1') as HTMLElement

      fireEvent.dragEnter(canvas, {
        dataTransfer: { types: ['Files'] }
      })

      expect(screen.getByText('Drop files here')).toBeInTheDocument()
      expect(mockAddLog).toHaveBeenCalledWith('info', 'Files dragged over canvas')
    })

    it('should hide drag overlay on drag leave', () => {
      const { container } = render(<MergeMarkdownPage />)
      const canvas = container.querySelector('.flex-1') as HTMLElement

      fireEvent.dragEnter(canvas, {
        dataTransfer: { types: ['Files'] }
      })

      expect(screen.getByText('Drop files here')).toBeInTheDocument()

      fireEvent.dragLeave(canvas, {
        dataTransfer: { types: ['Files'] },
        relatedTarget: null
      })

      expect(screen.queryByText('Drop files here')).not.toBeInTheDocument()
    })

    it('should upload files on drop', async () => {
      const { container } = render(<MergeMarkdownPage />)
      const canvas = container.querySelector('.flex-1') as HTMLElement

      const file = createMockMarkdownFile('dropped.md', '# Dropped File', 1000)

      fireEvent.drop(canvas, {
        dataTransfer: { files: [file] }
      })

      await waitFor(() => {
        expect(mockAddLog).toHaveBeenCalledWith('info', '1 file(s) dropped on canvas')
      })

      await waitFor(() => {
        expect(screen.getByText('dropped.md')).toBeInTheDocument()
      })
    })

    it('should not show drag overlay when reordering files', () => {
      const { container } = render(<MergeMarkdownPage />)
      const canvas = container.querySelector('.flex-1') as HTMLElement

      fireEvent.dragEnter(canvas, {
        dataTransfer: { types: ['application/x-file-reorder'] }
      })

      expect(screen.queryByText('Drop files here')).not.toBeInTheDocument()
      expect(mockAddLog).not.toHaveBeenCalledWith('info', 'Files dragged over canvas')
    })
  })

  describe('file removal', () => {
    it('should remove individual file', async () => {
      const { container } = render(<MergeMarkdownPage />)
      const file = createMockMarkdownFile('test.md', '# Test', 1000)

      const uploadButton = screen.getByRole('button', { name: 'Upload Files' })
      fireEvent.click(uploadButton)

      const input = container.querySelector('input[type="file"][accept=".md,.markdown"]') as HTMLInputElement
      fireEvent.change(input, { target: { files: [file] } })

      await waitFor(() => {
        expect(screen.getByText('test.md')).toBeInTheDocument()
      })

      const removeButton = screen.getByLabelText('Remove test.md')
      fireEvent.click(removeButton)

      await waitFor(() => {
        expect(screen.queryByText('test.md')).not.toBeInTheDocument()
      })

      expect(mockAddLog).toHaveBeenCalledWith('info', 'Removed file: test.md')
    })

    it('should remove correct file when multiple files exist', async () => {
      const { container } = render(<MergeMarkdownPage />)
      const file1 = createMockMarkdownFile('file1.md', '# File 1', 1000)
      const file2 = createMockMarkdownFile('file2.md', '# File 2', 1000)

      const uploadButton = screen.getByRole('button', { name: 'Upload Files' })
      fireEvent.click(uploadButton)

      const input = container.querySelector('input[type="file"][accept=".md,.markdown"]') as HTMLInputElement
      fireEvent.change(input, { target: { files: [file1, file2] } })

      await waitFor(() => {
        expect(screen.getByText('file1.md')).toBeInTheDocument()
        expect(screen.getByText('file2.md')).toBeInTheDocument()
      })

      const removeButton = screen.getByLabelText('Remove file1.md')
      fireEvent.click(removeButton)

      await waitFor(() => {
        expect(screen.queryByText('file1.md')).not.toBeInTheDocument()
        expect(screen.getByText('file2.md')).toBeInTheDocument()
      })
    })
  })

  describe('clear all files', () => {
    it('should clear all files', async () => {
      const { container } = render(<MergeMarkdownPage />)
      const file1 = createMockMarkdownFile('file1.md', '# File 1', 1000)
      const file2 = createMockMarkdownFile('file2.md', '# File 2', 1000)

      const uploadButton = screen.getByRole('button', { name: 'Upload Files' })
      fireEvent.click(uploadButton)

      const input = container.querySelector('input[type="file"][accept=".md,.markdown"]') as HTMLInputElement
      fireEvent.change(input, { target: { files: [file1, file2] } })

      await waitFor(() => {
        expect(screen.getByText('file1.md')).toBeInTheDocument()
        expect(screen.getByText('file2.md')).toBeInTheDocument()
      })

      const clearButton = screen.getByRole('button', { name: 'Clear All Files' })
      fireEvent.click(clearButton)

      await waitFor(() => {
        expect(screen.queryByText('file1.md')).not.toBeInTheDocument()
        expect(screen.queryByText('file2.md')).not.toBeInTheDocument()
      })

      expect(mockAddLog).toHaveBeenCalledWith('info', 'Cleared all 2 file(s)')
    })

    it('should reset sort mode when clearing all files', async () => {
      const { container } = render(<MergeMarkdownPage />)
      const file = createMockMarkdownFile('test.md', '# Test', 1000)

      const uploadButton = screen.getByRole('button', { name: 'Upload Files' })
      fireEvent.click(uploadButton)

      const input = container.querySelector('input[type="file"][accept=".md,.markdown"]') as HTMLInputElement
      fireEvent.change(input, { target: { files: [file] } })

      await waitFor(() => {
        expect(screen.getByText('test.md')).toBeInTheDocument()
      })

      // Toggle sort mode twice to get to reverseAlphabetical
      let sortButton = screen.getByText('A → Z')
      fireEvent.click(sortButton) // none → alphabetical (still shows A → Z)
      fireEvent.click(sortButton) // alphabetical → reverseAlphabetical (shows Z → A)

      await waitFor(() => {
        expect(screen.getByText('Z → A')).toBeInTheDocument()
      })

      // Clear all
      const clearButton = screen.getByRole('button', { name: 'Clear All Files' })
      fireEvent.click(clearButton)

      // Sort button should reset to 'A → Z'
      await waitFor(() => {
        expect(screen.getByText('A → Z')).toBeInTheDocument()
      })
    })
  })

  describe('sorting functionality', () => {
    it('should sort files alphabetically A → Z', async () => {
      const { container } = render(<MergeMarkdownPage />)
      const fileC = createMockMarkdownFile('c.md', '# C', 1000)
      const fileA = createMockMarkdownFile('a.md', '# A', 1000)
      const fileB = createMockMarkdownFile('b.md', '# B', 1000)

      const uploadButton = screen.getByRole('button', { name: 'Upload Files' })
      fireEvent.click(uploadButton)

      const input = container.querySelector('input[type="file"][accept=".md,.markdown"]') as HTMLInputElement
      fireEvent.change(input, { target: { files: [fileC, fileA, fileB] } })

      await waitFor(() => {
        expect(screen.getByText('a.md')).toBeInTheDocument()
      })

      const sortButton = screen.getByText('A → Z')
      fireEvent.click(sortButton) // none → alphabetical

      expect(mockAddLog).toHaveBeenCalledWith('info', 'Sort mode changed to: alphabetical')
      // Button should still show A → Z when in alphabetical mode
      expect(screen.getByText('A → Z')).toBeInTheDocument()
    })

    it('should sort files alphabetically Z → A', async () => {
      const { container } = render(<MergeMarkdownPage />)
      const fileC = createMockMarkdownFile('c.md', '# C', 1000)
      const fileA = createMockMarkdownFile('a.md', '# A', 1000)

      const uploadButton = screen.getByRole('button', { name: 'Upload Files' })
      fireEvent.click(uploadButton)

      const input = container.querySelector('input[type="file"][accept=".md,.markdown"]') as HTMLInputElement
      fireEvent.change(input, { target: { files: [fileC, fileA] } })

      await waitFor(() => {
        expect(screen.getByText('a.md')).toBeInTheDocument()
      })

      // First click: none → alphabetical (button still shows A → Z)
      let sortButton = screen.getByText('A → Z')
      fireEvent.click(sortButton)

      // Second click: alphabetical → reverseAlphabetical (button now shows Z → A)
      sortButton = screen.getByText('A → Z')
      fireEvent.click(sortButton)

      await waitFor(() => {
        expect(screen.getByText('Z → A')).toBeInTheDocument()
      })

      expect(mockAddLog).toHaveBeenCalledWith('info', 'Sort mode changed to: reverseAlphabetical')
    })

    it('should toggle back to alphabetical from reverse', async () => {
      const { container } = render(<MergeMarkdownPage />)
      const file = createMockMarkdownFile('test.md', '# Test', 1000)

      const uploadButton = screen.getByRole('button', { name: 'Upload Files' })
      fireEvent.click(uploadButton)

      const input = container.querySelector('input[type="file"][accept=".md,.markdown"]') as HTMLInputElement
      fireEvent.change(input, { target: { files: [file] } })

      await waitFor(() => {
        expect(screen.getByText('test.md')).toBeInTheDocument()
      })

      // Click through all sort states
      let sortButton = screen.getByText('A → Z')
      fireEvent.click(sortButton) // none → alphabetical (still A → Z)
      fireEvent.click(sortButton) // alphabetical → reverseAlphabetical (now Z → A)

      await waitFor(() => {
        expect(screen.getByText('Z → A')).toBeInTheDocument()
      })

      sortButton = screen.getByText('Z → A')
      fireEvent.click(sortButton) // reverseAlphabetical → alphabetical (back to A → Z)

      await waitFor(() => {
        expect(screen.getByText('A → Z')).toBeInTheDocument()
      })

      expect(mockAddLog).toHaveBeenCalledWith('info', 'Sort mode changed to: alphabetical')
    })
  })

  describe('merge options', () => {
    it('should toggle file headers option', async () => {
      const { container } = render(<MergeMarkdownPage />)
      const checkbox = screen.getByRole('checkbox', { name: /Add file headers/ })

      expect(checkbox).toBeChecked() // Default is enabled

      fireEvent.click(checkbox)
      expect(mockAddLog).toHaveBeenCalledWith('info', 'File headers disabled')
      expect(checkbox).not.toBeChecked()

      fireEvent.click(checkbox)
      expect(mockAddLog).toHaveBeenCalledWith('info', 'File headers enabled')
      expect(checkbox).toBeChecked()
    })

    it('should change separator to newlines only', () => {
      render(<MergeMarkdownPage />)
      const newlineRadio = screen.getByRole('radio', { name: /Newlines only/ })
      const pageBreakRadio = screen.getByRole('radio', { name: /Page breaks/ })

      expect(newlineRadio).toBeChecked() // Default

      fireEvent.click(pageBreakRadio)
      expect(mockAddLog).toHaveBeenCalledWith('info', 'Separator changed to: page breaks')
      expect(pageBreakRadio).toBeChecked()

      fireEvent.click(newlineRadio)
      expect(mockAddLog).toHaveBeenCalledWith('info', 'Separator changed to: newlines')
      expect(newlineRadio).toBeChecked()
    })
  })

  describe('merge and download', () => {
    it('should merge files and trigger download', async () => {
      const { container } = render(<MergeMarkdownPage />)
      const file1 = createMockMarkdownFile('file1.md', '# File 1\n\nContent 1', 1000)
      const file2 = createMockMarkdownFile('file2.md', '# File 2\n\nContent 2', 1000)

      const uploadButton = screen.getByRole('button', { name: 'Upload Files' })
      fireEvent.click(uploadButton)

      const input = container.querySelector('input[type="file"][accept=".md,.markdown"]') as HTMLInputElement
      fireEvent.change(input, { target: { files: [file1, file2] } })

      await waitFor(() => {
        expect(screen.getByText('file1.md')).toBeInTheDocument()
      })

      // Mock document methods for download
      const createElementSpy = vi.spyOn(document, 'createElement')
      const appendChildSpy = vi.spyOn(document.body, 'appendChild')
      const removeChildSpy = vi.spyOn(document.body, 'removeChild')

      const mergeButton = screen.getByRole('button', { name: 'Merge & Download' })
      fireEvent.click(mergeButton)

      await waitFor(() => {
        expect(mockAddLog).toHaveBeenCalledWith('info', 'Merging 2 file(s)', expect.any(Object))
        expect(mockAddLog).toHaveBeenCalledWith('success', 'Files merged successfully', expect.any(Object))
        expect(mockAddLog).toHaveBeenCalledWith('success', 'Merged file downloaded', { filename: 'merged.md' })
      })

      expect(createElementSpy).toHaveBeenCalledWith('a')
      expect(appendChildSpy).toHaveBeenCalled()
      expect(removeChildSpy).toHaveBeenCalled()
    })

    it('should merge with headers when enabled', async () => {
      const { container } = render(<MergeMarkdownPage />)
      const file = createMockMarkdownFile('test.md', 'Content', 1000)

      const uploadButton = screen.getByRole('button', { name: 'Upload Files' })
      fireEvent.click(uploadButton)

      const input = container.querySelector('input[type="file"][accept=".md,.markdown"]') as HTMLInputElement
      fireEvent.change(input, { target: { files: [file] } })

      await waitFor(() => {
        expect(screen.getByText('test.md')).toBeInTheDocument()
      })

      const mergeButton = screen.getByRole('button', { name: 'Merge & Download' })
      fireEvent.click(mergeButton)

      await waitFor(() => {
        expect(mockAddLog).toHaveBeenCalledWith(
          'info',
          'Merging 1 file(s)',
          expect.objectContaining({ headers: true })
        )
      })
    })

    it('should merge without headers when disabled', async () => {
      const { container } = render(<MergeMarkdownPage />)
      const file = createMockMarkdownFile('test.md', 'Content', 1000)

      const uploadButton = screen.getByRole('button', { name: 'Upload Files' })
      fireEvent.click(uploadButton)

      const input = container.querySelector('input[type="file"][accept=".md,.markdown"]') as HTMLInputElement
      fireEvent.change(input, { target: { files: [file] } })

      await waitFor(() => {
        expect(screen.getByText('test.md')).toBeInTheDocument()
      })

      // Disable headers
      const checkbox = screen.getByRole('checkbox', { name: /Add file headers/ })
      fireEvent.click(checkbox)

      const mergeButton = screen.getByRole('button', { name: 'Merge & Download' })
      fireEvent.click(mergeButton)

      await waitFor(() => {
        expect(mockAddLog).toHaveBeenCalledWith(
          'info',
          'Merging 1 file(s)',
          expect.objectContaining({ headers: false })
        )
      })
    })

    it('should merge with page breaks separator', async () => {
      const { container } = render(<MergeMarkdownPage />)
      const file = createMockMarkdownFile('test.md', 'Content', 1000)

      const uploadButton = screen.getByRole('button', { name: 'Upload Files' })
      fireEvent.click(uploadButton)

      const input = container.querySelector('input[type="file"][accept=".md,.markdown"]') as HTMLInputElement
      fireEvent.change(input, { target: { files: [file] } })

      await waitFor(() => {
        expect(screen.getByText('test.md')).toBeInTheDocument()
      })

      // Change to page breaks
      const pageBreakRadio = screen.getByRole('radio', { name: /Page breaks/ })
      fireEvent.click(pageBreakRadio)

      const mergeButton = screen.getByRole('button', { name: 'Merge & Download' })
      fireEvent.click(mergeButton)

      await waitFor(() => {
        expect(mockAddLog).toHaveBeenCalledWith(
          'info',
          'Merging 1 file(s)',
          expect.objectContaining({ separator: 'page-break' })
        )
      })
    })

    it('should show error when trying to merge with no files', () => {
      render(<MergeMarkdownPage />)

      const mergeButton = screen.getByRole('button', { name: 'Merge & Download' })
      // Button should be disabled, but try clicking anyway
      expect(mergeButton).toBeDisabled()
    })
  })

  describe('empty canvas click', () => {
    it('should open file browser when empty canvas is clicked', () => {
      const { container } = render(<MergeMarkdownPage />)

      const emptyCanvas = screen.getByText('No files uploaded').parentElement as HTMLElement
      fireEvent.click(emptyCanvas)

      expect(mockAddLog).toHaveBeenCalledWith('info', 'Empty canvas area clicked - opening file browser')
    })

    it('should support keyboard navigation on empty canvas', () => {
      const { container } = render(<MergeMarkdownPage />)

      const emptyCanvas = screen.getByText('No files uploaded').parentElement as HTMLElement

      fireEvent.keyDown(emptyCanvas, { key: 'Enter' })
      expect(mockAddLog).toHaveBeenCalledWith('info', 'Empty canvas area clicked - opening file browser')

      fireEvent.keyDown(emptyCanvas, { key: ' ' })
      expect(mockAddLog).toHaveBeenCalledWith('info', 'Empty canvas area clicked - opening file browser')
    })

    it('should not trigger on other keyboard keys', () => {
      const { container } = render(<MergeMarkdownPage />)

      const emptyCanvas = screen.getByText('No files uploaded').parentElement as HTMLElement

      mockAddLog.mockClear()
      fireEvent.keyDown(emptyCanvas, { key: 'a' })

      expect(mockAddLog).not.toHaveBeenCalledWith('info', 'Empty canvas area clicked - opening file browser')
    })
  })

  describe('markdown preview', () => {
    it('should render markdown preview for uploaded files', async () => {
      const { container } = render(<MergeMarkdownPage />)
      const file = createMockMarkdownFile('test.md', '# Hello World\n\nThis is a test.', 1000)

      const uploadButton = screen.getByRole('button', { name: 'Upload Files' })
      fireEvent.click(uploadButton)

      const input = container.querySelector('input[type="file"][accept=".md,.markdown"]') as HTMLInputElement
      fireEvent.change(input, { target: { files: [file] } })

      await waitFor(() => {
        const preview = screen.getByTestId('markdown-preview')
        expect(preview).toBeInTheDocument()
        expect(preview).toHaveTextContent('# Hello World')
      })
    })

    it('should display file size in card', async () => {
      const { container } = render(<MergeMarkdownPage />)
      const file = createMockMarkdownFile('test.md', '# Test', 1234)

      const uploadButton = screen.getByRole('button', { name: 'Upload Files' })
      fireEvent.click(uploadButton)

      const input = container.querySelector('input[type="file"][accept=".md,.markdown"]') as HTMLInputElement
      fireEvent.change(input, { target: { files: [file] } })

      await waitFor(() => {
        expect(screen.getByText('test.md')).toBeInTheDocument()
        expect(screen.getByText('1.21 KB')).toBeInTheDocument()
      })
    })
  })

  describe('file reordering', () => {
    it('should allow dragging files to reorder', async () => {
      const { container } = render(<MergeMarkdownPage />)
      const file1 = createMockMarkdownFile('file1.md', '# File 1', 1000)
      const file2 = createMockMarkdownFile('file2.md', '# File 2', 1000)

      const uploadButton = screen.getByRole('button', { name: 'Upload Files' })
      fireEvent.click(uploadButton)

      const input = container.querySelector('input[type="file"][accept=".md,.markdown"]') as HTMLInputElement
      fireEvent.change(input, { target: { files: [file1, file2] } })

      await waitFor(() => {
        expect(screen.getByText('file1.md')).toBeInTheDocument()
        expect(screen.getByText('file2.md')).toBeInTheDocument()
      })

      const cards = container.querySelectorAll('[draggable="true"]')
      expect(cards.length).toBe(2)

      const firstCard = cards[0] as HTMLElement
      const secondCard = cards[1] as HTMLElement

      fireEvent.dragStart(firstCard, {
        dataTransfer: {
          effectAllowed: 'move',
          setData: vi.fn(),
        }
      })

      expect(mockAddLog).toHaveBeenCalledWith(
        'info',
        'Started dragging file for reordering',
        expect.objectContaining({ fileName: 'file1.md' })
      )
    })
  })

  describe('accessibility', () => {
    it('should have proper ARIA labels for remove buttons', async () => {
      const { container } = render(<MergeMarkdownPage />)
      const file = createMockMarkdownFile('test.md', '# Test', 1000)

      const uploadButton = screen.getByRole('button', { name: 'Upload Files' })
      fireEvent.click(uploadButton)

      const input = container.querySelector('input[type="file"][accept=".md,.markdown"]') as HTMLInputElement
      fireEvent.change(input, { target: { files: [file] } })

      await waitFor(() => {
        const removeButton = screen.getByLabelText('Remove test.md')
        expect(removeButton).toBeInTheDocument()
      })
    })

    it('should have proper role and aria-pressed for sort button', () => {
      render(<MergeMarkdownPage />)
      const sortButton = screen.getByText('A → Z')

      expect(sortButton).toHaveAttribute('aria-pressed', 'false')
    })

    it('should have drag overlay with proper ARIA attributes', () => {
      const { container } = render(<MergeMarkdownPage />)
      const canvas = container.querySelector('.flex-1') as HTMLElement

      fireEvent.dragEnter(canvas, {
        dataTransfer: { types: ['Files'] }
      })

      const overlay = screen.getByRole('status')
      expect(overlay).toHaveAttribute('aria-live', 'polite')
      expect(overlay).toHaveAttribute('aria-label', 'Drop zone active. Drop files here.')
    })

    it('should have accessible empty canvas', () => {
      render(<MergeMarkdownPage />)
      // The role="button" is on the container, two levels up from the text
      const text = screen.getByText('No files uploaded')
      const emptyCanvas = text.parentElement?.parentElement as HTMLElement

      expect(emptyCanvas).toHaveAttribute('role', 'button')
      expect(emptyCanvas).toHaveAttribute('tabindex', '0')
    })
  })

  describe('edge cases', () => {
    it('should handle FileReader error gracefully', async () => {
      // Save original FileReader
      const originalFileReader = global.FileReader

      // Create a FileReader that errors out
      let fileReaderInstance: any

      global.FileReader = class MockFileReader {
        onload: ((e: ProgressEvent<FileReader>) => void) | null = null
        onerror: (() => void) | null = null
        result: string | ArrayBuffer | null = null

        constructor() {
          fileReaderInstance = this
        }

        readAsText() {
          // Trigger error asynchronously
          setTimeout(() => {
            if (this.onerror) {
              this.onerror()
            }
          }, 0)
        }
      } as any

      const { container } = render(<MergeMarkdownPage />)

      // Create a real file (not using our mock helper)
      const file = new File(['# Test'], 'test.md', { type: 'text/markdown' })
      Object.defineProperty(file, 'size', { value: 1000 })

      const uploadButton = screen.getByRole('button', { name: 'Upload Files' })
      fireEvent.click(uploadButton)

      const input = container.querySelector('input[type="file"][accept=".md,.markdown"]') as HTMLInputElement
      fireEvent.change(input, { target: { files: [file] } })

      await waitFor(() => {
        const errorCalls = mockAddLog.mock.calls.filter(call => call[0] === 'error')
        const hasReadError = errorCalls.some(call =>
          call[1].includes('Failed to read file') || call[2]?.errors?.some((err: string) => err.includes('Failed to read file'))
        )
        expect(hasReadError).toBe(true)
      }, { timeout: 2000 })

      // Restore original FileReader
      global.FileReader = originalFileReader
    })

    it('should handle missing crypto.randomUUID', async () => {
      // Save original crypto
      const originalCrypto = global.crypto

      // Remove crypto.randomUUID
      Object.defineProperty(global, 'crypto', {
        value: undefined,
        configurable: true
      })

      const { container } = render(<MergeMarkdownPage />)
      const file = createMockMarkdownFile('test.md', '# Test', 1000)

      const uploadButton = screen.getByRole('button', { name: 'Upload Files' })
      fireEvent.click(uploadButton)

      const input = container.querySelector('input[type="file"][accept=".md,.markdown"]') as HTMLInputElement
      fireEvent.change(input, { target: { files: [file] } })

      await waitFor(() => {
        expect(screen.getByText('test.md')).toBeInTheDocument()
      })

      // Restore crypto
      Object.defineProperty(global, 'crypto', {
        value: originalCrypto,
        configurable: true
      })
    })
  })
})
