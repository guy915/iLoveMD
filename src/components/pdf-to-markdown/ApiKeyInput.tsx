import { ChangeEvent } from 'react'
import { MARKER_CONFIG } from '@/lib/constants'
import type { ConversionMode } from '@/hooks/useConversionMode'

interface ApiKeyInputProps {
  mode: ConversionMode
  apiKey: string
  setApiKey: (key: string) => void
  geminiApiKey: string
  setGeminiApiKey: (key: string) => void
  useLlm: boolean
  disabled?: boolean
}

/**
 * Component for API key input fields.
 * Shows Marker API key input for paid mode, Gemini API key input for free mode with LLM.
 */
export function ApiKeyInput({
  mode,
  apiKey,
  setApiKey,
  geminiApiKey,
  setGeminiApiKey,
  useLlm,
  disabled = false
}: ApiKeyInputProps) {
  if (mode === 'paid') {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <label htmlFor="api-key-input" className="block text-sm font-medium text-gray-700 mb-2">
          Marker API Key
        </label>
        <input
          id="api-key-input"
          type="password"
          value={apiKey}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setApiKey(e.target.value)}
          placeholder="Enter your API key"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={disabled}
          aria-label="Marker API Key"
        />
        <p className="mt-2 text-sm text-gray-500">
          Don&apos;t have an API key?{' '}
          <a
            href={MARKER_CONFIG.SIGN_UP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-700 underline"
          >
            Get one here
          </a>
          {' '}($5 free credits available)
        </p>
      </div>
    )
  }

  if (mode === 'free') {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <label htmlFor="gemini-api-key-input" className="block text-sm font-medium text-gray-700 mb-2">
          Gemini API Key
        </label>
        <input
          id="gemini-api-key-input"
          type="password"
          value={geminiApiKey}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setGeminiApiKey(e.target.value)}
          placeholder="Enter your Gemini API key"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
          disabled={disabled}
          aria-label="Gemini API Key"
        />
        <p className="mt-2 text-sm text-gray-500">
          Don&apos;t have an API key?{' '}
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-700 underline"
          >
            Get a free one here
          </a>
          {!useLlm && (
            <span className="block mt-1 text-gray-400 italic">
              (Only used when &quot;Use LLM enhancement&quot; is enabled)
            </span>
          )}
        </p>
      </div>
    )
  }

  return null
}
