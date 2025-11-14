import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FileUpload from './FileUpload'
import { FILE_SIZE } from '@/lib/constants'

// Mock LogContext
vi.mock('@/contexts/LogContext', () => ({
  useLogs: () => ({
    addLog: vi.fn(),
  }),
}))

// Helper to create mock File
function createMockFile(name: string, size: number, type: string): File {
  const blob = new Blob(['test content'], { type })
  const file = new File([blob], name, { type })

  Object.defineProperty(file, 'size', {
    value: size,
    writable: false,
  })

  return file
}

describe('FileUpload', () => {
  let onFileSelect: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onFileSelect = vi.fn()
  })

  describe('rendering', () => {
    it('should render with default label', () => {
      render(<FileUpload onFileSelect={onFileSelect} accept=".pdf" />)
      expect(screen.getByText('Drop file here or click to browse')).toBeInTheDocument()
    })

    it('should render with custom label', () => {
      render(<FileUpload onFileSelect={onFileSelect} accept=".pdf" label="Upload your PDF" />)
      expect(screen.getByText('Upload your PDF')).toBeInTheDocument()
    })

    it('should display supported file types', () => {
      render(<FileUpload onFileSelect={onFileSelect} accept=".pdf,.md" />)
      expect(screen.getByText(/Supported: \.pdf,\.md/)).toBeInTheDocument()
    })

    it('should display max file size', () => {
      const maxSize = 10 * FILE_SIZE.BYTES_PER_MB // 10MB
      render(<FileUpload onFileSelect={onFileSelect} accept=".pdf" maxSize={maxSize} />)
      expect(screen.getByText(/up to 10MB/)).toBeInTheDocument()
    })

    it('should use default max size if not provided', () => {
      render(<FileUpload onFileSelect={onFileSelect} accept=".pdf" />)
      const defaultMaxSizeMB = Math.round(FILE_SIZE.MAX_FILE_SIZE / FILE_SIZE.BYTES_PER_MB)
      expect(screen.getByText(new RegExp(`up to ${defaultMaxSizeMB}MB`))).toBeInTheDocument()
    })

    it('should have role="button" and tabindex for accessibility', () => {
      render(<FileUpload onFileSelect={onFileSelect} accept=".pdf" />)
      const dropZone = screen.getByRole('button')
      expect(dropZone).toHaveAttribute('tabindex', '0')
    })

    it('should have aria-label for accessibility', () => {
      render(<FileUpload onFileSelect={onFileSelect} accept=".pdf" label="Upload file" />)
      expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Upload file')
    })
  })

  describe('file selection via click', () => {
    it('should call onFileSelect when valid file is selected', async () => {
      const { container } = render(<FileUpload onFileSelect={onFileSelect} accept=".pdf" />)

      const file = createMockFile('test.pdf', 1000, 'application/pdf')
      const input = container.querySelector('input[type="file"]') as HTMLInputElement

      // Simulate file selection
      fireEvent.change(input, { target: { files: [file] } })

      expect(onFileSelect).toHaveBeenCalledWith(file)
      expect(onFileSelect).toHaveBeenCalledTimes(1)
    })

    it('should display selected file name', async () => {
      const { container } = render(<FileUpload onFileSelect={onFileSelect} accept=".pdf" />)

      const file = createMockFile('my-document.pdf', 1000, 'application/pdf')
      const input = container.querySelector('input[type="file"]') as HTMLInputElement

      fireEvent.change(input, { target: { files: [file] } })

      expect(screen.getByText('Selected: my-document.pdf')).toBeInTheDocument()
    })

    it('should reset input value after selection', async () => {
      const { container } = render(<FileUpload onFileSelect={onFileSelect} accept=".pdf" />)

      const file = createMockFile('test.pdf', 1000, 'application/pdf')
      const input = container.querySelector('input[type="file"]') as HTMLInputElement

      fireEvent.change(input, { target: { files: [file] } })

      expect(input.value).toBe('')
    })

    it('should allow selecting the same file again', async () => {
      const { container } = render(<FileUpload onFileSelect={onFileSelect} accept=".pdf" />)

      const file = createMockFile('test.pdf', 1000, 'application/pdf')
      const input = container.querySelector('input[type="file"]') as HTMLInputElement

      fireEvent.change(input, { target: { files: [file] } })
      expect(onFileSelect).toHaveBeenCalledTimes(1)

      // Select same file again
      fireEvent.change(input, { target: { files: [file] } })
      expect(onFileSelect).toHaveBeenCalledTimes(2)
    })

    it('should not call onFileSelect when no file is selected', async () => {
      const { container } = render(<FileUpload onFileSelect={onFileSelect} accept=".pdf" />)

      const input = container.querySelector('input[type="file"]') as HTMLInputElement

      // Simulate file dialog cancel
      fireEvent.change(input, { target: { files: [] } })

      expect(onFileSelect).not.toHaveBeenCalled()
    })
  })

  describe('file validation', () => {
    it('should show error when file exceeds max size', async () => {
      const maxSize = 5 * FILE_SIZE.BYTES_PER_MB // 5MB
      const { container } = render(<FileUpload onFileSelect={onFileSelect} accept=".pdf" maxSize={maxSize} />)

      const file = createMockFile('large.pdf', 10 * FILE_SIZE.BYTES_PER_MB, 'application/pdf')
      const input = container.querySelector('input[type="file"]') as HTMLInputElement

      fireEvent.change(input, { target: { files: [file] } })

      expect(screen.getByText('File too large. Maximum size: 5MB')).toBeInTheDocument()
      expect(onFileSelect).not.toHaveBeenCalled()
    })

    it('should clear previous error when valid file is selected', async () => {
      const maxSize = 5 * FILE_SIZE.BYTES_PER_MB
      const { container } = render(<FileUpload onFileSelect={onFileSelect} accept=".pdf" maxSize={maxSize} />)

      const largeFile = createMockFile('large.pdf', 10 * FILE_SIZE.BYTES_PER_MB, 'application/pdf')
      const smallFile = createMockFile('small.pdf', 1 * FILE_SIZE.BYTES_PER_MB, 'application/pdf')
      const input = container.querySelector('input[type="file"]') as HTMLInputElement

      // Select large file (error)
      fireEvent.change(input, { target: { files: [largeFile] } })
      expect(screen.getByText(/File too large/)).toBeInTheDocument()

      // Select small file (should clear error)
      fireEvent.change(input, { target: { files: [smallFile] } })
      expect(screen.queryByText(/File too large/)).not.toBeInTheDocument()
      expect(onFileSelect).toHaveBeenCalledWith(smallFile)
    })

    it('should accept file at exact max size', async () => {
      const maxSize = 5 * FILE_SIZE.BYTES_PER_MB
      const { container } = render(<FileUpload onFileSelect={onFileSelect} accept=".pdf" maxSize={maxSize} />)

      const file = createMockFile('exact.pdf', maxSize, 'application/pdf')
      const input = container.querySelector('input[type="file"]') as HTMLInputElement

      fireEvent.change(input, { target: { files: [file] } })

      expect(screen.queryByText(/File too large/)).not.toBeInTheDocument()
      expect(onFileSelect).toHaveBeenCalledWith(file)
    })

    it('should reject file one byte over max size', async () => {
      const maxSize = 5 * FILE_SIZE.BYTES_PER_MB
      const { container } = render(<FileUpload onFileSelect={onFileSelect} accept=".pdf" maxSize={maxSize} />)

      const file = createMockFile('oversize.pdf', maxSize + 1, 'application/pdf')
      const input = container.querySelector('input[type="file"]') as HTMLInputElement

      fireEvent.change(input, { target: { files: [file] } })

      expect(screen.getByText(/File too large/)).toBeInTheDocument()
      expect(onFileSelect).not.toHaveBeenCalled()
    })
  })

  describe('drag and drop', () => {
    it('should activate drag state on drag enter', () => {
      render(<FileUpload onFileSelect={onFileSelect} accept=".pdf" />)
      const dropZone = screen.getByRole('button')

      fireEvent.dragEnter(dropZone, {
        dataTransfer: { files: [] }
      })

      expect(dropZone).toHaveClass('border-primary-500')
      expect(dropZone).toHaveClass('bg-primary-50')
    })

    it('should deactivate drag state on drag leave', () => {
      render(<FileUpload onFileSelect={onFileSelect} accept=".pdf" />)
      const dropZone = screen.getByRole('button')

      fireEvent.dragEnter(dropZone, {
        dataTransfer: { files: [] }
      })
      expect(dropZone).toHaveClass('border-primary-500')

      fireEvent.dragLeave(dropZone, {
        dataTransfer: { files: [] }
      })

      expect(dropZone).not.toHaveClass('border-primary-500')
      expect(dropZone).toHaveClass('border-gray-300')
    })

    it('should maintain drag state on drag over', () => {
      render(<FileUpload onFileSelect={onFileSelect} accept=".pdf" />)
      const dropZone = screen.getByRole('button')

      fireEvent.dragEnter(dropZone, {
        dataTransfer: { files: [] }
      })

      fireEvent.dragOver(dropZone, {
        dataTransfer: { files: [] }
      })

      expect(dropZone).toHaveClass('border-primary-500')
    })

    it('should call onFileSelect when file is dropped', () => {
      render(<FileUpload onFileSelect={onFileSelect} accept=".pdf" />)
      const dropZone = screen.getByRole('button')

      const file = createMockFile('dropped.pdf', 1000, 'application/pdf')

      fireEvent.drop(dropZone, {
        dataTransfer: { files: [file] }
      })

      expect(onFileSelect).toHaveBeenCalledWith(file)
    })

    it('should deactivate drag state after drop', () => {
      render(<FileUpload onFileSelect={onFileSelect} accept=".pdf" />)
      const dropZone = screen.getByRole('button')

      fireEvent.dragEnter(dropZone, {
        dataTransfer: { files: [] }
      })
      expect(dropZone).toHaveClass('border-primary-500')

      const file = createMockFile('dropped.pdf', 1000, 'application/pdf')
      fireEvent.drop(dropZone, {
        dataTransfer: { files: [file] }
      })

      expect(dropZone).not.toHaveClass('border-primary-500')
    })

    it('should validate file size on drop', () => {
      const maxSize = 5 * FILE_SIZE.BYTES_PER_MB
      render(<FileUpload onFileSelect={onFileSelect} accept=".pdf" maxSize={maxSize} />)
      const dropZone = screen.getByRole('button')

      const file = createMockFile('large.pdf', 10 * FILE_SIZE.BYTES_PER_MB, 'application/pdf')

      fireEvent.drop(dropZone, {
        dataTransfer: { files: [file] }
      })

      expect(screen.getByText(/File too large/)).toBeInTheDocument()
      expect(onFileSelect).not.toHaveBeenCalled()
    })

    it('should prevent default on drag events', () => {
      render(<FileUpload onFileSelect={onFileSelect} accept=".pdf" />)
      const dropZone = screen.getByRole('button')

      const dragEvent = new Event('dragenter', { bubbles: true, cancelable: true })
      const preventDefault = vi.spyOn(dragEvent, 'preventDefault')

      dropZone.dispatchEvent(dragEvent)

      expect(preventDefault).toHaveBeenCalled()
    })
  })

  describe('keyboard accessibility', () => {
    it('should trigger file input on Enter key', async () => {
      const { container } = render(<FileUpload onFileSelect={onFileSelect} accept=".pdf" />)
      const dropZone = screen.getByRole('button')
      const input = container.querySelector('input[type="file"]') as HTMLInputElement

      const clickSpy = vi.spyOn(input, 'click')

      dropZone.focus()
      fireEvent.keyDown(dropZone, { key: 'Enter', code: 'Enter' })

      expect(clickSpy).toHaveBeenCalled()
    })

    it('should trigger file input on Space key', async () => {
      const { container } = render(<FileUpload onFileSelect={onFileSelect} accept=".pdf" />)
      const dropZone = screen.getByRole('button')
      const input = container.querySelector('input[type="file"]') as HTMLInputElement

      const clickSpy = vi.spyOn(input, 'click')

      dropZone.focus()
      fireEvent.keyDown(dropZone, { key: ' ', code: 'Space' })

      expect(clickSpy).toHaveBeenCalled()
    })

    it('should not trigger file input on other keys', async () => {
      const { container } = render(<FileUpload onFileSelect={onFileSelect} accept=".pdf" />)
      const dropZone = screen.getByRole('button')
      const input = container.querySelector('input[type="file"]') as HTMLInputElement

      const clickSpy = vi.spyOn(input, 'click')

      dropZone.focus()
      fireEvent.keyDown(dropZone, { key: 'a', code: 'KeyA' })

      expect(clickSpy).not.toHaveBeenCalled()
    })

    it('should be focusable via keyboard', () => {
      render(<FileUpload onFileSelect={onFileSelect} accept=".pdf" />)
      const dropZone = screen.getByRole('button')

      expect(dropZone).toHaveAttribute('tabindex', '0')
    })
  })

  describe('click to browse', () => {
    it('should open file browser when drop zone is clicked', async () => {
      const { container } = render(<FileUpload onFileSelect={onFileSelect} accept=".pdf" />)
      const dropZone = screen.getByRole('button')
      const input = container.querySelector('input[type="file"]') as HTMLInputElement

      const clickSpy = vi.spyOn(input, 'click')

      fireEvent.click(dropZone)

      expect(clickSpy).toHaveBeenCalled()
    })

    it('should have hidden file input', () => {
      const { container } = render(<FileUpload onFileSelect={onFileSelect} accept=".pdf" />)
      const input = container.querySelector('input[type="file"]') as HTMLInputElement

      expect(input).toHaveClass('hidden')
    })

    it('should pass accept prop to input', () => {
      const { container } = render(<FileUpload onFileSelect={onFileSelect} accept=".pdf,.md" />)
      const input = container.querySelector('input[type="file"]') as HTMLInputElement

      expect(input).toHaveAttribute('accept', '.pdf,.md')
    })
  })

  describe('error display', () => {
    it('should not show error initially', () => {
      render(<FileUpload onFileSelect={onFileSelect} accept=".pdf" />)
      expect(screen.queryByText(/File too large/)).not.toBeInTheDocument()
    })

    it('should show error with red text', () => {
      const maxSize = 5 * FILE_SIZE.BYTES_PER_MB
      const { container } = render(<FileUpload onFileSelect={onFileSelect} accept=".pdf" maxSize={maxSize} />)

      const file = createMockFile('large.pdf', 10 * FILE_SIZE.BYTES_PER_MB, 'application/pdf')
      const input = container.querySelector('input[type="file"]') as HTMLInputElement

      fireEvent.change(input, { target: { files: [file] } })

      const errorMessage = screen.getByText(/File too large/)
      expect(errorMessage).toHaveClass('text-red-600')
    })
  })

  describe('edge cases', () => {
    it('should handle null file gracefully', () => {
      const { container } = render(<FileUpload onFileSelect={onFileSelect} accept=".pdf" />)
      const input = container.querySelector('input[type="file"]') as HTMLInputElement

      fireEvent.change(input, { target: { files: null } })

      expect(onFileSelect).not.toHaveBeenCalled()
    })

    it('should handle zero-size file', () => {
      const { container } = render(<FileUpload onFileSelect={onFileSelect} accept=".pdf" />)

      const file = createMockFile('empty.pdf', 0, 'application/pdf')
      const input = container.querySelector('input[type="file"]') as HTMLInputElement

      fireEvent.change(input, { target: { files: [file] } })

      expect(onFileSelect).toHaveBeenCalledWith(file)
    })

    it('should update selected file when new file is selected', () => {
      const { container } = render(<FileUpload onFileSelect={onFileSelect} accept=".pdf" />)

      const file1 = createMockFile('file1.pdf', 1000, 'application/pdf')
      const file2 = createMockFile('file2.pdf', 2000, 'application/pdf')
      const input = container.querySelector('input[type="file"]') as HTMLInputElement

      fireEvent.change(input, { target: { files: [file1] } })
      expect(screen.getByText('Selected: file1.pdf')).toBeInTheDocument()

      fireEvent.change(input, { target: { files: [file2] } })
      expect(screen.getByText('Selected: file2.pdf')).toBeInTheDocument()
      expect(screen.queryByText('Selected: file1.pdf')).not.toBeInTheDocument()
    })
  })
})
