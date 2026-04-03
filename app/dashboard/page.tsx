'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

interface Document {
  id: string; title: string; doc_type: string; status: string
  updated_at: string; brands?: { name: string; primary_color: string; secondary_color: string }
}

const DOC_LABELS: Record<string, string> = {
  report: 'Report', teaser: 'Investment Teaser', loi: 'Letter of Intent',
  memo: 'Executive Memo', proposal: 'Proposal', termsheet: 'Term Sheet',
  board: 'Board Presentation', 'pitch-deck': 'Pitch Deck'
}

export default function DashboardPage() {
  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [firstName, setFirstName] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setFirstName(user.email.split('@')[0])
    })
    fetchDocs()
  }, [])

  async function fetchDocs() {
    setLoading(true)
    const { data } = await supabase.from('documents')
      .select('id, title, doc_type, status, updated_at, brands(name, primary_color, secondary_color)')
      .order('updated_at', { ascending: false })
      .limit(10)
    setDocs((data as any) || [])
    setLoading(false)
  }

  async function setStatus(id: string, status: string) {
    await supabase.from('documents').update({ status }).eq('id', id)
    setDocs(prev => prev.map(d => d.id === id ? { ...d, status } : d))
  }

  function timeAgo(date: string) {
    const diff = Date.now() - new Date(date).getTime()
    const h = Math.floor(diff / 3600000)
    if (h < 1) return 'Just now'
    if (h < 24) return h + 'h ago'
    return Math.floor(h / 24) + 'd ago'
  }

  const draft = docs.filter(d => d.status === 'draft')
  const approved = docs.filter(d => d.status === 'final')

  return (
    <div className="flex flex-col flex-1 min-h-screen bg-aurum-surface">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-8 py-6 flex items-center justify-between flex-shrink-0">
        <div>
          <div className="text-xs text-gray-400 tracking-widest uppercase mb-1">AU Studio</div>
          <div className="font-bebas text-3xl text-aurum-black tracking-wide leading-none">
            {firstName ? 'Welcome back, ' + firstName : 'Dashboard'}
          </div>
        </div>
        <button onClick={() => router.push('/dashboard/documents/new')}
          className="bg-aurum-black text-white px-6 py-3 text-xs font-bold tracking-widest hover:bg-aurum-yellow hover:text-aurum-black transition-all">
          + NEW DOCUMENT
        </button>
      </div>

      <div className="flex-1 p-8 max-w-5xl w-full mx-auto">
        {/* Start CTA - shown when no docs */}
        {!loading && docs.length === 0 && (
          <div className="bg-white border border-gray-200 p-16 text-center mb-8">
            <div className="font-bebas text-6xl text-gray-100 tracking-widest mb-4">START</div>
            <div className="text-sm text-gray-400 mb-8 max-w-sm mx-auto">
              Upload any document. AU applies your brand identity and delivers a professional PDF instantly.
            </div>
            <button onClick={() => router.push('/dashboard/documents/new')}
              className="bg-aurum-black text-white px-8 py-4 text-xs font-bold tracking-widest hover:bg-aurum-yellow hover:text-aurum-black transition-all">
              CREATE FIRST DOCUMENT
            </button>
          </div>
        )}

        {/* Draft column */}
        {(loading || draft.length > 0) && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-gray-300 rounded-full"/>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Draft</div>
                <div className="text-xs text-gray-300">{draft.length}</div>
              </div>
              <button onClick={() => router.push('/dashboard/documents')}
                className="text-xs text-gray-400 hover:text-aurum-black transition-colors">View all</button>
            </div>
            <div className="space-y-2">
              {loading ? (
                [1,2,3].map(i => <div key={i} className="bg-white border border-gray-100 h-16 animate-pulse"/>)
              ) : (
                draft.map(doc => (
                  <DocRow key={doc.id} doc={doc} onStatus={setStatus} timeAgo={timeAgo} router={router}/>
                ))
              )}
            </div>
          </div>
        )}

        {/* Approved column */}
        {(loading || approved.length > 0) && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2 h-2 bg-green-400 rounded-full"/>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Approved</div>
              <div className="text-xs text-gray-300">{approved.length}</div>
            </div>
            <div className="space-y-2">
              {loading ? (
                [1,2].map(i => <div key={i} className="bg-white border border-gray-100 h-16 animate-pulse"/>)
              ) : (
                approved.map(doc => (
                  <DocRow key={doc.id} doc={doc} onStatus={setStatus} timeAgo={timeAgo} router={router}/>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function DocRow({ doc, onStatus, timeAgo, router }: {
  doc: Document
  onStatus: (id: string, status: string) => void
  timeAgo: (d: string) => string
  router: any
}) {
  return (
    <div className="bg-white border border-gray-100 px-5 py-4 flex items-center gap-4 hover:border-gray-300 transition-colors group">
      {/* Brand color dot */}
      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: doc.brands?.primary_color || '#0A0A0A' }}/>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-aurum-black truncate">{doc.title}</div>
        <div className="text-xs text-gray-400 mt-0.5">
          {DOC_LABELS[doc.doc_type] || doc.doc_type}
          {doc.brands?.name && <span className="text-gray-300"> Â· {doc.brands.name}</span>}
        </div>
      </div>

      {/* Time */}
      <div className="text-xs text-gray-400 flex-shrink-0">{timeAgo(doc.updated_at)}</div>

      {/* Status toggle */}
      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {doc.status !== 'final' && (
          <button onClick={() => onStatus(doc.id, 'final')}
            className="text-xs border border-green-200 text-green-600 px-2.5 py-1 hover:bg-green-50 transition-colors">
            Approve
          </button>
        )}
        {doc.status !== 'draft' && (
          <button onClick={() => onStatus(doc.id, 'draft')}
            className="text-xs border border-gray-200 text-gray-500 px-2.5 py-1 hover:bg-gray-50 transition-colors">
            Move to draft
          </button>
        )}
      </div>
    </div>
  )
}

