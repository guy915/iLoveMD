import Link from 'next/link'

export default function ToolTile({ icon, title, description, href }) {
  return (
    <Link
      href={href}
      className="block p-8 bg-white rounded-lg border border-gray-200 hover:border-primary-500 hover:shadow-lg transition-all"
    >
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </Link>
  )
}
