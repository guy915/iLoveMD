export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: 'https://ai-doc-prep.vercel.app/sitemap.xml',
  }
}
