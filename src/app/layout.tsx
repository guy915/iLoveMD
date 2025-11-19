import { Metadata } from 'next'
import './globals.css'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import ErrorBoundary from '@/components/common/ErrorBoundary'
import { LogProvider } from '@/contexts/LogContext'

export const metadata: Metadata = {
  title: 'iLoveMD',
  description: 'Markdown utilities - Convert PDFs, HTML, and merge markdown files',
  icons: {
    icon: '/favicon.png',
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
