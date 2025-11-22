import { Metadata } from 'next'
import { BASE_URL } from '@/lib/constants'
import PdfToMarkdownClient from './PdfToMarkdownClient'

export const metadata: Metadata = {
  title: 'PDF to Markdown',
  description: 'Convert PDF files to clean Markdown format. Supports batch conversion, OCR, and AI enhancement for high-quality results. Free and secure.',
  alternates: {
    canonical: `${BASE_URL}/pdf-to-markdown`,
  },
  openGraph: {
    title: 'PDF to Markdown Converter - Free & AI-Powered',
    description: 'Convert PDF files to clean Markdown format. Supports batch conversion, OCR, and AI enhancement for high-quality results.',
    url: `${BASE_URL}/pdf-to-markdown`,
  },
}

export default function PdfToMarkdownPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'iLoveMD PDF to Markdown',
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Any',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    description: 'Convert PDF files to clean Markdown format with AI enhancement.',
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PdfToMarkdownClient />
    </>
  )
}
