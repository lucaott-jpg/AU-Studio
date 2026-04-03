'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top bar */}
      <div className="bg-aurum-black px-10 py-3 flex items-center justify-between">
        <span className="font-bebas text-aurum-yellow tracking-widest text-xl">AU Studio</span>
        <div className="flex gap-6">
          {['Platform', 'Team', 'Publish', 'About'].map(l => (
            <span key={l} className="text-xs text-gray-500 tracking-wider cursor-pointer hover:text-gray-300 transition-colors">{l}</span>
          ))}
        </div>
      </div>

      {/* Main */}
      <div className="flex flex-1">
        {/* Left — brand */}
        <div className="w-1/2 p-12 flex flex-col justify-between border-r border-gray-100">
          <div>
            <p className="text-xs tracking-widest uppercase text-gray-400 mb-4">Internal Creative Platform</p>
            <div className="w-12 h-1 bg-aurum-yellow mb-6" />
            <h1 className="font-bebas text-7xl text-aurum-black leading-none tracking-wide mb-6">
              CREATE.<br />PUBLISH.<br />
              <span className="text-aurum-yellow">IMPACT.</span>
            </h1>
            <p className="text-sm text-gray-400 leading-relaxed max-w-sm">
              Everything your brand needs — PDFs, presentations, images, and logo assets — built, reviewed, and published in one unified creative hub.
            </p>
            <button className="mt-8 flex items-center gap-3 bg-aurum-black text-white px-6 py-3 font-bebas tracking-widest text-base hover:bg-aurum-yellow hover:text-aurum-black transition-colors">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 7h10M7 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Access the platform
            </button>
          </div>
          <div className="flex gap-8 pt-8 border-t border-gray-100">
            {[['PDF', 'Documents'], ['PPT', 'Presentations'], ['IMG', 'Visuals'], ['LOGO', 'Identity']].map(([abbr, label]) => (
              <div key={abbr} className="border-l-2 border-aurum-black pl-3">
                <div className="font-bebas text-2xl text-aurum-black">{abbr}</div>
                <div className="text-xs text-gray-400 tracking-widest uppercase">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — form */}
        <div className="flex-1 flex items-center justify-center p-12">
          <div className="w-full max-w-sm">
            <p className="text-xs tracking-widest uppercase text-aurum-yellow font-medium mb-2">Welcome back</p>
            <h2 className="font-bebas text-4xl text-aurum-black tracking-wide mb-8">Sign in to your account</h2>

            <form onSubmit={handleLogin} className="flex flex-col gap-5">
              <div>
                <label className="section-label">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="input-field"
                />
              </div>
              <div>
                <label className="section-label">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="input-field"
                />
              </div>

              {error && (
                <p className="text-xs text-red-500 bg-red-50 border border-red-200 px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-aurum-black text-white py-3 font-bebas tracking-widest text-lg
                hover:bg-aurum-yellow hover:text-aurum-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            <p className="text-xs text-gray-400 text-center mt-5">
              No account?{' '}
              <span className="text-aurum-black underline cursor-pointer">Contact your admin</span>
            </p>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="bg-aurum-yellow px-10 py-3 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-aurum-black" />
        <span className="text-xs text-aurum-black font-medium tracking-wide">
          AU Studio · Internal Creative Hub · All content secured via Supabase
        </span>
      </div>
    </div>
  )
}
