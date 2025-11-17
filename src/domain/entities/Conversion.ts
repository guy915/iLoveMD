/**
 * Conversion Entity
 *
 * Represents an active or completed PDF to Markdown conversion.
 * This entity manages the conversion lifecycle and state transitions.
 *
 * State Machine:
 * pending → submitted → processing → complete
 *                                  ↘ failed
 *                                  ↘ cancelled
 *
 * Business Rules:
 * - Can only be submitted once
 * - Cannot transition from complete/failed/cancelled states
 * - Progress can only increase
 * - Timestamps are immutable once set
 */

import type { PdfDocument } from './PdfDocument'
import type { MarkerOptions, ConversionResult } from '@/types'
import type { ConversionMode } from '../repositories/IConversionRepository'

/**
 * Conversion status in the state machine
 */
export type ConversionStatus =
  | 'pending'
  | 'submitted'
  | 'processing'
  | 'complete'
  | 'failed'
  | 'cancelled'

/**
 * Conversion progress information
 */
export interface ConversionProgress {
  status: string
  attemptNumber: number
  elapsedSeconds: number
  percentage?: number
}

/**
 * Conversion timestamps
 */
export interface ConversionTimestamps {
  created: Date
  submitted?: Date
  started?: Date
  completed?: Date
}

/**
 * Conversion entity
 */
export class Conversion {
  private readonly id: string
  private readonly pdfDocument: PdfDocument
  private readonly options: MarkerOptions
  private readonly mode: ConversionMode
  private status: ConversionStatus = 'pending'
  private progress: ConversionProgress | null = null
  private result: ConversionResult | null = null
  private requestId: string | null = null
  private checkUrl: string | null = null
  private readonly timestamps: ConversionTimestamps

  constructor(
    id: string,
    pdfDocument: PdfDocument,
    options: MarkerOptions,
    mode: ConversionMode
  ) {
    this.id = id
    this.pdfDocument = pdfDocument
    this.options = { ...options } // Defensive copy
    this.mode = mode
    this.timestamps = {
      created: new Date(),
    }
  }

  /**
   * Get conversion ID
   */
  getId(): string {
    return this.id
  }

  /**
   * Get the PDF document being converted
   */
  getPdfDocument(): PdfDocument {
    return this.pdfDocument
  }

  /**
   * Get conversion options
   */
  getOptions(): Readonly<MarkerOptions> {
    return this.options
  }

  /**
   * Get conversion mode
   */
  getMode(): ConversionMode {
    return this.mode
  }

  /**
   * Get current status
   */
  getStatus(): ConversionStatus {
    return this.status
  }

  /**
   * Get current progress
   */
  getProgress(): ConversionProgress | null {
    return this.progress ? { ...this.progress } : null
  }

  /**
   * Get conversion result
   */
  getResult(): ConversionResult | null {
    return this.result ? { ...this.result } : null
  }

  /**
   * Get request ID
   */
  getRequestId(): string | null {
    return this.requestId
  }

  /**
   * Get check URL for polling
   */
  getCheckUrl(): string | null {
    return this.checkUrl
  }

  /**
   * Get timestamps
   */
  getTimestamps(): Readonly<ConversionTimestamps> {
    return { ...this.timestamps }
  }

  /**
   * Mark conversion as submitted
   */
  markAsSubmitted(requestId: string, checkUrl: string): void {
    if (this.status !== 'pending') {
      throw new Error(`Cannot submit conversion in ${this.status} state`)
    }

    this.status = 'submitted'
    this.requestId = requestId
    this.checkUrl = checkUrl
    this.timestamps.submitted = new Date()
  }

  /**
   * Mark conversion as processing
   */
  markAsProcessing(): void {
    if (this.status !== 'submitted' && this.status !== 'processing') {
      throw new Error(`Cannot start processing in ${this.status} state`)
    }

    if (!this.timestamps.started) {
      this.timestamps.started = new Date()
    }

    this.status = 'processing'
  }

  /**
   * Update conversion progress
   */
  updateProgress(progress: ConversionProgress): void {
    if (this.isTerminalState()) {
      return // Ignore progress updates in terminal states
    }

    this.progress = { ...progress }
  }

  /**
   * Mark conversion as complete
   */
  markAsComplete(result: ConversionResult): void {
    if (this.isTerminalState()) {
      throw new Error(`Cannot complete conversion in ${this.status} state`)
    }

    this.status = 'complete'
    this.result = { ...result }
    this.timestamps.completed = new Date()
  }

  /**
   * Mark conversion as failed
   */
  markAsFailed(error: string): void {
    if (this.isTerminalState()) {
      throw new Error(`Cannot fail conversion in ${this.status} state`)
    }

    this.status = 'failed'
    this.result = {
      success: false,
      error,
    }
    this.timestamps.completed = new Date()
  }

  /**
   * Mark conversion as cancelled
   */
  markAsCancelled(): void {
    if (this.isTerminalState()) {
      return // Already in a terminal state, ignore
    }

    this.status = 'cancelled'
    this.result = {
      success: false,
      error: 'Conversion cancelled by user',
    }
    this.timestamps.completed = new Date()
  }

  /**
   * Check if conversion is in a terminal state (cannot transition)
   */
  isTerminalState(): boolean {
    return (
      this.status === 'complete' ||
      this.status === 'failed' ||
      this.status === 'cancelled'
    )
  }

  /**
   * Check if conversion is pending
   */
  isPending(): boolean {
    return this.status === 'pending'
  }

  /**
   * Check if conversion is submitted
   */
  isSubmitted(): boolean {
    return this.status === 'submitted'
  }

  /**
   * Check if conversion is processing
   */
  isProcessing(): boolean {
    return this.status === 'processing'
  }

  /**
   * Check if conversion is complete
   */
  isComplete(): boolean {
    return this.status === 'complete'
  }

  /**
   * Check if conversion failed
   */
  isFailed(): boolean {
    return this.status === 'failed'
  }

  /**
   * Check if conversion was cancelled
   */
  isCancelled(): boolean {
    return this.status === 'cancelled'
  }

  /**
   * Get elapsed time in seconds
   */
  getElapsedSeconds(): number {
    const start = this.timestamps.started || this.timestamps.submitted || this.timestamps.created
    const end = this.timestamps.completed || new Date()
    return (end.getTime() - start.getTime()) / 1000
  }

  /**
   * Get a summary of the conversion
   */
  getSummary(): string {
    return `Conversion ${this.id}: ${this.pdfDocument.getName()} [${this.status}]`
  }
}
