'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

const nav = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Brands',    href: '/dashboard/brands' },
  { label: 'Documents', href: '/dashboard/documents' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  return (
    <aside className="w-52 bg-aurum-black flex flex-col min-h-screen flex-shrink-0">
      <div className="px-6 py-7 border-b border-white/10">
        <div className="font-bebas text-aurum-yellow tracking-widest text-3xl leading-none">AU</div>
        <div className="text-xs text-gray-600 tracking-widest uppercase mt-0.5">Studio</div>
      </div>
      <nav className="flex-1 py-4">
        {nav.map(item => {
          const active = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(item.href)
          return (
            <button key={item.href} onClick={() => router.push(item.href)}
              className={`w-full text-left px-6 py-3 text-xs font-medium transition-all border-r-2 ${
                active
                  ? 'text-aurum-yellow border-aurum-yellow bg-white/5'
                  : 'text-gray-500 border-transparent hover:text-gray-300 hover:bg-white/5'
              }`}>
              {item.label}
            </button>
          )
        })}
      </nav>
      <div className="border-t border-white/10 px-6 py-5">
        <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
          className="text-xs text-gray-600 hover:text-gray-300 transition-colors">
          Sign out
        </button>
      </div>
    </aside>
  )
}
