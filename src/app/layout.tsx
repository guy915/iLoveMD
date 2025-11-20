import { Metadata } from 'next'
import './globals.css'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import ErrorBoundary from '@/components/common/ErrorBoundary'
import { LogProvider } from '@/contexts/LogContext'

export const metadata: Metadata = {
  title: 'PDF to Markdown Converter & Merge Tool | iLoveMD',
  description: 'Free online tool to convert PDF to Markdown and merge multiple Markdown files. Best for preparing documents for LLMs and AI training.',
  keywords: ['pdf to markdown', 'merge markdown files', 'html to markdown', 'convert pdf to md', 'combine markdown'],
  icons: {
    icon: '/favicon.png',
  },
  openGraph: {
    title: 'PDF to Markdown Converter & Merge Tool',
    description: 'Convert PDFs to Markdown and merge files instantly for free.',
    type: 'website',
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
