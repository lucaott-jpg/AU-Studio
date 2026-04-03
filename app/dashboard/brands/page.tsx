'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase-browser'

interface Brand {
  id: string; name: string; industry: string; tagline: string; legal_name: string
  primary_color: string; secondary_color: string; accent_color: string
  font_heading: string; font_body: string; tone: string
  logo_url: string | null; logo_transparent_url: string | null
}

const tones = ['Formal & Authoritative','Professional & Warm','Technical & Precise','Bold & Direct','Conservative & Trustworthy']
const fonts = ['Helvetica','Times New Roman','Georgia','Arial','Garamond','Futura','Roboto']
const industries = ['Finance & Investment','Real Estate','Healthcare','Technology','Legal','Consulting','Manufacturing','Energy','Other']

const COLOR_HINTS = [
  { key: 'primary_color', label: 'Primary', desc: 'Cover backgrounds, page headers, main fills' },
  { key: 'secondary_color', label: 'Secondary', desc: 'Accent bars, section numbers, key highlights' },
  { key: 'accent_color', label: 'Accent', desc: 'Corner blocks, subtitles, footer lines, dividers' },
]

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editBrand, setEditBrand] = useState<Brand | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [removingBg, setRemovingBg] = useState(false)
  const [form, setForm] = useState({
    name:'', industry:'Finance & Investment', tagline:'', legal_name:'',
    primary_color:'#0A0A0A', secondary_color:'#F5C842', accent_color:'#FFFFFF',
    font_heading:'Helvetica', font_body:'Georgia', tone:'Formal & Authoritative',
    logo_url:'', logo_transparent_url:''
  })
  const logoRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(()=>{ fetchBrands() },[])

  async function fetchBrands() {
    setLoading(true)
    const {data} = await supabase.from('brands').select('*').order('created_at',{ascending:false})
    setBrands(data||[]); setLoading(false)
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setUploadingLogo(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `logos/${Date.now()}.${ext}`
      const {error} = await supabase.storage.from('logos').upload(path, file)
      if (error) throw error
      const {data:{publicUrl}} = supabase.storage.from('logos').getPublicUrl(path)
      setForm(f=>({...f, logo_url:publicUrl}))
    } catch(e){ console.error(e) } finally { setUploadingLogo(false) }
  }

  async function handleRemoveBg() {
    if (!form.logo_url) return
    setRemovingBg(true)
    try {
      const res = await fetch(form.logo_url)
      const blob = await res.blob()
      const file = new File([blob],'logo.png',{type:blob.type})
      const fd = new FormData(); fd.append('file',file)
      const r = await fetch('/api/remove-bg',{method:'POST',body:fd})
      if (!r.ok) throw new Error('Remove BG failed')
      const rb = await r.blob()
      const path = `logos/transparent_${Date.now()}.png`
      const {error} = await supabase.storage.from('logos').upload(path,rb)
      if (error) throw error
      const {data:{publicUrl}} = supabase.storage.from('logos').getPublicUrl(path)
      setForm(f=>({...f, logo_transparent_url:publicUrl}))
    } catch(e){ console.error(e) } finally { setRemovingBg(false) }
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const {data:{user}} = await supabase.auth.getUser()
      const payload = { name:form.name, industry:form.industry, tagline:form.tagline, legal_name:form.legal_name, primary_color:form.primary_color, secondary_color:form.secondary_color, accent_color:form.accent_color, font_heading:form.font_heading, font_body:form.font_body, tone:form.tone, logo_url:form.logo_url||null, logo_transparent_url:form.logo_transparent_url||null, created_by:user?.id }
      if (editBrand) { await supabase.from('brands').update(payload).eq('id',editBrand.id).eq('created_by',user?.id) }
      else { await supabase.from('brands').insert(payload) }
      await fetchBrands(); setShowForm(false); setEditBrand(null); resetForm()
    } finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this brand profile?')) return
    await supabase.from('brands').delete().eq('id',id); await fetchBrands()
  }

  function resetForm() {
    setForm({name:'',industry:'Finance & Investment',tagline:'',legal_name:'',
      primary_color:'#0A0A0A',secondary_color:'#F5C842',accent_color:'#FFFFFF',
      font_heading:'Helvetica',font_body:'Georgia',tone:'Formal & Authoritative',
      logo_url:'',logo_transparent_url:''})
  }

  function openEdit(b: Brand) {
    setEditBrand(b)
    setForm({name:b.name,industry:b.industry,tagline:b.tagline,legal_name:b.legal_name,
      primary_color:b.primary_color,secondary_color:b.secondary_color,accent_color:b.accent_color,
      font_heading:b.font_heading,font_body:b.font_body,tone:b.tone,
      logo_url:b.logo_url||'',logo_transparent_url:b.logo_transparent_url||''})
    setShowForm(true)
  }

  return (
    <div className="flex flex-col flex-1">
      <div className="bg-white border-b border-gray-200 flex items-center justify-between px-7 py-4">
        <div>
          <div className="text-xs text-gray-400 tracking-widest uppercase">Brand Profiles</div>
          <div className="font-bebas text-2xl text-aurum-black tracking-wide">Company Identities</div>
        </div>
        <button onClick={()=>{resetForm();setEditBrand(null);setShowForm(true)}}
          className="bg-aurum-black text-white px-5 py-2 text-xs font-medium tracking-wide hover:bg-aurum-yellow hover:text-aurum-black transition-colors">
          + New brand
        </button>
      </div>

      <div className="p-7 flex-1">
        {loading ? (
          <div className="text-sm text-gray-400">Loading...</div>
        ) : brands.length === 0 && !showForm ? (
          <div className="bg-white border border-gray-200 p-16 text-center">
            <div className="font-bebas text-5xl text-gray-100 tracking-widest mb-3">NO BRANDS YET</div>
            <div className="text-sm text-gray-400 mb-6 max-w-sm mx-auto">Create your first brand profile. Every document you generate will automatically follow its identity.</div>
            <button onClick={()=>setShowForm(true)} className="bg-aurum-black text-white px-6 py-3 text-xs font-medium hover:bg-aurum-yellow hover:text-aurum-black transition-colors">
              + Create first brand
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-5">
            {brands.map(b=>(
              <div key={b.id} className="bg-white border border-gray-200 overflow-hidden">
                {/* 3-color bar */}
                <div className="h-2 flex">
                  <div className="flex-1" style={{background:b.primary_color}} title="Primary"/>
                  <div className="flex-1" style={{background:b.secondary_color}} title="Secondary"/>
                  <div className="flex-1 border-l border-r border-gray-100" style={{background:b.accent_color}} title="Accent"/>
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-bebas text-xl text-aurum-black tracking-wide">{b.name}</div>
                      <div className="text-xs text-gray-400">{b.industry}</div>
                    </div>
                    {b.logo_transparent_url||b.logo_url ? (
                      <img src={b.logo_transparent_url||b.logo_url||''} alt={b.name} className="h-10 w-auto object-contain"/>
                    ) : (
                      <div className="w-10 h-10 flex items-center justify-center text-xs font-bold" style={{background:b.primary_color,color:b.secondary_color}}>
                        {b.name.substring(0,2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  {b.tagline && <div className="text-xs text-gray-500 italic mb-3">"{b.tagline}"</div>}
                  <div className="flex gap-3 mb-3">
                    {[{c:b.primary_color,l:'Primary'},{c:b.secondary_color,l:'Secondary'},{c:b.accent_color,l:'Accent'}].map(({c,l})=>(
                      <div key={l} className="flex flex-col items-center gap-1">
                        <div className="w-6 h-6 border border-gray-200" style={{background:c}}/>
                        <span className="text-xs text-gray-400 font-mono" style={{fontSize:'9px'}}>{c}</span>
                        <span className="text-gray-300" style={{fontSize:'8px'}}>{l}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-gray-400 mb-4">
                    <span className="text-gray-600 font-medium">Tone:</span> {b.tone}
                  </div>
                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <button onClick={()=>openEdit(b)} className="flex-1 border border-gray-200 py-2 text-xs font-medium text-gray-500 hover:border-aurum-black hover:text-aurum-black transition-colors">Edit</button>
                    <a href={`/dashboard/pdf?brand=${b.id}`} className="flex-1 bg-aurum-black text-white py-2 text-xs font-medium text-center hover:bg-aurum-yellow hover:text-aurum-black transition-colors">PDF</a>
                    <a href={`/dashboard/pitch-deck?brand=${b.id}`} className="flex-1 border border-aurum-yellow bg-yellow-50 text-yellow-800 py-2 text-xs font-medium text-center hover:bg-aurum-yellow hover:text-aurum-black transition-colors">Deck</a>
                    <button onClick={()=>handleDelete(b.id)} className="border border-gray-200 px-3 py-2 text-xs text-red-400 hover:border-red-300 transition-colors">âœ•</button>
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
              <div className="font-bebas text-aurum-yellow tracking-widest text-lg">{editBrand?'Edit Brand Profile':'New Brand Profile'}</div>
              <button onClick={()=>{setShowForm(false);setEditBrand(null)}} className="text-gray-400 hover:text-white text-xl leading-none">âœ•</button>
            </div>

            <div className="p-6 space-y-6">
              {/* Company info */}
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-widest mb-3 pb-2 border-b border-gray-100 font-semibold">Company Information</div>
                <div className="grid grid-cols-2 gap-4">
                  {[{label:'Brand Name *',key:'name',ph:'e.g. Sagewood Capital'},{label:'Legal Name',key:'legal_name',ph:'e.g. Sagewood Capital LLC'},{label:'Tagline',key:'tagline',ph:'e.g. Building Tomorrow\'s Assets'}].map(f=>(
                    <div key={f.key} className={f.key==='tagline'?'col-span-2':''}>
                      <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">{f.label}</label>
                      <input value={form[f.key as keyof typeof form] as string} onChange={e=>setForm(prev=>({...prev,[f.key]:e.target.value}))}
                        className="w-full border border-gray-200 px-3 py-2 text-sm outline-none focus:border-aurum-black" placeholder={f.ph}/>
                    </div>
                  ))}
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Industry</label>
                    <select value={form.industry} onChange={e=>setForm(f=>({...f,industry:e.target.value}))}
                      className="w-full border border-gray-200 px-3 py-2 text-sm outline-none focus:border-aurum-black bg-white">
                      {industries.map(o=><option key={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Logo */}
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-widest mb-3 pb-2 border-b border-gray-100 font-semibold">Logo</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Original Logo</label>
                    <div onClick={()=>logoRef.current?.click()} className="border-2 border-dashed border-gray-200 p-5 text-center cursor-pointer hover:border-aurum-black transition-colors min-h-[80px] flex items-center justify-center">
                      {form.logo_url ? <img src={form.logo_url} alt="logo" className="h-14 object-contain"/> : <div className="text-xs text-gray-400">{uploadingLogo?'Uploading...':'Click to upload'}</div>}
                    </div>
                    <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload}/>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Transparent Logo</label>
                    <div className="border-2 border-dashed border-gray-200 p-5 min-h-[80px] flex items-center justify-center"
                      style={{background:'repeating-conic-gradient(#E8E8E8 0% 25%, #F8F8F8 0% 50%) 0 0 / 12px 12px'}}>
                      {form.logo_transparent_url ? <img src={form.logo_transparent_url} alt="transparent" className="h-14 object-contain"/> : <div className="text-xs text-gray-400">Auto-generated</div>}
                    </div>
                    {form.logo_url && !form.logo_transparent_url && (
                      <button onClick={handleRemoveBg} disabled={removingBg}
                        className="w-full mt-2 border border-aurum-yellow bg-yellow-50 text-yellow-800 py-2 text-xs font-medium hover:bg-aurum-yellow hover:text-aurum-black transition-colors disabled:opacity-50">
                        {removingBg?'Removing background...':'âœ¦ Remove background'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Colors â€” 3 only, with hints */}
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-widest mb-1 pb-2 border-b border-gray-100 font-semibold">Brand Colors</div>
                <div className="text-xs text-gray-400 mb-3">You define 3 colors. AU decides placement â€” covers, headers, accents, footers.</div>
                <div className="grid grid-cols-3 gap-4">
                  {COLOR_HINTS.map(({key,label,desc})=>(
                    <div key={key}>
                      <label className="text-xs font-semibold text-aurum-black block mb-0.5">{label}</label>
                      <div className="text-xs text-gray-400 mb-2" style={{fontSize:'10px'}}>{desc}</div>
                      <div className="flex gap-2 items-center">
                        <input type="color" value={form[key as keyof typeof form] as string}
                          onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}
                          className="w-10 h-9 border border-gray-200 cursor-pointer p-0.5 flex-shrink-0"/>
                        <input value={form[key as keyof typeof form] as string}
                          onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}
                          className="flex-1 border border-gray-200 px-2 py-2 text-xs font-mono outline-none focus:border-aurum-black"/>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Live preview bar */}
                <div className="mt-4">
                  <div className="text-xs text-gray-400 mb-1">Preview</div>
                  <div className="h-8 flex">
                    <div className="flex-1 flex items-center justify-center text-xs font-bold" style={{background:form.primary_color, color:form.secondary_color}}>
                      PRIMARY
                    </div>
                    <div className="flex-1 flex items-center justify-center text-xs font-bold" style={{background:form.secondary_color, color:form.primary_color}}>
                      SECONDARY
                    </div>
                    <div className="flex-1 flex items-center justify-center text-xs font-bold border border-gray-200" style={{background:form.accent_color, color:form.primary_color}}>
                      ACCENT
                    </div>
                  </div>
                </div>
              </div>

              {/* Typography & Tone */}
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-widest mb-3 pb-2 border-b border-gray-100 font-semibold">Typography & Voice</div>
                <div className="grid grid-cols-3 gap-4">
                  {[{label:'Heading Font',key:'font_heading',opts:fonts},{label:'Body Font',key:'font_body',opts:fonts},{label:'Tone of Voice',key:'tone',opts:tones}].map(f=>(
                    <div key={f.key}>
                      <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">{f.label}</label>
                      <select value={form[f.key as keyof typeof form] as string} onChange={e=>setForm(prev=>({...prev,[f.key]:e.target.value}))}
                        className="w-full border border-gray-200 px-3 py-2 text-sm outline-none focus:border-aurum-black bg-white">
                        {f.opts.map(o=><option key={o}>{o}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={()=>{setShowForm(false);setEditBrand(null)}} className="flex-1 border border-gray-200 py-3 text-sm text-gray-500 hover:border-gray-400 transition-colors">Cancel</button>
                <button onClick={handleSave} disabled={saving||!form.name.trim()}
                  className="flex-1 bg-aurum-black text-white py-3 text-sm font-medium hover:bg-aurum-yellow hover:text-aurum-black transition-colors disabled:opacity-50">
                  {saving?'Saving...':(editBrand?'Save changes':'Create brand profile')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


