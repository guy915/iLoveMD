import './globals.css'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import ErrorBoundary from '@/components/common/ErrorBoundary'

export const metadata = {
  title: 'AI Doc Prep',
  description: 'Prepare documents for LLMs - Convert PDFs, HTML, and merge markdown files',
}

/**
 * Root layout component
 * Wraps all pages with header, footer, and error boundary
 */
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
        <Footer />
      </body>
    </html>
  )
}
