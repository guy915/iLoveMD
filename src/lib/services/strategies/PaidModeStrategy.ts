/**
 * Paid mode conversion strategy (Marker API)
 */

import type { MarkerOptions, MarkerSubmitResponse, MarkerPollResponse } from '@/types'
import type { IConversionStrategy } from '../conversionStrategy'
import { API_ENDPOINTS } from '@/lib/constants'

/**
 * Strategy for paid mode conversion using Marker API
 */
export class PaidModeStrategy implements IConversionStrategy {
  constructor(private apiKey: string) {}

  async submitConversion(file: File, options: MarkerOptions): Promise<MarkerSubmitResponse> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('apiKey', this.apiKey)
    formData.append('options', JSON.stringify(options))

    const response = await fetch(API_ENDPOINTS.MARKER, {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API request failed: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    if (!data.success) {
      throw new Error(data.error || 'API request failed')
    }

    return data
  }

  async pollStatus(checkUrl: string): Promise<MarkerPollResponse> {
    const response = await fetch(
      `${API_ENDPOINTS.MARKER}?checkUrl=${encodeURIComponent(checkUrl)}`,
      {
        headers: {
          'x-api-key': this.apiKey
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Polling failed: ${response.status}`)
    }

    const data = await response.json()
    if (!data.success) {
      throw new Error(data.error || 'Polling failed')
    }

    return data
  }

  getErrorPrefix(): string {
    return 'API'
  }

  needsInitialDelay(): boolean {
    return false // Marker API doesn't need initial delay
  }
}
