import { Metadata } from 'next'
import { BASE_URL } from '@/lib/constants'
import MergeMarkdownClient from './MergeMarkdownClient'

export const metadata: Metadata = {
  title: 'Merge Markdown',
  description: 'Merge multiple Markdown files into a single document. Drag and drop interface, sort files, and download the combined result. Free and runs entirely in your browser.',
  alternates: {
    canonical: `${BASE_URL}/merge-markdown`,
  },
  openGraph: {
    title: 'Merge Markdown Files - Combine Multiple MD Files Online',
    description: 'Merge multiple Markdown files into a single document. Drag and drop interface, sort files, and download the combined result.',
    url: `${BASE_URL}/merge-markdown`,
  },
}

export default function MergeMarkdownPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'iLoveMD Merge Markdown',
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Any',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    description: 'Combine multiple Markdown files into a single document easily.',
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MergeMarkdownClient />
    </>
  )
}
