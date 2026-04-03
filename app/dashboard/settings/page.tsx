'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null)
  const [fullName, setFullName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      supabase.from('profiles').select('full_name').eq('id', user?.id).single().then(({ data }) => {
        if (data) setFullName(data.full_name || '')
      })
    })
  }, [])

  async function handleSave() {
    if (!user) return
    setSaving(true)
    await supabase.from('profiles').upsert({ id: user.id, full_name: fullName, updated_at: new Date().toISOString() })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex flex-col flex-1">
      <div className="bg-white border-b border-gray-100 px-8 py-5">
        <div className="text-xs text-gray-400 tracking-widest uppercase mb-0.5">AU Studio</div>
        <div className="font-bebas text-2xl text-aurum-black tracking-wide">Settings</div>
      </div>
      <div className="p-8 max-w-lg">
        <div className="bg-white border border-gray-200 p-6 mb-4">
          <div className="text-xs text-gray-400 uppercase tracking-widest mb-4 font-semibold border-b border-gray-100 pb-2">Profile</div>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Email</label>
              <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 border border-gray-200">{user?.email || '—'}</div>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Full Name</label>
              <input value={fullName} onChange={e => setFullName(e.target.value)}
                className="w-full border border-gray-200 px-3 py-2 text-sm outline-none focus:border-aurum-black"/>
            </div>
            <button onClick={handleSave} disabled={saving}
              className="bg-aurum-black text-white px-5 py-2 text-xs font-medium hover:bg-aurum-yellow hover:text-aurum-black transition-colors disabled:opacity-50">
              {saved ? '✓ Saved' : saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
