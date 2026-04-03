'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { useState } from 'react'

const navItems = [
  { label: 'Dashboard',  href: '/dashboard',           icon: '▪' },
  { label: 'Deals',      href: '/dashboard/deals',      icon: '◈' },
  { label: 'Brands',     href: '/dashboard/brands',     icon: '◉' },
  { label: 'Documents',  href: '/dashboard/documents',  icon: '▤' },
  { label: 'AU Studio',  href: '/dashboard/au-studio',  icon: '✦' },
  { label: 'Settings',   href: '/dashboard/settings',   icon: '◎' },
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
    <aside className="w-56 bg-aurum-black flex flex-col flex-shrink-0 min-h-screen border-r border-white/5">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-white/10">
        <div className="font-bebas text-aurum-yellow tracking-widest text-2xl leading-none">AU</div>
        <div className="text-xs text-gray-600 tracking-widest uppercase mt-0.5">Studio</div>
      </div>

      {/* New Document CTA */}
      <div className="px-4 py-4 border-b border-white/5">
        <button
          onClick={() => router.push('/dashboard/documents?new=1')}
          className="w-full bg-aurum-yellow text-aurum-black py-2.5 text-xs font-bold tracking-wider hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
          <span>+</span> New Document
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3">
        {navItems.map((item) => {
          const active = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(item.href)
          return (
            <button key={item.href} onClick={() => router.push(item.href)}
              className={`w-full flex items-center gap-3 px-6 py-2.5 text-xs transition-all text-left
                ${active
                  ? 'text-aurum-yellow bg-white/5 border-r-2 border-aurum-yellow'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/3'
                }`}>
              <span className="text-base leading-none">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* User */}
      <div className="border-t border-white/10 px-6 py-4">
        <button onClick={handleSignOut} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
          Sign out
        </button>
      </div>
    </aside>
  )
}
