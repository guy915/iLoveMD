/**
 * Free mode conversion strategy (Modal)
 */

import type { MarkerOptions, MarkerSubmitResponse, MarkerPollResponse } from '@/types'
import type { IConversionStrategy } from '../conversionStrategy'
import { API_ENDPOINTS } from '@/lib/constants'

/**
 * Strategy for free mode conversion using Modal
 */
export class FreeModeStrategy implements IConversionStrategy {
  constructor(private geminiApiKey: string | null) {}

  async submitConversion(file: File, options: MarkerOptions): Promise<MarkerSubmitResponse> {
    const formData = new FormData()
    formData.append('file', file)
    if (this.geminiApiKey) {
      formData.append('geminiApiKey', this.geminiApiKey)
    }
    formData.append('options', JSON.stringify(options))

    const response = await fetch(API_ENDPOINTS.MARKER_LOCAL, {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Modal request failed: ${response.status} - ${errorText}`)
    }

    return await response.json()
  }

  async pollStatus(checkUrl: string): Promise<MarkerPollResponse> {
    const response = await fetch(
      `${API_ENDPOINTS.MARKER_LOCAL}?checkUrl=${encodeURIComponent(checkUrl)}`
    )

    if (!response.ok) {
      throw new Error(`Polling failed: ${response.status}`)
    }

    return await response.json()
  }

  getErrorPrefix(): string {
    return 'Modal'
  }

  needsInitialDelay(): boolean {
    return true // Modal needs delay for volume propagation
  }
}
