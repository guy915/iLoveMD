import './globals.css'

export const metadata = {
  title: 'AI Doc Prep',
  description: 'Prepare documents for LLMs - Convert PDFs, HTML, and merge markdown files',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen">
        {children}
      </body>
    </html>
  )
}
