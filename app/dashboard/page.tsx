'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

const metrics = [
  { val: '0', label: 'Active deals', delta: 'View deals', href: '/dashboard/deals', accent: true },
  { val: '0', label: 'Documents', delta: 'View all', href: '/dashboard/documents', accent: false },
  { val: '0', label: 'Brands', delta: 'View brands', href: '/dashboard/brands', accent: false },
]

export default function DashboardPage() {
  const [firstName, setFirstName] = useState('there')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setFirstName(user.email.split('@')[0])
    })
  }, [])

  return (
    <div className="flex flex-col flex-1">
      <div className="bg-white border-b border-gray-100 px-8 py-5">
        <div className="text-xs text-gray-400 tracking-widest uppercase mb-0.5">AU Studio</div>
        <div className="font-bebas text-2xl text-aurum-black tracking-wide">Dashboard</div>
      </div>
      <div className="p-8">
        <div className="mb-8">
          <div className="font-bebas text-3xl text-aurum-black tracking-wide">Hello, {firstName}</div>
          <div className="text-sm text-gray-400 mt-1">Welcome to AU Studio. What are you working on today?</div>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-8">
          {metrics.map(m => (
            <a key={m.label} href={m.href} className="bg-white border border-gray-200 p-5 hover:border-aurum-black transition-colors block">
              <div className="font-bebas text-4xl text-aurum-black leading-none">{m.val}</div>
              <div className="text-xs text-gray-400 tracking-wider uppercase mt-1">{m.label}</div>
              <div className="text-xs text-aurum-yellow mt-2">{m.delta} →</div>
            </a>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <a href="/dashboard/documents?new=1" className="bg-aurum-black text-white p-6 hover:bg-aurum-yellow hover:text-aurum-black transition-colors block">
            <div className="font-bebas text-xl tracking-wide mb-1">+ New Document</div>
            <div className="text-xs opacity-60">Create a report, teaser, LOI, pitch deck and more</div>
          </a>
          <a href="/dashboard/deals" className="bg-white border border-gray-200 p-6 hover:border-aurum-black transition-colors block">
            <div className="font-bebas text-xl tracking-wide mb-1 text-aurum-black">+ New Deal</div>
            <div className="text-xs text-gray-400">Capture deal data to power your documents</div>
          </a>
        </div>
      </div>
    </div>
  )
}
