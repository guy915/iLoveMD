import { Metadata } from 'next'
import MergeMarkdownClient from './MergeMarkdownClient'

export const metadata: Metadata = {
  title: 'Merge Markdowns',
  description: 'Merge multiple Markdown files into a single document. Drag and drop interface, sort files, and download the combined result. Free and runs entirely in your browser.',
  alternates: {
    canonical: 'https://ilovemd.vercel.app/merge-markdown',
  },
  openGraph: {
    title: 'Merge Markdown Files - Combine Multiple MD Files Online',
    description: 'Merge multiple Markdown files into a single document. Drag and drop interface, sort files, and download the combined result.',
    url: 'https://ilovemd.vercel.app/merge-markdown',
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
