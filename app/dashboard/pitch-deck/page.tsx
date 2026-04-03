'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'

interface Brand {
  id: string; name: string; industry: string; tagline: string; legal_name: string
  primary_color: string; secondary_color: string; accent_color: string
  font_heading: string; font_body: string; tone: string
  logo_url: string | null; logo_transparent_url: string | null
}

interface Message { role: 'user' | 'au'; content: string; type?: 'text' | 'deck-ready' | 'thinking' }

interface Slide {
  type: 'cover' | 'agenda' | 'content' | 'data' | 'quote' | 'closing'
  title: string
  subtitle?: string
  body?: string
  points?: string[]
  quote?: string
  author?: string
  note?: string
}

interface DeckSpec {
  title: string
  subtitle: string
  slides: Slide[]
  metadata: { company: string; legal_name: string; date: string; presenter: string; confidential: boolean }
}

function hex(h: string) {
  const c = h.replace('#','')
  return { r: parseInt(c.slice(0,2),16)||0, g: parseInt(c.slice(2,4),16)||0, b: parseInt(c.slice(4,6),16)||0 }
}

function PitchDeckInner() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [brand, setBrand] = useState<Brand | null>(null)
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal')
  const [messages, setMessages] = useState<Message[]>([{ role:'au', content:'Select a brand profile and orientation to begin building your pitch deck.', type:'text' }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [deckSpec, setDeckSpec] = useState<DeckSpec | null>(null)
  const [generating, setGenerating] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => { supabase.from('brands').select('*').order('name').then(({data})=>setBrands(data||[])) }, [])
  useEffect(() => { bottomRef.current?.scrollIntoView({behavior:'smooth'}) }, [messages])

  function selectBrand(b: Brand) {
    setBrand(b); setDeckSpec(null)
    setMessages([{ role:'au', type:'text',
      content:`Brand loaded: **${b.name}**\n\nReady to build your pitch deck — ${orientation === 'horizontal' ? '16:9 landscape' : 'A4 portrait'} format.\n\nTell me what the deck is for:\n\n• "Investor pitch for Series A fundraise"\n• "Client proposal for asset management services"\n• "Board presentation — Q1 2026 results"\n• Or describe your audience, goal, and key messages`
    }])
  }

  async function send() {
    if (!input.trim() || loading) return
    if (!brand) { setMessages(prev=>[...prev,{role:'au',content:'Please select a brand profile first.',type:'text'}]); return }
    const msg = input.trim(); setInput('')
    setMessages(prev=>[...prev,{role:'user',content:msg,type:'text'},{role:'au',content:'',type:'thinking'}])
    setLoading(true)

    try {
      const today = new Date().toLocaleDateString('en-US',{month:'long',year:'numeric'})
      const sys = `You are AU, an elite pitch deck strategist for AU Studio. You create world-class investor and client presentations — think Sequoia pitch decks, Goldman Sachs client presentations, McKinsey board decks.

BRAND: ${brand.name} (${brand.legal_name||brand.name}) · ${brand.industry}
COLORS: Primary ${brand.primary_color} · Secondary ${brand.secondary_color} · Accent ${brand.accent_color}
TONE: ${brand.tone} · DATE: ${today}
FORMAT: ${orientation === 'horizontal' ? '16:9 Landscape (widescreen)' : 'A4 Portrait (vertical)'}

SLIDE TYPES available: cover, agenda, content, data, quote, closing

WHEN READY produce commentary then:

<DECK_SPEC>
{
  "title": "Deck Title",
  "subtitle": "Subtitle or event name",
  "slides": [
    { "type": "cover", "title": "Company Name", "subtitle": "Tagline or event", "note": "Opening context" },
    { "type": "agenda", "title": "Today's Agenda", "points": ["Topic 1","Topic 2","Topic 3","Topic 4"] },
    { "type": "content", "title": "Section Title", "body": "2-3 sentences of key message", "points": ["Key point 1","Key point 2","Key point 3"] },
    { "type": "data", "title": "Performance / Numbers", "body": "Context sentence", "points": ["Metric: Value and context","Metric: Value and context","Metric: Value and context"] },
    { "type": "quote", "title": "Vision", "quote": "Powerful statement about vision or strategy", "author": "— Name, Title" },
    { "type": "closing", "title": "Next Steps", "points": ["Action 1","Action 2","Action 3"], "note": "Contact or CTA" }
  ],
  "metadata": { "company": "${brand.name}", "legal_name": "${brand.legal_name||brand.name}", "date": "${today}", "presenter": "AU Studio", "confidential": true }
}
</DECK_SPEC>

Build 8-14 slides. Each content slide must have a clear, punchy title and substantive content. Use ${brand.tone} voice. Every point must be sharp and meaningful — no filler.`

      const history = messages.filter(m=>m.type!=='thinking').map(m=>({role:m.role==='au'?'assistant':'user',content:m.content}))
      history.push({role:'user',content:msg})

      const res = await fetch('/api/analyze-brief',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({briefing:msg,type:'pitch-deck',systemPrompt:sys,history})})
      const data = await res.json()
      setMessages(prev=>prev.filter(m=>m.type!=='thinking'))

      if (data.rawResponse) {
        const raw = data.rawResponse
        const m = raw.match(/<DECK_SPEC>([\s\S]*?)<\/DECK_SPEC>/)
        if (m) {
          try {
            const spec = JSON.parse(m[1].trim()); setDeckSpec(spec)
            const before = raw.replace(/<DECK_SPEC>[\s\S]*?<\/DECK_SPEC>/,'').trim()
            setMessages(prev=>[...prev,
              {role:'au',content:before||'Deck ready. Review the slides and download.',type:'text'},
              {role:'au',content:`Deck ready: ${spec.title} — ${spec.slides.length} slides`,type:'deck-ready'}
            ])
          } catch { setMessages(prev=>[...prev,{role:'au',content:raw,type:'text'}]) }
        } else { setMessages(prev=>[...prev,{role:'au',content:raw,type:'text'}]) }
      }
    } catch {
      setMessages(prev=>[...prev.filter(m=>m.type!=='thinking'),{role:'au',content:'Connection error. Please try again.',type:'text'}])
    } finally { setLoading(false) }
  }

  async function generatePDF() {
    if (!deckSpec || !brand) return
    setGenerating(true)
    try {
      const { jsPDF } = await import('jspdf')
      const isH = orientation === 'horizontal'
      const W = isH ? 297 : 210
      const H = isH ? 210 : 297
      const doc = new jsPDF({ orientation: isH ? 'landscape' : 'portrait', unit:'mm', format:'a4' })
      const M = isH ? 20 : 18
      const CW = W - M*2
      const P = hex(brand.primary_color)
      const S = hex(brand.secondary_color)
      const A = hex(brand.accent_color)

      // Logo helper
      let logoDataUrl = ''
      const logoUrl = brand.logo_transparent_url || brand.logo_url
      if (logoUrl) {
        try {
          const img = new Image(); img.crossOrigin='anonymous'
          await new Promise<void>(r=>{img.onload=()=>r();img.onerror=()=>r();img.src=logoUrl})
          if (img.naturalWidth>0) {
            const cv=document.createElement('canvas');cv.width=img.naturalWidth;cv.height=img.naturalHeight
            cv.getContext('2d')!.drawImage(img,0,0); logoDataUrl=cv.toDataURL('image/png')
          }
        } catch {}
      }

      const addLogo = (x: number, y: number, maxW: number, maxH: number) => {
        if (!logoDataUrl) return
        try {
          const img = new Image(); img.src=logoDataUrl
          const ratio = Math.min(maxW/img.naturalWidth, maxH/img.naturalHeight)
          const lw=img.naturalWidth*ratio, lh=img.naturalHeight*ratio
          doc.addImage(logoDataUrl,'PNG',x,y,lw,lh)
        } catch {}
      }

      const slideHeader = (company: string) => {
        doc.setFillColor(P.r,P.g,P.b); doc.rect(0,0,W,10,'F')
        doc.setFillColor(S.r,S.g,S.b); doc.rect(0,0,4,10,'F')
        doc.setTextColor(S.r,S.g,S.b); doc.setFontSize(6.5); doc.setFont('helvetica','bold')
        doc.text(company.toUpperCase(), 8, 7)
        doc.setTextColor(100,100,100)
        doc.text(deckSpec!.metadata.date, W-M, 7, {align:'right'})
      }

      const slideFooter = (num: number) => {
        doc.setFillColor(A.r,A.g,A.b); doc.rect(0,H-8,W,1,'F')
        doc.setFillColor(P.r,P.g,P.b); doc.rect(0,H-7,W,7,'F')
        doc.setTextColor(100,100,100); doc.setFontSize(6.5)
        doc.text(deckSpec!.metadata.confidential?'CONFIDENTIAL':'INTERNAL', M, H-3)
        doc.text(String(num), W-M, H-3, {align:'right'})
      }

      deckSpec.slides.forEach((slide, idx) => {
        if (idx > 0) doc.addPage()

        if (slide.type === 'cover') {
          // Full primary cover
          doc.setFillColor(P.r,P.g,P.b); doc.rect(0,0,W,H,'F')
          // Secondary left bar
          doc.setFillColor(S.r,S.g,S.b); doc.rect(0,0,6,H,'F')
          // Accent top-right corner
          doc.setFillColor(A.r,A.g,A.b); doc.rect(W-50,0,50,7,'F')

          // Logo top right
          addLogo(W-M-45, 12, 40, 16)

          // Company name
          doc.setTextColor(S.r,S.g,S.b); doc.setFontSize(10); doc.setFont('helvetica','bold')
          doc.text(brand.name.toUpperCase(), M, isH?50:60)
          doc.setFillColor(S.r,S.g,S.b); doc.rect(M, isH?53:63, 30, 0.8, 'F')

          // Main title
          doc.setTextColor(255,255,255); doc.setFontSize(isH?26:22); doc.setFont('helvetica','bold')
          const tLines = doc.splitTextToSize(slide.title.toUpperCase(), CW-20)
          let ty = isH ? 66 : 78
          tLines.forEach((l:string)=>{ doc.text(l,M,ty); ty+=(isH?9:8) })

          // Subtitle
          if (slide.subtitle) {
            doc.setFontSize(isH?13:11); doc.setFont('helvetica','normal')
            doc.setTextColor(A.r,A.g,A.b)
            doc.text(doc.splitTextToSize(slide.subtitle, CW-20), M, ty+5)
          }

          // Bottom bar
          doc.setFillColor(10,10,10); doc.rect(0,H-22,W,22,'F')
          doc.setFillColor(S.r,S.g,S.b); doc.rect(0,H-22,W,0.8,'F')
          doc.setTextColor(100,100,100); doc.setFontSize(7); doc.setFont('helvetica','normal')
          doc.text(deckSpec.metadata.date, M, H-13)
          doc.text(deckSpec.metadata.confidential?'CONFIDENTIAL':'INTERNAL', W-M, H-13, {align:'right'})
          doc.setTextColor(180,180,180); doc.setFontSize(8); doc.setFont('helvetica','bold')
          doc.text(deckSpec.metadata.legal_name||brand.name, M, H-5)

        } else if (slide.type === 'agenda') {
          slideHeader(brand.name)
          let y = 24
          doc.setTextColor(P.r,P.g,P.b); doc.setFontSize(isH?18:16); doc.setFont('helvetica','bold')
          doc.text(slide.title.toUpperCase(), M, y)
          doc.setFillColor(S.r,S.g,S.b); doc.rect(M, y+3, 20, 0.8, 'F')
          y += 16
          slide.points?.forEach((pt,i)=>{
            doc.setFillColor(i%2===0?A.r:S.r, i%2===0?A.g:S.g, i%2===0?A.b:S.b)
            doc.rect(M, y-4, 6, 6, 'F')
            doc.setTextColor(P.r,P.g,P.b); doc.setFontSize(7); doc.setFont('helvetica','bold')
            doc.text(String(i+1).padStart(2,'0'), M+1, y)
            doc.setTextColor(30,30,30); doc.setFontSize(isH?12:10); doc.setFont('helvetica','normal')
            doc.text(pt, M+10, y)
            y += (isH?14:12)
          })
          slideFooter(idx+1)

        } else if (slide.type === 'quote') {
          doc.setFillColor(P.r,P.g,P.b); doc.rect(0,0,W,H,'F')
          doc.setFillColor(S.r,S.g,S.b); doc.rect(0,0,4,H,'F')
          const qy = H/2 - 20
          doc.setFillColor(S.r,S.g,S.b); doc.rect(M,qy-12,3,isH?40:50,'F')
          doc.setTextColor(255,255,255); doc.setFontSize(isH?16:13); doc.setFont('helvetica','bold')
          const qLines = doc.splitTextToSize(`"${slide.quote}"`, CW-10)
          let qly = qy
          qLines.forEach((l:string)=>{ doc.text(l, M+8, qly); qly+=(isH?8:7) })
          if (slide.author) {
            doc.setTextColor(A.r,A.g,A.b); doc.setFontSize(10); doc.setFont('helvetica','normal')
            doc.text(slide.author, M+8, qly+8)
          }
          slideFooter(idx+1)

        } else if (slide.type === 'closing') {
          doc.setFillColor(P.r,P.g,P.b); doc.rect(0,0,W,H,'F')
          doc.setFillColor(S.r,S.g,S.b); doc.rect(0,0,6,H,'F')
          doc.setFillColor(A.r,A.g,A.b); doc.rect(W-60,0,60,7,'F')
          addLogo(W-M-44, 14, 38, 14)
          let y = isH?50:65
          doc.setTextColor(S.r,S.g,S.b); doc.setFontSize(isH?22:18); doc.setFont('helvetica','bold')
          doc.text(slide.title.toUpperCase(), M, y); y+=(isH?14:12)
          slide.points?.forEach(pt=>{
            doc.setFillColor(S.r,S.g,S.b); doc.rect(M, y-3, 3, 3, 'F')
            doc.setTextColor(255,255,255); doc.setFontSize(isH?11:10); doc.setFont('helvetica','normal')
            doc.text(pt, M+7, y); y+=(isH?10:9)
          })
          if (slide.note) {
            doc.setFillColor(S.r,S.g,S.b); doc.rect(M, y+8, CW-20, 0.6, 'F')
            doc.setTextColor(A.r,A.g,A.b); doc.setFontSize(10); doc.setFont('helvetica','bold')
            doc.text(slide.note, M, y+18)
          }
          slideFooter(idx+1)

        } else {
          // content or data
          slideHeader(brand.name)
          let y = isH ? 24 : 22

          // Title
          doc.setFillColor(S.r,S.g,S.b); doc.rect(M, y-5, 8, 8, 'F')
          doc.setTextColor(P.r,P.g,P.b); doc.setFontSize(8); doc.setFont('helvetica','bold')
          doc.text(String(idx+1).padStart(2,'0'), M+1, y)
          doc.setTextColor(P.r,P.g,P.b); doc.setFontSize(isH?16:14); doc.setFont('helvetica','bold')
          doc.text(slide.title.toUpperCase(), M+12, y)
          doc.setFillColor(A.r,A.g,A.b); doc.rect(M, y+3, CW, 0.6, 'F')
          y += 12

          // Body
          if (slide.body) {
            doc.setFontSize(isH?10:9); doc.setFont('helvetica','normal'); doc.setTextColor(60,60,60)
            const bLines = doc.splitTextToSize(slide.body, CW)
            bLines.forEach((l:string)=>{ doc.text(l,M,y); y+=(isH?5.5:5) })
            y += 4
          }

          // Points
          slide.points?.forEach((pt,i)=>{
            // Alternating accent
            if (i%2===0) { doc.setFillColor(248,248,248); doc.rect(M-2,y-4,CW+4,isH?9:8,'F') }
            doc.setFillColor(i%2===0?S.r:A.r, i%2===0?S.g:A.g, i%2===0?S.b:A.b)
            doc.rect(M, y-3, 2.5, 2.5, 'F')
            doc.setFontSize(isH?10:9); doc.setFont('helvetica','normal'); doc.setTextColor(25,25,25)
            const ptLines = doc.splitTextToSize(pt, CW-8)
            ptLines.forEach((l:string,li:number)=>{ doc.text(l, M+6, y+(li*(isH?5:4.5))); })
            y += isH?(ptLines.length*5+4):(ptLines.length*4.5+4)
          })
          slideFooter(idx+1)
        }
      })

      doc.save(`${deckSpec.title.replace(/\s+/g,'_')}_${brand.name}_Deck.pdf`)
      setMessages(prev=>[...prev,{role:'au',content:`✓ **${deckSpec.title}** downloaded — ${deckSpec.slides.length} slides, ${orientation} format. Want to revise any slide or add more content?`,type:'text'}])
    } catch(err) {
      console.error(err)
      setMessages(prev=>[...prev,{role:'au',content:'PDF generation error. Please try again.',type:'text'}])
    } finally { setGenerating(false) }
  }

  function fmt(t:string) {
    return t.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br/>')
  }

  return (
    <div className="flex flex-col flex-1" style={{height:'100vh'}}>
      {/* Topbar */}
      <div className="bg-white border-b border-gray-200 flex items-center justify-between px-7 py-4 flex-shrink-0">
        <div>
          <div className="text-xs text-gray-400 tracking-widest uppercase">Creation</div>
          <div className="font-bebas text-2xl text-aurum-black tracking-wide">Pitch Deck</div>
        </div>
        <div className="flex items-center gap-3">
          {/* Brand selector */}
          <select onChange={e=>{const b=brands.find(x=>x.id===e.target.value);if(b)selectBrand(b)}}
            className="border border-gray-200 px-3 py-2 text-xs text-aurum-black outline-none focus:border-aurum-black bg-white"
            value={brand?.id||''}>
            <option value="">Select brand...</option>
            {brands.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
          </select>

          {/* Orientation picker */}
          <div className="flex border border-gray-200">
            <button
              onClick={()=>setOrientation('horizontal')}
              className={`px-3 py-2 text-xs font-medium flex items-center gap-1.5 transition-colors ${orientation==='horizontal'?'bg-aurum-black text-white':'text-gray-400 hover:text-aurum-black'}`}>
              <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
                <rect x="0.5" y="0.5" width="15" height="10" rx="1" stroke="currentColor"/>
              </svg>
              Horizontal
            </button>
            <button
              onClick={()=>setOrientation('vertical')}
              className={`px-3 py-2 text-xs font-medium flex items-center gap-1.5 transition-colors border-l border-gray-200 ${orientation==='vertical'?'bg-aurum-black text-white':'text-gray-400 hover:text-aurum-black'}`}>
              <svg width="11" height="15" viewBox="0 0 11 15" fill="none">
                <rect x="0.5" y="0.5" width="10" height="14" rx="1" stroke="currentColor"/>
              </svg>
              Vertical
            </button>
          </div>

          {brand && (
            <div className="flex items-center gap-1">
              <div className="w-3 h-3" style={{background:brand.primary_color}} title="Primary"/>
              <div className="w-3 h-3" style={{background:brand.secondary_color}} title="Secondary"/>
              <div className="w-3 h-3 border border-gray-200" style={{background:brand.accent_color}} title="Accent"/>
            </div>
          )}

          {deckSpec && (
            <button onClick={generatePDF} disabled={generating}
              className="bg-aurum-black text-white px-5 py-2 text-xs font-medium hover:bg-aurum-yellow hover:text-aurum-black transition-colors disabled:opacity-50">
              {generating?'Generating...':'↓ Download PDF'}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Chat */}
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5 bg-aurum-surface">
            {messages.map((msg,i)=>(
              <div key={i} className={`flex gap-3 ${msg.role==='user'?'flex-row-reverse':''}`}>
                <div className={`w-8 h-8 flex-shrink-0 flex items-center justify-center text-xs font-bold ${msg.role==='au'?'bg-aurum-black text-aurum-yellow':'bg-aurum-yellow text-aurum-black'}`}>
                  {msg.role==='au'?'AU':'ME'}
                </div>
                {msg.type==='thinking'?(
                  <div className="bg-white border border-gray-200 px-4 py-3">
                    <div className="flex gap-1 items-center">
                      {[0,150,300].map(d=><div key={d} className="w-1.5 h-1.5 bg-aurum-yellow rounded-full animate-bounce" style={{animationDelay:`${d}ms`}}/>)}
                      <span className="text-xs text-gray-400 ml-2">AU is building your deck...</span>
                    </div>
                  </div>
                ):msg.type==='deck-ready'?(
                  <div className="bg-aurum-black text-white px-4 py-3 flex items-center gap-3">
                    <div className="flex-shrink-0">
                      <div className={`border-2 flex items-center justify-center text-xs font-bold ${orientation==='horizontal'?'w-12 h-8':'w-8 h-12'}`} style={{borderColor:brand?.secondary_color,color:brand?.secondary_color}}>
                        {orientation==='horizontal'?'16:9':'A4'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 uppercase tracking-wide">Deck ready</div>
                      <div className="text-sm font-medium text-aurum-yellow">{deckSpec?.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{deckSpec?.slides.length} slides · {orientation} · {deckSpec?.metadata.date}</div>
                    </div>
                    <button onClick={generatePDF} disabled={generating}
                      className="ml-auto bg-aurum-yellow text-aurum-black px-3 py-1.5 text-xs font-bold hover:opacity-90 disabled:opacity-50">
                      {generating?'...':'↓ PDF'}
                    </button>
                  </div>
                ):(
                  <div className={`px-4 py-3 max-w-2xl text-sm leading-relaxed ${msg.role==='au'?'bg-white border border-gray-200 text-gray-700':'bg-aurum-black text-white'}`}
                    dangerouslySetInnerHTML={{__html:fmt(msg.content)}}/>
                )}
              </div>
            ))}
            <div ref={bottomRef}/>
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 bg-white px-6 py-4 flex-shrink-0">
            <div className="flex gap-3 items-end">
              <textarea value={input} onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}}
                placeholder="Describe your pitch deck — audience, purpose, key messages..."
                rows={2} className="flex-1 border border-gray-200 px-4 py-3 text-sm text-aurum-black resize-none outline-none focus:border-aurum-black placeholder-gray-300"/>
              <button onClick={send} disabled={loading||!input.trim()}
                className="bg-aurum-black text-white px-5 py-3 text-xs font-medium hover:bg-aurum-yellow hover:text-aurum-black transition-colors disabled:opacity-40 flex-shrink-0">
                Send
              </button>
            </div>
            <div className="text-xs text-gray-300 mt-2">AU builds institutional pitch decks · {orientation === 'horizontal' ? '16:9 widescreen' : 'A4 portrait'} format selected</div>
          </div>
        </div>

        {/* Slide preview panel */}
        {deckSpec && brand && (
          <div className="w-72 border-l border-gray-200 bg-white flex flex-col flex-shrink-0">
            <div className="px-5 py-4 border-b border-gray-200">
              <div className="text-xs text-gray-400 uppercase tracking-wide">Slides ({deckSpec.slides.length})</div>
              <div className="text-sm font-medium text-aurum-black mt-0.5 truncate">{deckSpec.title}</div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {deckSpec.slides.map((s,i)=>(
                <div key={i} className="flex gap-2 items-start">
                  {/* Mini slide preview */}
                  <div className={`flex-shrink-0 flex items-center justify-center text-xs font-bold border ${orientation==='horizontal'?'w-14 h-9':'w-9 h-12'}`}
                    style={{background: s.type==='cover'||s.type==='closing'||s.type==='quote' ? brand.primary_color : '#fff',
                      borderColor: brand.secondary_color,
                      color: s.type==='cover'||s.type==='closing'||s.type==='quote' ? brand.secondary_color : brand.primary_color}}>
                    {String(i+1).padStart(2,'0')}
                  </div>
                  <div>
                    <div className="text-xs font-medium text-aurum-black leading-tight">{s.title}</div>
                    <div className="text-xs text-gray-400 capitalize">{s.type}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-gray-200">
              <button onClick={generatePDF} disabled={generating}
                className="w-full bg-aurum-black text-white py-3 text-xs font-bold tracking-widest hover:bg-aurum-yellow hover:text-aurum-black transition-colors disabled:opacity-50">
                {generating?'GENERATING...':'↓ DOWNLOAD PDF'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

import { Suspense } from 'react'
export default function PitchDeckPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center text-sm text-gray-400">Loading...</div>}>
      <PitchDeckInner />
    </Suspense>
  )
}
