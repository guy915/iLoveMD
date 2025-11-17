/**
 * PdfDocument Entity
 *
 * Represents a PDF file in the domain with its metadata and validation state.
 * This is a domain entity that encapsulates business rules about PDF files.
 *
 * Business Rules:
 * - Must be a valid PDF file (MIME type + magic bytes)
 * - Cannot exceed 200MB (Marker API limit)
 * - Cannot be empty
 * - Has validation state that determines if it can be converted
 */

import type { FileMetadata } from '@/types'

/**
 * Validation result for a PDF document
 */
export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

/**
 * Validation error
 */
export interface ValidationError {
  code: string
  message: string
  severity: 'error' | 'warning'
}

/**
 * PDF Document entity
 */
export class PdfDocument {
  private readonly file: File
  private readonly metadata: FileMetadata
  private validationResult: ValidationResult | null = null

  constructor(file: File) {
    this.file = file
    this.metadata = {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
    }
  }

  /**
   * Get the underlying File object
   */
  getFile(): File {
    return this.file
  }

  /**
   * Get file metadata
   */
  getMetadata(): FileMetadata {
    return { ...this.metadata }
  }

  /**
   * Get file name
   */
  getName(): string {
    return this.metadata.name
  }

  /**
   * Get file size in bytes
   */
  getSize(): number {
    return this.metadata.size
  }

  /**
   * Get file size in megabytes
   */
  getSizeInMB(): number {
    return this.metadata.size / (1024 * 1024)
  }

  /**
   * Get MIME type
   */
  getMimeType(): string {
    return this.metadata.type
  }

  /**
   * Set validation result
   */
  setValidationResult(result: ValidationResult): void {
    this.validationResult = result
  }

  /**
   * Check if the document is valid
   */
  isValid(): boolean {
    if (!this.validationResult) {
      throw new Error('Document has not been validated yet. Call validate() first.')
    }
    return this.validationResult.valid
  }

  /**
   * Get validation errors
   */
  getValidationErrors(): ValidationError[] {
    return this.validationResult?.errors ?? []
  }

  /**
   * Check if validation has been performed
   */
  hasBeenValidated(): boolean {
    return this.validationResult !== null
  }

  /**
   * Check if file is a PDF based on MIME type
   */
  isPdfMimeType(): boolean {
    return this.metadata.type === 'application/pdf'
  }

  /**
   * Check if file has PDF extension
   */
  hasPdfExtension(): boolean {
    return this.metadata.name.toLowerCase().endsWith('.pdf')
  }

  /**
   * Check if file size is within limits (200MB for Marker API)
   */
  isWithinSizeLimit(maxSizeBytes: number = 200 * 1024 * 1024): boolean {
    return this.metadata.size <= maxSizeBytes
  }

  /**
   * Check if file is not empty
   */
  isNotEmpty(): boolean {
    return this.metadata.size > 0
  }
}
