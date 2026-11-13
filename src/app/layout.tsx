import { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import ErrorBoundary from '@/components/common/ErrorBoundary'
import { LogProvider } from '@/contexts/LogContext'
import { BASE_URL } from '@/lib/constants'

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'iLoveMD - PDF to Markdown Converter & Markdown Merger',
    template: '%s | iLoveMD',
  },
  description: 'Free online tool to convert PDF to Markdown and merge multiple Markdown files.',
  keywords: ['pdf to markdown', 'merge markdown', 'convert pdf to md', 'combine markdown', 'i love markdown', 'markdown tools', 'convert pdf', 'markdown utility', 'pdf2md', 'markdown', 'md merge'],
  authors: [{ name: 'iLoveMD' }],
  creator: 'iLoveMD',
  publisher: 'iLoveMD',
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
  openGraph: {
    title: 'PDF to Markdown Converter & Merge Tool',
    description: 'Convert PDFs to Markdown and merge files instantly for free.',
    type: 'website',
    url: BASE_URL,
    siteName: 'iLoveMD',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'iLoveMD',
    description: 'Convert PDFs to Markdown and merge Markdown files instantly for free.',
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
  verification: {
    google: 'LveIIEZWXDOLICpboq2K5SDSjxoFBoTIHP85aP7DEDg',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
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
          <main className="flex-1 flex flex-col">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </main>
          <Footer />
        </LogProvider>
        <Analytics />
      </body>
    </html>
  )
}
