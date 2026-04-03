'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'

interface Document {
  id: string
  title: string
  subtitle: string
  doc_type: string
  brand_id: string
  created_by: string
  status: string
  current_version: number
  sections: any[]
  metadata: any
  orientation: string
  created_at: string
  updated_at: string
  brands?: { name: string; primary_color: string; secondary_color: string }
  profiles?: { full_name: string; email: string }
}

interface Profile { id: string; full_name: string; email: string }

const DOC_TYPE_LABELS: Record<string, string> = {
  report: 'Report', memo: 'Executive Memo', teaser: 'Investment Teaser',
  proposal: 'Proposal', loi: 'Letter of Intent', termsheet: 'Term Sheet',
  board: 'Board Presentation', 'pitch-deck': 'Pitch Deck'
}

const STATUS_STYLES: Record<string, string> = {
  draft:    'bg-gray-50 text-gray-500 border-gray-200',
  review:   'bg-yellow-50 text-yellow-700 border-yellow-200',
  final:    'bg-green-50 text-green-700 border-green-200',
  archived: 'bg-red-50 text-red-400 border-red-200',
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterBrand, setFilterBrand] = useState('')
  const [search, setSearch] = useState('')
  const [brands, setBrands] = useState<{id:string;name:string}[]>([])
  const [users, setUsers] = useState<Profile[]>([])
  const [shareModal, setShareModal] = useState<Document | null>(null)
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [shareAll, setShareAll] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [versionModal, setVersionModal] = useState<Document | null>(null)
  const [versions, setVersions] = useState<any[]>([])
  const supabase = createClient()

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: docs }, { data: br }, { data: usr }] = await Promise.all([
      supabase.from('documents').select('*, brands(name,primary_color,secondary_color), profiles(full_name,email)').order('updated_at', { ascending: false }),
      supabase.from('brands').select('id,name'),
      supabase.from('profiles').select('id,full_name,email')
    ])
    setDocuments(docs || [])
    setBrands(br || [])
    setUsers(usr || [])
    setLoading(false)
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('documents').update({ status }).eq('id', id)
    setDocuments(prev => prev.map(d => d.id === id ? { ...d, status } : d))
  }

  async function deleteDocument(id: string) {
    if (!confirm('Delete this document? This cannot be undone.')) return
    await supabase.from('documents').delete().eq('id', id)
    setDocuments(prev => prev.filter(d => d.id !== id))
  }

  async function openShare(doc: Document) {
    setShareModal(doc)
    setSelectedUsers([])
    setShareAll(false)
    // Load existing shares
    const { data } = await supabase.from('document_shares').select('shared_with').eq('document_id', doc.id)
    if (data) {
      const nullShare = data.find(s => s.shared_with === null)
      if (nullShare) { setShareAll(true) } else { setSelectedUsers(data.map(s => s.shared_with).filter(Boolean)) }
    }
  }

  async function saveShare() {
    if (!shareModal) return
    setSharing(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      // Delete existing shares for this doc
      await supabase.from('document_shares').delete().eq('document_id', shareModal.id)
      if (shareAll) {
        await supabase.from('document_shares').insert({ document_id: shareModal.id, shared_by: user?.id, shared_with: null, share_type: 'view' })
      } else if (selectedUsers.length > 0) {
        await supabase.from('document_shares').insert(
          selectedUsers.map(uid => ({ document_id: shareModal.id, shared_by: user?.id, shared_with: uid, share_type: 'view' }))
        )
      }
      setShareModal(null)
    } finally { setSharing(false) }
  }

  async function openVersions(doc: Document) {
    setVersionModal(doc)
    const { data } = await supabase.from('document_versions').select('*').eq('document_id', doc.id).order('version_number', { ascending: false })
    setVersions(data || [])
  }

  async function restoreVersion(ver: any) {
    if (!versionModal) return
    await supabase.from('documents').update({
      title: ver.title, subtitle: ver.subtitle, sections: ver.sections,
      metadata: ver.metadata, current_version: ver.version_number, updated_at: new Date().toISOString()
    }).eq('id', versionModal.id)
    setVersionModal(null)
    fetchAll()
  }

  const filtered = documents.filter(d => {
    if (filterType && d.doc_type !== filterType) return false
    if (filterStatus && d.status !== filterStatus) return false
    if (filterBrand && d.brand_id !== filterBrand) return false
    if (search && !d.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  function timeAgo(date: string) {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  return (
    <div className="flex flex-col flex-1">
      {/* Topbar */}
      <div className="bg-white border-b border-gray-200 px-7 py-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs text-gray-400 tracking-widest uppercase">AU Studio</div>
            <div className="font-bebas text-2xl text-aurum-black tracking-wide">Documents</div>
          </div>
          <a href="/dashboard/pdf?type=report" className="bg-aurum-black text-white px-5 py-2 text-xs font-medium hover:bg-aurum-yellow hover:text-aurum-black transition-colors">
            + New document
          </a>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search documents..."
            className="border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-aurum-black w-52"/>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-aurum-black bg-white">
            <option value="">All types</option>
            {Object.entries(DOC_TYPE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-aurum-black bg-white">
            <option value="">All status</option>
            {['draft','review','final','archived'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
          </select>
          <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)}
            className="border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-aurum-black bg-white">
            <option value="">All brands</option>
            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          {(filterType||filterStatus||filterBrand||search) && (
            <button onClick={()=>{setFilterType('');setFilterStatus('');setFilterBrand('');setSearch('')}}
              className="text-xs text-gray-400 hover:text-aurum-black">Clear</button>
          )}
          <span className="text-xs text-gray-400 ml-auto">{filtered.length} document{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Document list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-7 text-sm text-gray-400">Loading documents...</div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <div className="font-bebas text-5xl text-gray-100 tracking-widest mb-3">NO DOCUMENTS</div>
            <div className="text-sm text-gray-400 mb-6">Create your first document using any tool in the sidebar.</div>
            <a href="/dashboard/pdf?type=report" className="bg-aurum-black text-white px-6 py-3 text-xs font-medium hover:bg-aurum-yellow hover:text-aurum-black transition-colors inline-block">
              + Create document
            </a>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-7 py-3 text-xs text-gray-400 font-medium uppercase tracking-wider w-8"></th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wider">Title</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wider">Brand</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wider">Version</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wider">Updated</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wider">Owner</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc, i) => (
                <tr key={doc.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors group ${i % 2 === 0 ? '' : 'bg-white'}`}>
                  {/* Brand color indicator */}
                  <td className="px-7 py-3">
                    <div className="w-2 h-2 rounded-full" style={{ background: doc.brands?.primary_color || '#0A0A0A' }}/>
                  </td>
                  {/* Title */}
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-aurum-black">{doc.title}</div>
                    {doc.subtitle && <div className="text-xs text-gray-400 mt-0.5">{doc.subtitle}</div>}
                  </td>
                  {/* Type */}
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 font-medium">
                      {DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type}
                    </span>
                  </td>
                  {/* Brand */}
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-600">{doc.brands?.name || '—'}</span>
                  </td>
                  {/* Status */}
                  <td className="px-4 py-3">
                    <select value={doc.status} onChange={e => updateStatus(doc.id, e.target.value)}
                      className={`text-xs px-2 py-1 border outline-none bg-transparent cursor-pointer ${STATUS_STYLES[doc.status]}`}>
                      {['draft','review','final','archived'].map(s => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>
                      ))}
                    </select>
                  </td>
                  {/* Version */}
                  <td className="px-4 py-3">
                    <button onClick={() => openVersions(doc)} className="text-xs text-gray-400 hover:text-aurum-black transition-colors">
                      v{doc.current_version}
                    </button>
                  </td>
                  {/* Updated */}
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-400">{timeAgo(doc.updated_at)}</span>
                  </td>
                  {/* Owner */}
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-400">{doc.profiles?.full_name || doc.profiles?.email?.split('@')[0] || '—'}</span>
                  </td>
                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openShare(doc)} className="text-xs text-gray-400 hover:text-aurum-black px-2 py-1 border border-gray-200 hover:border-aurum-black transition-colors">
                        Share
                      </button>
                      <button onClick={() => deleteDocument(doc.id)} className="text-xs text-red-400 hover:text-red-600 px-2 py-1 border border-gray-200 hover:border-red-300 transition-colors">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Share Modal */}
      {shareModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-md">
            <div className="bg-aurum-black px-6 py-4 flex items-center justify-between">
              <div className="font-bebas text-aurum-yellow tracking-widest">Share Document</div>
              <button onClick={() => setShareModal(null)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="p-6">
              <div className="text-sm font-medium text-aurum-black mb-1">{shareModal.title}</div>
              <div className="text-xs text-gray-400 mb-5">{DOC_TYPE_LABELS[shareModal.doc_type]}</div>

              {/* Share all toggle */}
              <div className={`border p-4 mb-3 cursor-pointer transition-colors ${shareAll ? 'border-aurum-black bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}
                onClick={() => { setShareAll(!shareAll); setSelectedUsers([]) }}>
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 border-2 flex items-center justify-center flex-shrink-0 ${shareAll ? 'border-aurum-black bg-aurum-black' : 'border-gray-300'}`}>
                    {shareAll && <div className="w-2 h-2 bg-aurum-yellow"/>}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-aurum-black">Entire team</div>
                    <div className="text-xs text-gray-400">Everyone with access to AU Studio can view this document</div>
                  </div>
                </div>
              </div>

              {/* Specific users */}
              {!shareAll && (
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Or select specific users</div>
                  <div className="border border-gray-200 max-h-48 overflow-y-auto">
                    {users.map(u => (
                      <div key={u.id} onClick={() => setSelectedUsers(prev => prev.includes(u.id) ? prev.filter(x=>x!==u.id) : [...prev, u.id])}
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 border-b border-gray-50 last:border-0 ${selectedUsers.includes(u.id) ? 'bg-gray-50' : ''}`}>
                        <div className={`w-4 h-4 border-2 flex items-center justify-center flex-shrink-0 ${selectedUsers.includes(u.id) ? 'border-aurum-black bg-aurum-black' : 'border-gray-300'}`}>
                          {selectedUsers.includes(u.id) && <div className="w-2 h-2 bg-aurum-yellow"/>}
                        </div>
                        <div className="w-7 h-7 bg-aurum-black flex items-center justify-center text-aurum-yellow text-xs font-bold flex-shrink-0">
                          {(u.full_name||u.email).substring(0,1).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs font-medium text-aurum-black">{u.full_name || u.email.split('@')[0]}</div>
                          <div className="text-xs text-gray-400">{u.email}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-5">
                <button onClick={() => setShareModal(null)} className="flex-1 border border-gray-200 py-2.5 text-xs text-gray-500 hover:border-gray-400 transition-colors">Cancel</button>
                <button onClick={saveShare} disabled={sharing || (!shareAll && selectedUsers.length === 0)}
                  className="flex-1 bg-aurum-black text-white py-2.5 text-xs font-medium hover:bg-aurum-yellow hover:text-aurum-black transition-colors disabled:opacity-50">
                  {sharing ? 'Saving...' : 'Save sharing'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Version history modal */}
      {versionModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="bg-aurum-black px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div className="font-bebas text-aurum-yellow tracking-widest">Version History</div>
              <button onClick={() => setVersionModal(null)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="p-5 flex-shrink-0">
              <div className="text-sm font-medium text-aurum-black">{versionModal.title}</div>
              <div className="text-xs text-gray-400 mt-0.5">{DOC_TYPE_LABELS[versionModal.doc_type]} · Current: v{versionModal.current_version}</div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-5">
              {versions.length === 0 ? (
                <div className="text-xs text-gray-400 text-center py-8">No saved versions yet. Versions are saved each time you generate a document.</div>
              ) : (
                <div className="space-y-2">
                  {versions.map((ver) => (
                    <div key={ver.id} className={`border p-4 ${ver.version_number === versionModal.current_version ? 'border-aurum-black' : 'border-gray-200'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-aurum-black">v{ver.version_number}</span>
                            {ver.version_number === versionModal.current_version && (
                              <span className="text-xs bg-aurum-yellow text-aurum-black px-1.5 py-0.5 font-medium">Current</span>
                            )}
                          </div>
                          <div className="text-xs font-medium text-aurum-black mt-1">{ver.title}</div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {ver.sections?.length} sections · {new Date(ver.created_at).toLocaleDateString('en-US', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}
                          </div>
                          {ver.note && <div className="text-xs text-gray-500 italic mt-1">"{ver.note}"</div>}
                        </div>
                        {ver.version_number !== versionModal.current_version && (
                          <button onClick={() => restoreVersion(ver)}
                            className="text-xs border border-gray-200 px-3 py-1.5 hover:border-aurum-black hover:text-aurum-black transition-colors text-gray-500">
                            Restore
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
