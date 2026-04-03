'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'

interface Deal {
  id: string
  name: string
  company: string
  description: string
  stage: string
  deal_type: string
  location: string
  sector: string
  deal_size: string
  revenue: string
  ebitda: string
  highlights: string[]
  risks: string[]
  timeline: string
  created_at: string
  updated_at: string
}

const STAGES = ['Prospecting', 'Under Review', 'Due Diligence', 'Negotiation', 'Closed Won', 'Closed Lost']
const DEAL_TYPES = ['M&A', 'Private Equity', 'Venture Capital', 'Real Estate', 'Debt Financing', 'IPO', 'Advisory', 'Other']
const SECTORS = ['Finance & Investment', 'Real Estate', 'Technology', 'Healthcare', 'Energy', 'Manufacturing', 'Consumer', 'Legal', 'Other']

const STAGE_STYLES: Record<string, string> = {
  'Prospecting':    'bg-gray-50 text-gray-500 border-gray-200',
  'Under Review':   'bg-blue-50 text-blue-600 border-blue-200',
  'Due Diligence':  'bg-yellow-50 text-yellow-700 border-yellow-200',
  'Negotiation':    'bg-orange-50 text-orange-700 border-orange-200',
  'Closed Won':     'bg-green-50 text-green-700 border-green-200',
  'Closed Lost':    'bg-red-50 text-red-400 border-red-200',
}

const emptyForm = {
  name: '', company: '', description: '', stage: 'Under Review', deal_type: 'M&A',
  location: '', sector: 'Finance & Investment', deal_size: '', revenue: '', ebitda: '',
  highlights: ['', '', ''], risks: ['', '', ''], timeline: ''
}

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editDeal, setEditDeal] = useState<Deal | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [search, setSearch] = useState('')
  const [filterStage, setFilterStage] = useState('')
  const supabase = createClient()

  useEffect(() => { fetchDeals() }, [])

  async function fetchDeals() {
    setLoading(true)
    const { data } = await supabase.from('deals').select('*').order('updated_at', { ascending: false })
    setDeals(data || [])
    setLoading(false)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const payload = {
        ...form,
        highlights: form.highlights.filter(h => h.trim()),
        risks: form.risks.filter(r => r.trim()),
        created_by: user?.id,
        updated_at: new Date().toISOString()
      }
      if (editDeal) {
        await supabase.from('deals').update(payload).eq('id', editDeal.id)
      } else {
        await supabase.from('deals').insert(payload)
      }
      await fetchDeals()
      setShowForm(false)
      setEditDeal(null)
      setForm(emptyForm)
    } finally { setSaving(false) }
  }

  async function deleteDeal(id: string) {
    if (!confirm('Delete this deal?')) return
    await supabase.from('deals').delete().eq('id', id)
    setDeals(prev => prev.filter(d => d.id !== id))
  }

  function openEdit(d: Deal) {
    setEditDeal(d)
    setForm({
      name: d.name, company: d.company, description: d.description,
      stage: d.stage, deal_type: d.deal_type, location: d.location || '',
      sector: d.sector || 'Finance & Investment', deal_size: d.deal_size || '',
      revenue: d.revenue || '', ebitda: d.ebitda || '',
      highlights: [...(d.highlights || ['', '', '']), '', ''].slice(0, 3),
      risks: [...(d.risks || ['', '', '']), '', ''].slice(0, 3),
      timeline: d.timeline || ''
    })
    setShowForm(true)
  }

  function updateHighlight(i: number, val: string) {
    const arr = [...form.highlights]; arr[i] = val; setForm(f => ({ ...f, highlights: arr }))
  }
  function updateRisk(i: number, val: string) {
    const arr = [...form.risks]; arr[i] = val; setForm(f => ({ ...f, risks: arr }))
  }

  const filtered = deals.filter(d => {
    if (filterStage && d.stage !== filterStage) return false
    if (search && !d.name.toLowerCase().includes(search.toLowerCase()) && !d.company.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  function timeAgo(date: string) {
    const diff = Date.now() - new Date(date).getTime()
    const days = Math.floor(diff / 86400000)
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    return `${days}d ago`
  }

  return (
    <div className="flex flex-col flex-1">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-8 py-5 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs text-gray-400 tracking-widest uppercase mb-0.5">AU Studio</div>
            <div className="font-bebas text-2xl text-aurum-black tracking-wide">Deals</div>
          </div>
          <button onClick={() => { setForm(emptyForm); setEditDeal(null); setShowForm(true) }}
            className="bg-aurum-black text-white px-5 py-2 text-xs font-medium hover:bg-aurum-yellow hover:text-aurum-black transition-colors">
            + New deal
          </button>
        </div>
        <div className="flex items-center gap-3">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search deals..."
            className="border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-aurum-black w-52"/>
          <select value={filterStage} onChange={e => setFilterStage(e.target.value)}
            className="border border-gray-200 px-3 py-1.5 text-xs outline-none bg-white">
            <option value="">All stages</option>
            {STAGES.map(s => <option key={s}>{s}</option>)}
          </select>
          {(search || filterStage) && (
            <button onClick={() => { setSearch(''); setFilterStage('') }} className="text-xs text-gray-400 hover:text-aurum-black">Clear</button>
          )}
          <span className="text-xs text-gray-400 ml-auto">{filtered.length} deal{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto bg-aurum-surface">
        {loading ? (
          <div className="p-8 text-sm text-gray-400">Loading deals...</div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <div className="font-bebas text-5xl text-gray-100 tracking-widest mb-3">NO DEALS</div>
            <div className="text-sm text-gray-400 mb-6">Create your first deal to start generating documents.</div>
            <button onClick={() => setShowForm(true)} className="bg-aurum-black text-white px-6 py-3 text-xs font-medium hover:bg-aurum-yellow hover:text-aurum-black transition-colors">
              + New deal
            </button>
          </div>
        ) : (
          <div className="p-6 grid grid-cols-3 gap-4">
            {filtered.map(deal => (
              <div key={deal.id} className="bg-white border border-gray-200 hover:border-gray-300 transition-colors group">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-aurum-black text-sm truncate">{deal.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{deal.company}</div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 border flex-shrink-0 ml-2 ${STAGE_STYLES[deal.stage] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                      {deal.stage}
                    </span>
                  </div>

                  {deal.description && (
                    <div className="text-xs text-gray-500 leading-relaxed mb-3 line-clamp-2">{deal.description}</div>
                  )}

                  <div className="flex gap-3 mb-3">
                    {deal.deal_size && (
                      <div>
                        <div className="text-xs text-gray-400 uppercase tracking-wide">Size</div>
                        <div className="text-xs font-medium text-aurum-black">{deal.deal_size}</div>
                      </div>
                    )}
                    {deal.sector && (
                      <div>
                        <div className="text-xs text-gray-400 uppercase tracking-wide">Sector</div>
                        <div className="text-xs font-medium text-aurum-black">{deal.sector}</div>
                      </div>
                    )}
                    {deal.location && (
                      <div>
                        <div className="text-xs text-gray-400 uppercase tracking-wide">Location</div>
                        <div className="text-xs font-medium text-aurum-black">{deal.location}</div>
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-gray-300 mb-3">{deal.deal_type} · {timeAgo(deal.updated_at)}</div>

                  <div className="flex gap-2 pt-3 border-t border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(deal)} className="flex-1 border border-gray-200 py-1.5 text-xs text-gray-500 hover:border-aurum-black hover:text-aurum-black transition-colors">Edit</button>
                    <a href={`/dashboard/documents?new=1&deal=${deal.id}`} className="flex-1 bg-aurum-black text-white py-1.5 text-xs font-medium text-center hover:bg-aurum-yellow hover:text-aurum-black transition-colors">+ Document</a>
                    <button onClick={() => deleteDeal(deal.id)} className="border border-gray-200 px-3 py-1.5 text-xs text-red-400 hover:border-red-300 transition-colors">✕</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="bg-aurum-black px-6 py-4 flex items-center justify-between sticky top-0 z-10">
              <div className="font-bebas text-aurum-yellow tracking-widest text-lg">{editDeal ? 'Edit Deal' : 'New Deal'}</div>
              <button onClick={() => { setShowForm(false); setEditDeal(null) }} className="text-gray-400 hover:text-white text-xl leading-none">✕</button>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic */}
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-widest mb-3 pb-2 border-b border-gray-100 font-semibold">Deal Information</div>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Deal Name *', key: 'name', ph: 'e.g. Project Atlas' },
                    { label: 'Company', key: 'company', ph: 'e.g. Meridian Capital Ltd' },
                    { label: 'Location', key: 'location', ph: 'e.g. New York, NY' },
                    { label: 'Timeline', key: 'timeline', ph: 'e.g. Q2 2026 close' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">{f.label}</label>
                      <input value={form[f.key as keyof typeof form] as string}
                        onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                        className="w-full border border-gray-200 px-3 py-2 text-sm outline-none focus:border-aurum-black" placeholder={f.ph}/>
                    </div>
                  ))}
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Stage</label>
                    <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}
                      className="w-full border border-gray-200 px-3 py-2 text-sm outline-none bg-white">
                      {STAGES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Deal Type</label>
                    <select value={form.deal_type} onChange={e => setForm(f => ({ ...f, deal_type: e.target.value }))}
                      className="w-full border border-gray-200 px-3 py-2 text-sm outline-none bg-white">
                      {DEAL_TYPES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Sector</label>
                    <select value={form.sector} onChange={e => setForm(f => ({ ...f, sector: e.target.value }))}
                      className="w-full border border-gray-200 px-3 py-2 text-sm outline-none bg-white">
                      {SECTORS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Description</label>
                    <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      rows={3} className="w-full border border-gray-200 px-3 py-2 text-sm outline-none focus:border-aurum-black resize-none"
                      placeholder="Brief description of the deal opportunity..."/>
                  </div>
                </div>
              </div>

              {/* Financials */}
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-widest mb-3 pb-2 border-b border-gray-100 font-semibold">Financials</div>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Deal Size', key: 'deal_size', ph: 'e.g. $50M' },
                    { label: 'Revenue', key: 'revenue', ph: 'e.g. $12M ARR' },
                    { label: 'EBITDA', key: 'ebitda', ph: 'e.g. $3.2M' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">{f.label}</label>
                      <input value={form[f.key as keyof typeof form] as string}
                        onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                        className="w-full border border-gray-200 px-3 py-2 text-sm outline-none focus:border-aurum-black" placeholder={f.ph}/>
                    </div>
                  ))}
                </div>
              </div>

              {/* Highlights & Risks */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-widest mb-3 pb-2 border-b border-gray-100 font-semibold">Key Highlights</div>
                  {form.highlights.map((h, i) => (
                    <input key={i} value={h} onChange={e => updateHighlight(i, e.target.value)}
                      className="w-full border border-gray-200 px-3 py-2 text-sm outline-none focus:border-aurum-black mb-2"
                      placeholder={`Highlight ${i + 1}`}/>
                  ))}
                </div>
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-widest mb-3 pb-2 border-b border-gray-100 font-semibold">Key Risks</div>
                  {form.risks.map((r, i) => (
                    <input key={i} value={r} onChange={e => updateRisk(i, e.target.value)}
                      className="w-full border border-gray-200 px-3 py-2 text-sm outline-none focus:border-aurum-black mb-2"
                      placeholder={`Risk ${i + 1}`}/>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => { setShowForm(false); setEditDeal(null) }}
                  className="flex-1 border border-gray-200 py-3 text-sm text-gray-500 hover:border-gray-400 transition-colors">Cancel</button>
                <button onClick={handleSave} disabled={saving || !form.name.trim()}
                  className="flex-1 bg-aurum-black text-white py-3 text-sm font-medium hover:bg-aurum-yellow hover:text-aurum-black transition-colors disabled:opacity-50">
                  {saving ? 'Saving...' : editDeal ? 'Save changes' : 'Create deal'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
