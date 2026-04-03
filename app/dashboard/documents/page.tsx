'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

interface Brand { id: string; name: string; primary_color: string; secondary_color: string; logo_url: string | null }
interface Document {
  id: string; title: string; doc_type: string; status: string; current_version: number
  created_at: string; updated_at: string
  brands?: { name: string; primary_color: string }
  profiles?: { full_name: string; email: string }
}

const DOC_TYPES = [
  { key: 'report',    label: 'Report',             desc: 'Analytical report with findings and recommendations' },
  { key: 'teaser',   label: 'Investment Teaser',   desc: 'High-level opportunity overview for investors' },
  { key: 'loi',      label: 'Letter of Intent',    desc: 'Formal LOI outlining preliminary transaction terms' },
  { key: 'memo',     label: 'Executive Memo',      desc: 'Concise internal communication to leadership' },
  { key: 'proposal', label: 'Proposal',            desc: 'Formal business proposal with scope and fees' },
  { key: 'termsheet',label: 'Term Sheet',          desc: 'Principal terms of a proposed transaction' },
  { key: 'board',    label: 'Board Presentation',  desc: 'Board-level presentation on strategy and performance' },
  { key: 'pitch-deck',label: 'Pitch Deck',         desc: 'Investor or client presentation deck' },
]

const MODES = [
  { key: 'ai',     label: 'Generate with AU',   desc: 'Describe your document and AU will draft it at institutional quality' },
  { key: 'upload', label: 'Upload and improve', desc: 'Upload an existing document and AU will refine and reformat it' },
  { key: 'place',  label: 'Place as-is',        desc: 'Upload a file and AU applies your brand template without changing any content' },
]

const STATUS_STYLES: Record<string, string> = {
  draft:    'bg-gray-50 text-gray-500 border-gray-200',
  review:   'bg-yellow-50 text-yellow-700 border-yellow-200',
  final:    'bg-green-50 text-green-700 border-green-200',
  archived: 'bg-red-50 text-red-400 border-red-200',
}

function DocumentsInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const showNew = searchParams.get('new') === '1'

  const [documents, setDocuments] = useState<Document[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(showNew)
  const [step, setStep] = useState(1)
  const [selType, setSelType] = useState('')
  const [selBrand, setSelBrand] = useState('')
  const [selMode, setSelMode] = useState('')
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const supabase = createClient()

  useEffect(() => { fetchAll() }, [])
  useEffect(() => { if (showNew) { setShowModal(true); setStep(1); setSelType(''); setSelBrand(''); setSelMode('') } }, [showNew])

  async function fetchAll() {
    setLoading(true)
    const [{ data: docs }, { data: br }] = await Promise.all([
      supabase.from('documents').select('*, brands(name,primary_color), profiles(full_name,email)').order('updated_at', { ascending: false }),
      supabase.from('brands').select('id,name,primary_color,secondary_color,logo_url'),
    ])
    setDocuments(docs || [])
    setBrands(br || [])
    setLoading(false)
  }

  function canNext() {
    if (step === 1) return selType !== ''
    if (step === 2) return selBrand !== ''
    if (step === 3) return selMode !== ''
    return false
  }

  function handleCreate() {
    const params = new URLSearchParams({ type: selType, brand: selBrand, mode: selMode })
    if (selType === 'pitch-deck') {
      router.push('/dashboard/pitch-deck?' + params.toString())
    } else {
      router.push('/dashboard/pdf?' + params.toString())
    }
  }

  function openNew() {
    setShowModal(true)
    setStep(1)
    setSelType('')
    setSelBrand('')
    setSelMode('')
  }

  async function deleteDocument(id: string) {
    if (!confirm('Delete this document?')) return
    await supabase.from('documents').delete().eq('id', id)
    setDocuments(prev => prev.filter(d => d.id !== id))
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('documents').update({ status }).eq('id', id)
    setDocuments(prev => prev.map(d => d.id === id ? { ...d, status } : d))
  }

  function timeAgo(date: string) {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return mins + 'm ago'
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return hrs + 'h ago'
    return Math.floor(hrs / 24) + 'd ago'
  }

  const filtered = documents.filter(d => {
    if (filterType && d.doc_type !== filterType) return false
    if (filterStatus && d.status !== filterStatus) return false
    if (search && !d.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const selectedDocType = DOC_TYPES.find(t => t.key === selType)
  const selectedBrand = brands.find(b => b.id === selBrand)

  return (
    <div className="flex flex-col flex-1">
      <div className="bg-white border-b border-gray-100 px-8 py-5 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs text-gray-400 tracking-widest uppercase mb-0.5">AU Studio</div>
            <div className="font-bebas text-2xl text-aurum-black tracking-wide">Documents</div>
          </div>
          <button onClick={openNew} className="bg-aurum-black text-white px-5 py-2 text-xs font-medium hover:bg-aurum-yellow hover:text-aurum-black transition-colors">
            + New document
          </button>
        </div>
        <div className="flex items-center gap-3">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
            className="border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-aurum-black w-48"/>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="border border-gray-200 px-3 py-1.5 text-xs outline-none bg-white">
            <option value="">All types</option>
            {DOC_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="border border-gray-200 px-3 py-1.5 text-xs outline-none bg-white">
            <option value="">All status</option>
            <option value="draft">Draft</option>
            <option value="review">Review</option>
            <option value="final">Final</option>
            <option value="archived">Archived</option>
          </select>
          {(search || filterType || filterStatus) && (
            <button onClick={() => { setSearch(''); setFilterType(''); setFilterStatus('') }} className="text-xs text-gray-400 hover:text-aurum-black">Clear</button>
          )}
          <span className="text-xs text-gray-400 ml-auto">{filtered.length} document{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-8 text-sm text-gray-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <div className="font-bebas text-5xl text-gray-100 tracking-widest mb-3">NO DOCUMENTS</div>
            <div className="text-sm text-gray-400 mb-6">Create your first document.</div>
            <button onClick={openNew} className="bg-aurum-black text-white px-6 py-3 text-xs font-medium hover:bg-aurum-yellow hover:text-aurum-black transition-colors">
              + New document
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-8 py-3 text-xs text-gray-400 font-medium uppercase tracking-wider">Title</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wider">Brand</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wider">Updated</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc) => (
                <tr key={doc.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group">
                  <td className="px-8 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: doc.brands?.primary_color || '#0A0A0A' }}/>
                      <div className="text-sm font-medium text-aurum-black">{doc.title}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1">
                      {DOC_TYPES.find(t => t.key === doc.doc_type)?.label || doc.doc_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{doc.brands?.name || '--'}</td>
                  <td className="px-4 py-3">
                    <select value={doc.status} onChange={e => updateStatus(doc.id, e.target.value)}
                      className={'text-xs px-2 py-1 border outline-none bg-transparent cursor-pointer ' + (STATUS_STYLES[doc.status] || '')}>
                      <option value="draft">Draft</option>
                      <option value="review">Review</option>
                      <option value="final">Final</option>
                      <option value="archived">Archived</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{timeAgo(doc.updated_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => deleteDocument(doc.id)} className="text-xs text-red-400 hover:text-red-600 px-2 py-1 border border-gray-200 hover:border-red-300 transition-colors">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-2xl">
            <div className="bg-aurum-black px-6 py-4 flex items-center justify-between">
              <div>
                <div className="font-bebas text-aurum-yellow tracking-widest text-lg">New Document</div>
                <div className="flex items-center gap-2 mt-1">
                  {[1,2,3].map(s => (
                    <div key={s} className={'h-0.5 w-8 transition-colors ' + (s <= step ? 'bg-aurum-yellow' : 'bg-white/20')}/>
                  ))}
                  <span className="text-xs text-gray-500 ml-1">Step {step} of 3</span>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white text-xl leading-none">x</button>
            </div>

            <div className="p-6">
              {step === 1 && (
                <div>
                  <div className="text-sm font-medium text-aurum-black mb-1">Select document type</div>
                  <div className="text-xs text-gray-400 mb-4">What kind of document do you need?</div>
                  <div className="grid grid-cols-2 gap-2">
                    {DOC_TYPES.map(type => (
                      <button key={type.key} onClick={() => setSelType(type.key)}
                        className={'text-left p-4 border transition-all ' + (selType === type.key ? 'border-aurum-black bg-gray-50' : 'border-gray-200 hover:border-gray-300')}>
                        <div className="text-xs font-semibold text-aurum-black">{type.label}</div>
                        <div className="text-xs text-gray-400 mt-0.5 leading-tight">{type.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div>
                  <div className="text-sm font-medium text-aurum-black mb-1">Select brand profile</div>
                  <div className="text-xs text-gray-400 mb-4">Which brand identity should this document use?</div>
                  {brands.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-sm text-gray-400 mb-3">No brand profiles yet.</div>
                      <a href="/dashboard/brands" className="text-xs text-aurum-yellow underline">Create a brand first</a>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {brands.map(brand => (
                        <button key={brand.id} onClick={() => setSelBrand(brand.id)}
                          className={'w-full text-left p-4 border transition-all flex items-center gap-4 ' + (selBrand === brand.id ? 'border-aurum-black bg-gray-50' : 'border-gray-200 hover:border-gray-300')}>
                          <div className="flex gap-1 flex-shrink-0">
                            <div className="w-4 h-8" style={{ background: brand.primary_color }}/>
                            <div className="w-4 h-8" style={{ background: brand.secondary_color }}/>
                          </div>
                          <div className="font-medium text-sm text-aurum-black">{brand.name}</div>
                          {selBrand === brand.id && <div className="ml-auto text-aurum-yellow font-bold">✓</div>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {step === 3 && (
                <div>
                  <div className="text-sm font-medium text-aurum-black mb-1">How would you like to start?</div>
                  <div className="text-xs text-gray-400 mb-4">
                    Creating: <strong>{selectedDocType?.label}</strong> · Brand: <strong>{selectedBrand?.name}</strong>
                  </div>
                  <div className="space-y-2">
                    {MODES.map(m => (
                      <button key={m.key} onClick={() => setSelMode(m.key)}
                        className={'w-full text-left p-4 border transition-all ' + (selMode === m.key ? 'border-aurum-black bg-gray-50' : 'border-gray-200 hover:border-gray-300')}>
                        <div className="text-xs font-semibold text-aurum-black">{m.label}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{m.desc}</div>
                        {selMode === m.key && <div className="text-aurum-yellow font-bold text-xs mt-1">Selected</div>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                {step > 1 && (
                  <button onClick={() => setStep(s => s - 1)} className="border border-gray-200 px-5 py-3 text-xs text-gray-500 hover:border-gray-400 transition-colors">
                    Back
                  </button>
                )}
                <div className="flex-1"/>
                {step < 3 ? (
                  <button onClick={() => setStep(s => s + 1)} disabled={!canNext()}
                    className="bg-aurum-black text-white px-8 py-3 text-xs font-medium hover:bg-aurum-yellow hover:text-aurum-black transition-colors disabled:opacity-40">
                    Continue
                  </button>
                ) : (
                  <button onClick={handleCreate} disabled={!canNext()}
                    className="bg-aurum-yellow text-aurum-black px-8 py-3 text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-40">
                    Create document
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DocumentsPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center text-sm text-gray-400">Loading...</div>}>
      <DocumentsInner />
    </Suspense>
  )
}
