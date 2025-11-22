import { Metadata } from 'next'
import './globals.css'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import ErrorBoundary from '@/components/common/ErrorBoundary'
import { LogProvider } from '@/contexts/LogContext'
import { BASE_URL } from '@/lib/constants'

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: 'iLoveMD',
  description: 'Free online tool to convert PDF to Markdown and merge multiple Markdown files.',
  keywords: ['pdf to markdown', 'merge markdown', 'html to markdown', 'convert pdf to md', 'combine markdown', 'i love markdown', 'markdown tools', 'convert pdf', 'markdown tools', 'markdown utility', 'pdf2md', 'markdown', 'md', 'pdf2md', 'md merge', 'md tools'],
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
    title: 'iLoveMD',
    description: 'Convert PDFs to Markdown and merge Markdown files instantly for free.',
    images: ['/og-image.png'],
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
      </body>
    </html>
  )
}
