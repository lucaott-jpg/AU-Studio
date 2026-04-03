'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

const navItems = [
  { label: 'Workspaces', type: 'section' },
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Team area', href: '/dashboard/team', badge: '3' },
  { label: 'Publication', href: '/dashboard/publication' },
  { label: 'My workspace', href: '/dashboard/workspace' },
  { label: 'Creation', type: 'section' },
  { label: 'PDF', href: '/dashboard/pdf' },
  { label: 'Presentations', href: '/dashboard/presentations' },
  { label: 'Images', href: '/dashboard/images' },
  { label: 'Logo studio', href: '/dashboard/logo-studio' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-52 bg-aurum-black flex flex-col flex-shrink-0 min-h-screen">
      <div className="px-5 py-5 border-b border-white/10">
        <div className="font-bebas text-aurum-yellow tracking-widest text-xl">AU Studio</div>
        <div className="text-xs text-gray-600 tracking-widest uppercase mt-0.5">Creative Hub</div>
      </div>

      <nav className="flex-1 py-2">
        {navItems.map((item, i) => {
          if (item.type === 'section') {
            return (
              <div key={i} className="px-5 pt-4 pb-1 text-xs text-gray-600 tracking-widest uppercase">
                {item.label}
              </div>
            )
          }
          const isActive = pathname === item.href
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href!)}
              className={`w-full flex items-center gap-2.5 px-5 py-2.5 text-xs transition-all border-l-2 text-left
                ${isActive
                  ? 'text-aurum-yellow border-aurum-yellow bg-yellow-950/30'
                  : 'text-gray-500 border-transparent hover:text-gray-300 hover:bg-white/5'
                }`}
            >
              <span className="w-1 h-1 rounded-full bg-current flex-shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="bg-aurum-yellow text-aurum-black text-xs font-medium px-1.5 py-0.5 rounded-full leading-none">
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <button
          onClick={handleSignOut}
          className="w-full text-left text-xs text-gray-600 hover:text-gray-300 transition-colors px-1 py-1.5"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
