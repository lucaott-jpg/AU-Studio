'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

const navItems = [
  { label: 'Workspaces', type: 'section' },
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Brand Profiles', type: 'section' },
  { label: 'Brands', href: '/dashboard/brands' },
  { label: 'Reports & Analysis', type: 'section' },
  { label: 'Report', href: '/dashboard/pdf?type=report' },
  { label: 'Executive Memo', href: '/dashboard/pdf?type=memo' },
  { label: 'Investment Teaser', href: '/dashboard/pdf?type=teaser' },
  { label: 'Proposals & Legal', type: 'section' },
  { label: 'Proposal', href: '/dashboard/pdf?type=proposal' },
  { label: 'Letter of Intent', href: '/dashboard/pdf?type=loi' },
  { label: 'Term Sheet', href: '/dashboard/pdf?type=termsheet' },
  { label: 'Presentations', type: 'section' },
  { label: 'Pitch Deck', href: '/dashboard/pitch-deck' },
  { label: 'Board Presentation', href: '/dashboard/pdf?type=board' },
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

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    const path = href.split('?')[0]
    const param = href.includes('?') ? href.split('?')[1] : null
    if (param && pathname.includes(path)) {
      if (typeof window !== 'undefined') {
        return window.location.search.includes(param)
      }
    }
    return pathname === path && !href.includes('?')
  }

  return (
    <aside className="w-52 bg-aurum-black flex flex-col flex-shrink-0 min-h-screen">
      <div className="px-5 py-5 border-b border-white/10">
        <div className="font-bebas text-aurum-yellow tracking-widest text-xl">AU Studio</div>
        <div className="text-xs text-gray-600 tracking-widest uppercase mt-0.5">Creative Hub</div>
      </div>

      <nav className="flex-1 py-2 overflow-y-auto">
        {navItems.map((item, i) => {
          if (item.type === 'section') {
            return (
              <div key={i} className="px-5 pt-4 pb-1 text-xs text-gray-600 tracking-widest uppercase">
                {item.label}
              </div>
            )
          }
          const active = isActive(item.href!)
          return (
            <button key={item.href} onClick={() => router.push(item.href!)}
              className={`w-full flex items-center gap-2.5 px-5 py-2 text-xs transition-all border-l-2 text-left
                ${active ? 'text-aurum-yellow border-aurum-yellow bg-yellow-950/30' : 'text-gray-500 border-transparent hover:text-gray-300 hover:bg-white/5'}`}>
              <span className="w-1 h-1 rounded-full bg-current flex-shrink-0" />
              <span className="flex-1">{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <button onClick={handleSignOut} className="w-full text-left text-xs text-gray-600 hover:text-gray-300 transition-colors px-1 py-1.5">
          Sign out
        </button>
      </div>
    </aside>
  )
}
