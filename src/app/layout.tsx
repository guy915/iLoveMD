import { Metadata } from 'next'
import './globals.css'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import ErrorBoundary from '@/components/common/ErrorBoundary'
import { LogProvider } from '@/contexts/LogContext'

export const metadata: Metadata = {
  metadataBase: new URL('https://ilovemd.vercel.app'),
  title: 'PDF to Markdown Converter & Merge Tool | iLoveMD',
  description: 'Free online tool to convert PDF to Markdown and merge multiple Markdown files. Best for preparing documents for LLMs and AI training.',
  keywords: ['pdf to markdown', 'merge markdown files', 'html to markdown', 'convert pdf to md', 'combine markdown'],
  authors: [{ name: 'iLoveMD' }],
  creator: 'iLoveMD',
  publisher: 'iLoveMD',
  icons: {
    icon: '/favicon.png',
    apple: '/apple-icon.png',
  },
  openGraph: {
    title: 'PDF to Markdown Converter & Merge Tool',
    description: 'Convert PDFs to Markdown and merge files instantly for free.',
    type: 'website',
    url: 'https://ilovemd.vercel.app',
    siteName: 'iLoveMD',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'iLoveMD Tools',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PDF to Markdown Converter & Merge Tool | iLoveMD',
    description: 'Convert PDFs to Markdown and merge files instantly for free.',
    images: ['/og-image.png'],
    creator: '@ilovemd',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

interface RootLayoutProps {
  children: React.ReactNode
}

/**
 * Root layout component
 * Wraps all pages with header, footer, and error boundary
 */
export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen">
        <LogProvider>
          <Header />
          <main className="flex-1">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </main>
          <Footer />
        </LogProvider>
      </body>
    </html>
  )
}
