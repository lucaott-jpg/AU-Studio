'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

interface Brand {
  id: string; name: string; industry: string; tagline: string; legal_name: string
  primary_color: string; secondary_color: string; accent_color: string
  font_heading: string; font_body: string; tone: string
  logo_url: string | null; logo_transparent_url: string | null
}
interface Message { role: 'user' | 'au'; content: string; type?: 'text' | 'document-ready' | 'thinking' }
interface DocSpec {
  title: string; subtitle?: string
  sections: { heading: string; content: string }[]
  metadata: { company: string; legal_name: string; date: string; prepared_by: string; confidential: boolean }
}

const DOC_TYPES: Record<string, { label: string; description: string; sections: string }> = {
  report:    { label: 'Report',            description: 'Structured analytical report', sections: 'Executive Summary, Background, Analysis, Findings, Recommendations, Conclusion' },
  memo:      { label: 'Executive Memo',    description: 'Concise internal communication', sections: 'Purpose, Context, Key Points, Action Required, Next Steps' },
  teaser:    { label: 'Investment Teaser', description: 'Investment opportunity overview', sections: 'Opportunity Overview, Business Summary, Market Opportunity, Financial Highlights, Investment Thesis' },
  proposal:  { label: 'Proposal',          description: 'Formal business proposal', sections: 'Executive Summary, Background, Proposed Approach, Scope of Work, Timeline, Fees' },
  loi:       { label: 'Letter of Intent',  description: 'Formal LOI outlining preliminary terms', sections: 'Parties, Transaction Overview, Key Terms, Exclusivity, Conditions, Governing Law' },
  termsheet: { label: 'Term Sheet',        description: 'Principal terms of a transaction', sections: 'Transaction Summary, Economic Terms, Governance, Conditions, Timeline' },
  board:     { label: 'Board Presentation',description: 'Board-level presentation', sections: 'Executive Summary, Strategic Overview, Financial Performance, Key Initiatives, Risks, Decisions Required' },
}

function hex(h: string) {
  const c = h.replace('#', '')
  return { r: parseInt(c.slice(0,2),16)||0, g: parseInt(c.slice(2,4),16)||0, b: parseInt(c.slice(4,6),16)||0 }
}

function PDFStudioInner() {
  const searchParams = useSearchParams()
  const docTypeParam = searchParams.get('type') || 'report'
  const brandParam = searchParams.get('brand')
  const modeParam = searchParams.get('mode') || 'ai'
  const isPlaceMode = modeParam === 'place'

  const docType = DOC_TYPES[docTypeParam] || DOC_TYPES.report

  const [brands, setBrands] = useState<Brand[]>([])
  const [brand, setBrand] = useState<Brand | null>(null)
  const [messages, setMessages] = useState<Message[]>([{
    role: 'au', type: 'text',
    content: isPlaceMode
      ? 'Select your brand profile above, then upload your file. I will apply your brand template — colors, logo, and layout — without changing any of your content.'
      : 'Select your brand profile above to begin creating your ' + docType.label + '.'
  }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploadedText, setUploadedText] = useState('')
  const [uploadedName, setUploadedName] = useState('')
  const [docSpec, setDocSpec] = useState<DocSpec | null>(null)
  const [generating, setGenerating] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => { supabase.from('brands').select('*').order('name').then(({data}) => setBrands(data||[])) }, [])
  useEffect(() => {
    if (brands.length > 0 && brandParam) {
      const found = brands.find(b => b.id === brandParam)
      if (found) selectBrand(found)
    }
  }, [brands, brandParam])
  useEffect(() => { bottomRef.current?.scrollIntoView({behavior:'smooth'}) }, [messages])

  function selectBrand(b: Brand) {
    setBrand(b)
    setDocSpec(null)
    if (isPlaceMode) {
      setMessages([{
        role: 'au', type: 'text',
        content: 'Brand loaded: **' + b.name + '**\n\nUpload your file now. I will apply your brand identity — ' + b.primary_color + ' / ' + b.secondary_color + ' / ' + b.accent_color + ' — to the document without changing any content.'
      }])
    } else {
      setMessages([{
        role: 'au', type: 'text',
        content: 'Brand loaded: **' + b.name + '** - ' + docType.label + '\n\nIdentity active. This document will follow the ' + docType.label + ' format.\n\nTell me what this document is for, paste rough content to refine, or upload a reference file.'
      }])
    }
  }

  async function extractPdfText(file: File): Promise<string> {
    try {
      const pdfjsLib = await import('pdfjs-dist')
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      let text = ''
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        text += content.items.map((item: any) => item.str).join(' ') + '\n'
      }
      return text.substring(0, 12000)
    } catch {
      return ''
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!brand) {
      setMessages(prev => [...prev, { role: 'au', content: 'Please select a brand profile first.', type: 'text' }])
      return
    }

    setUploadedName(f.name)
    setMessages(prev => [...prev, { role: 'user', content: 'Uploaded: ' + f.name, type: 'text' }])

    let extractedText = ''

    if (f.type === 'text/plain') {
      extractedText = await f.text()
      setUploadedText(extractedText.substring(0, 12000))
    } else if (f.type === 'application/pdf') {
      setMessages(prev => [...prev, { role: 'au', content: '', type: 'thinking' }])
      extractedText = await extractPdfText(f)
      setMessages(prev => prev.filter(m => m.type !== 'thinking'))
      setUploadedText(extractedText)
    }

    if (isPlaceMode && extractedText) {
      // Auto-generate immediately in place mode
      await autoGenerate(extractedText, f.name)
    } else if (extractedText) {
      setMessages(prev => [...prev, {
        role: 'au', type: 'text',
        content: 'File **' + f.name + '** received and read. Tell me what you need — I will create your ' + docType.label + ' based on this content.'
      }])
    } else {
      setMessages(prev => [...prev, {
        role: 'au', type: 'text',
        content: 'File received. Please paste the key content as text and I will build your ' + docType.label + ' from it.'
      }])
    }
  }

  async function autoGenerate(content: string, filename: string) {
    if (!brand) return
    setLoading(true)
    setMessages(prev => [...prev, { role: 'au', content: '', type: 'thinking' }])

    const today = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    const sys = isPlaceMode
      ? 'You are AU, a document layout specialist. Your ONLY job is to take the provided content EXACTLY as-is and structure it into a professional institutional document. DO NOT rewrite, rephrase, or change any content. Only organize it into sections with proper headings. Use the exact numbers, names, and text from the source.\n\nBRAND: ' + brand.name + '\nDATE: ' + today + '\n\nWhen ready produce:\n\n<DOCUMENT_SPEC>\n{\n  "title": "Document Title",\n  "subtitle": "Optional",\n  "sections": [\n    { "heading": "Section Title", "content": "EXACT content from source, unchanged" }\n  ],\n  "metadata": { "company": "' + brand.name + '", "legal_name": "' + (brand.legal_name||brand.name) + '", "date": "' + today + '", "prepared_by": "AU Studio", "confidential": true }\n}\n</DOCUMENT_SPEC>'
      : 'You are AU, an elite institutional document strategist. Analyze the provided document and create a professional ' + docType.label + ' based on its content.\n\nBRAND: ' + brand.name + '\nTONE: ' + brand.tone + '\nDATE: ' + today + '\n\nProduce:\n\n<DOCUMENT_SPEC>\n{\n  "title": "Document Title",\n  "subtitle": "Optional",\n  "sections": [\n    { "heading": "Section Title", "content": "Full paragraphs at institutional quality" }\n  ],\n  "metadata": { "company": "' + brand.name + '", "legal_name": "' + (brand.legal_name||brand.name) + '", "date": "' + today + '", "prepared_by": "AU Studio", "confidential": true }\n}\n</DOCUMENT_SPEC>'

    try {
      const res = await fetch('/api/analyze-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          briefing: isPlaceMode
            ? 'Place this content as-is into a document with proper section headings. DO NOT change any content:\n\n' + content
            : 'Analyze this ' + docType.label + ' source document and create an institutional version:\n\n' + content,
          type: docTypeParam,
          systemPrompt: sys,
          history: []
        })
      })
      const data = await res.json()
      setMessages(prev => prev.filter(m => m.type !== 'thinking'))

      if (data.rawResponse) {
        const raw = data.rawResponse
        const m = raw.match(/<DOCUMENT_SPEC>([\s\S]*?)<\/DOCUMENT_SPEC>/)
        if (m) {
          try {
            const spec = JSON.parse(m[1].trim())
            setDocSpec(spec)
            const before = raw.replace(/<DOCUMENT_SPEC>[\s\S]*?<\/DOCUMENT_SPEC>/, '').trim()
            setMessages(prev => [...prev,
              { role: 'au', content: before || (isPlaceMode ? 'Content placed. Brand template applied. Download your PDF.' : 'Document ready. Review and download.'), type: 'text' },
              { role: 'au', content: 'Document ready: ' + spec.title, type: 'document-ready' }
            ])
          } catch {
            setMessages(prev => [...prev, { role: 'au', content: raw, type: 'text' }])
          }
        } else {
          setMessages(prev => [...prev, { role: 'au', content: raw, type: 'text' }])
        }
      }
    } catch {
      setMessages(prev => [...prev.filter(m => m.type !== 'thinking'), { role: 'au', content: 'Connection error. Please try again.', type: 'text' }])
    } finally {
      setLoading(false)
    }
  }

  async function send() {
    if (!input.trim() || loading) return
    if (!brand) {
      setMessages(prev => [...prev, { role: 'au', content: 'Please select a brand profile first.', type: 'text' }])
      return
    }
    const msg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg, type: 'text' }, { role: 'au', content: '', type: 'thinking' }])
    setLoading(true)

    try {
      const today = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      const sys = isPlaceMode
        ? 'You are AU, a document layout specialist for AU Studio. Your ONLY role is cosmetic — adjust layout, section order, or styling. NEVER rewrite content. If asked to change content, decline politely.\n\nBRAND: ' + brand.name + ' | COLORS: ' + brand.primary_color + ' / ' + brand.secondary_color + ' / ' + brand.accent_color
        : 'You are AU, an elite institutional document strategist for AU Studio at BlackRock / McKinsey / Goldman level.\n\nBRAND: ' + brand.name + ' (' + (brand.legal_name||brand.name) + ') - ' + brand.industry + '\nCOLORS: ' + brand.primary_color + ' / ' + brand.secondary_color + ' / ' + brand.accent_color + '\nFONTS: ' + brand.font_heading + ' / ' + brand.font_body + '\nTONE: ' + brand.tone + '\nDATE: ' + today + '\n\nWHEN READY produce commentary then:\n\n<DOCUMENT_SPEC>\n{\n  "title": "Title",\n  "subtitle": "Optional",\n  "sections": [\n    { "heading": "Section", "content": "2-4 full paragraphs, no bullets, institutional quality" }\n  ],\n  "metadata": { "company": "' + brand.name + '", "legal_name": "' + (brand.legal_name||brand.name) + '", "date": "' + today + '", "prepared_by": "AU Studio", "confidential": true }\n}\n</DOCUMENT_SPEC>\n\nInclude 5-8 sections. No filler. Write as a senior partner.'

      const history = messages
        .filter(m => m.type !== 'thinking')
        .map(m => ({ role: m.role === 'au' ? 'assistant' : 'user', content: m.content }))

      const fullMsg = uploadedText ? msg + '\n\n[REFERENCE]:\n' + uploadedText.substring(0, 8000) : msg
      history.push({ role: 'user', content: fullMsg })

      const res = await fetch('/api/analyze-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefing: msg, type: docTypeParam, systemPrompt: sys, history })
      })
      const data = await res.json()
      setMessages(prev => prev.filter(m => m.type !== 'thinking'))

      if (data.rawResponse) {
        const raw = data.rawResponse
        const m = raw.match(/<DOCUMENT_SPEC>([\s\S]*?)<\/DOCUMENT_SPEC>/)
        if (m) {
          try {
            const spec = JSON.parse(m[1].trim())
            setDocSpec(spec)
            const before = raw.replace(/<DOCUMENT_SPEC>[\s\S]*?<\/DOCUMENT_SPEC>/, '').trim()
            setMessages(prev => [...prev,
              { role: 'au', content: before || 'Document ready. Review the preview and download.', type: 'text' },
              { role: 'au', content: 'Document ready: ' + spec.title, type: 'document-ready' }
            ])
          } catch {
            setMessages(prev => [...prev, { role: 'au', content: raw, type: 'text' }])
          }
        } else {
          setMessages(prev => [...prev, { role: 'au', content: raw, type: 'text' }])
        }
      }
    } catch {
      setMessages(prev => [...prev.filter(m => m.type !== 'thinking'), { role: 'au', content: 'Connection error. Please try again.', type: 'text' }])
    } finally {
      setLoading(false)
    }
  }

  async function generatePDF() {
    if (!docSpec || !brand) return
    setGenerating(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const W = 210, H = 297, M = 22, CW = W - M * 2
      const P = hex(brand.primary_color)
      const S = hex(brand.secondary_color)
      const A = hex(brand.accent_color)

      // COVER
      doc.setFillColor(P.r, P.g, P.b); doc.rect(0, 0, W, H, 'F')
      doc.setFillColor(S.r, S.g, S.b); doc.rect(0, 0, 6, H, 'F')
      doc.setFillColor(A.r, A.g, A.b); doc.rect(W - 60, 0, 60, 8, 'F')

      // Logo
      const logoUrl = brand.logo_transparent_url || brand.logo_url
      if (logoUrl) {
        try {
          const img = new Image(); img.crossOrigin = 'anonymous'
          await new Promise<void>(r => { img.onload = () => r(); img.onerror = () => r(); img.src = logoUrl })
          if (img.naturalWidth > 0) {
            const cv = document.createElement('canvas')
            cv.width = img.naturalWidth; cv.height = img.naturalHeight
            cv.getContext('2d')!.drawImage(img, 0, 0)
            const ratio = Math.min(48 / img.naturalWidth, 18 / img.naturalHeight)
            doc.addImage(cv.toDataURL('image/png'), 'PNG', W - M - img.naturalWidth * ratio, 18, img.naturalWidth * ratio, img.naturalHeight * ratio)
          }
        } catch {}
      }

      doc.setTextColor(A.r, A.g, A.b); doc.setFontSize(8); doc.setFont('helvetica', 'normal')
      doc.text(docType.label.toUpperCase(), M, 30)
      doc.setTextColor(S.r, S.g, S.b); doc.setFontSize(9); doc.setFont('helvetica', 'bold')
      doc.text(brand.name.toUpperCase(), M, 38)
      doc.setFillColor(S.r, S.g, S.b); doc.rect(M, 41, 32, 0.7, 'F')

      doc.setTextColor(255, 255, 255); doc.setFontSize(24); doc.setFont('helvetica', 'bold')
      let ty = 56
      doc.splitTextToSize(docSpec.title.toUpperCase(), CW - 10).forEach((l: string) => { doc.text(l, M, ty); ty += 9 })
      if (docSpec.subtitle) {
        doc.setFontSize(11); doc.setFont('helvetica', 'normal'); doc.setTextColor(A.r, A.g, A.b)
        doc.text(doc.splitTextToSize(docSpec.subtitle, CW), M, ty + 6)
      }

      doc.setFillColor(S.r, S.g, S.b); doc.rect(0, H - 46, W, 1, 'F')
      doc.setFillColor(10, 10, 10); doc.rect(0, H - 45, W, 45, 'F')
      doc.setTextColor(100, 100, 100); doc.setFontSize(7.5); doc.setFont('helvetica', 'normal')
      doc.text('PREPARED BY', M, H - 32); doc.text('DATE', 88, H - 32); doc.text('CLASSIFICATION', 148, H - 32)
      doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont('helvetica', 'bold')
      doc.text('AU Studio', M, H - 23); doc.text(docSpec.metadata.date, 88, H - 23)
      doc.text(docSpec.metadata.confidential ? 'CONFIDENTIAL' : 'INTERNAL', 148, H - 23)
      doc.setTextColor(100, 100, 100); doc.setFontSize(7); doc.setFont('helvetica', 'normal')
      doc.text(docSpec.metadata.legal_name || brand.name, M, H - 11)

      // TOC
      doc.addPage()
      doc.setFillColor(P.r, P.g, P.b); doc.rect(0, 0, W, 14, 'F')
      doc.setFillColor(S.r, S.g, S.b); doc.rect(0, 0, 6, 14, 'F')
      doc.setTextColor(S.r, S.g, S.b); doc.setFontSize(7.5); doc.setFont('helvetica', 'bold')
      doc.text(brand.name.toUpperCase(), 12, 9)
      doc.setTextColor(130, 130, 130)
      doc.text(docSpec.title.toUpperCase().substring(0, 52), W - M, 9, { align: 'right' })

      let y = 32
      doc.setTextColor(P.r, P.g, P.b); doc.setFontSize(16); doc.setFont('helvetica', 'bold')
      doc.text('CONTENTS', M, y)
      doc.setFillColor(S.r, S.g, S.b); doc.rect(M, y + 3, 20, 1, 'F')
      y += 14

      docSpec.sections.forEach((s, i) => {
        if (i % 2 === 0) { doc.setFillColor(248, 248, 248); doc.rect(M - 2, y - 5, CW + 4, 9, 'F') }
        doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(S.r, S.g, S.b)
        doc.text(String(i + 1).padStart(2, '0'), M, y)
        doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 30, 30)
        doc.text(s.heading, M + 9, y)
        doc.setTextColor(180, 180, 180); doc.text(String(i + 3), W - M, y, { align: 'right' })
        y += 10
      })

      doc.setFillColor(A.r, A.g, A.b); doc.rect(0, H - 10, W, 1, 'F')
      doc.setFillColor(P.r, P.g, P.b); doc.rect(0, H - 9, W, 9, 'F')
      doc.setTextColor(130, 130, 130); doc.setFontSize(7)
      doc.text(docSpec.metadata.date, M, H - 4); doc.text('2', W - M, H - 4, { align: 'right' })

      // CONTENT PAGES
      docSpec.sections.forEach((section, idx) => {
        doc.addPage()
        doc.setFillColor(P.r, P.g, P.b); doc.rect(0, 0, W, 14, 'F')
        doc.setFillColor(S.r, S.g, S.b); doc.rect(0, 0, 6, 14, 'F')
        doc.setTextColor(S.r, S.g, S.b); doc.setFontSize(7.5); doc.setFont('helvetica', 'bold')
        doc.text(brand.name.toUpperCase(), 12, 9)
        doc.setTextColor(130, 130, 130)
        doc.text(docSpec.title.toUpperCase().substring(0, 52), W - M, 9, { align: 'right' })

        y = 28
        doc.setFillColor(A.r, A.g, A.b); doc.rect(M, y - 5, 9, 9, 'F')
        doc.setTextColor(P.r, P.g, P.b); doc.setFontSize(8); doc.setFont('helvetica', 'bold')
        doc.text(String(idx + 1).padStart(2, '0'), M + 1, y)
        doc.setTextColor(P.r, P.g, P.b); doc.setFontSize(14); doc.setFont('helvetica', 'bold')
        doc.text(section.heading.toUpperCase(), M + 13, y)
        doc.setFillColor(S.r, S.g, S.b); doc.rect(M, y + 3, CW, 0.6, 'F')
        y += 13

        doc.setFontSize(9.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(42, 42, 42)
        const lines = doc.splitTextToSize(section.content, CW)
        for (const line of lines) {
          if (y > H - 16) {
            doc.setFillColor(A.r, A.g, A.b); doc.rect(0, H - 10, W, 1, 'F')
            doc.setFillColor(P.r, P.g, P.b); doc.rect(0, H - 9, W, 9, 'F')
            doc.setTextColor(130, 130, 130); doc.setFontSize(7)
            doc.text(docSpec.metadata.date, M, H - 4); doc.text(String(idx + 3), W - M, H - 4, { align: 'right' })
            doc.addPage()
            doc.setFillColor(P.r, P.g, P.b); doc.rect(0, 0, W, 14, 'F')
            doc.setFillColor(S.r, S.g, S.b); doc.rect(0, 0, 6, 14, 'F')
            doc.setTextColor(S.r, S.g, S.b); doc.setFontSize(7.5); doc.setFont('helvetica', 'bold')
            doc.text(brand.name.toUpperCase(), 12, 9)
            doc.setTextColor(130, 130, 130)
            doc.text(docSpec.title.toUpperCase().substring(0, 52), W - M, 9, { align: 'right' })
            y = 24; doc.setFontSize(9.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(42, 42, 42)
          }
          doc.text(line, M, y); y += 5.5
        }

        doc.setFillColor(A.r, A.g, A.b); doc.rect(0, H - 10, W, 1, 'F')
        doc.setFillColor(P.r, P.g, P.b); doc.rect(0, H - 9, W, 9, 'F')
        doc.setTextColor(130, 130, 130); doc.setFontSize(7)
        doc.text(docSpec.metadata.date, M, H - 4); doc.text(String(idx + 3), W - M, H - 4, { align: 'right' })
      })

      doc.save(docSpec.title.replace(/\s+/g, '_') + '_' + brand.name + '_AU.pdf')
      setMessages(prev => [...prev, { role: 'au', content: 'Downloaded. Would you like any adjustments?', type: 'text' }])

      // Save to Supabase
      try {
        const { data: { user } } = await supabase.auth.getUser()
        const { data: existing } = await supabase.from('documents')
          .select('id,current_version').eq('title', docSpec.title).eq('brand_id', brand.id).eq('created_by', user?.id).maybeSingle()
        if (existing) {
          const v = existing.current_version + 1
          await supabase.from('documents').update({ subtitle: docSpec.subtitle, sections: docSpec.sections, metadata: docSpec.metadata, current_version: v, updated_at: new Date().toISOString() }).eq('id', existing.id)
          await supabase.from('document_versions').insert({ document_id: existing.id, version_number: v, title: docSpec.title, sections: docSpec.sections, metadata: docSpec.metadata, created_by: user?.id })
        } else {
          const { data: newDoc } = await supabase.from('documents').insert({ title: docSpec.title, subtitle: docSpec.subtitle, doc_type: docTypeParam, brand_id: brand.id, created_by: user?.id, status: 'draft', current_version: 1, sections: docSpec.sections, metadata: docSpec.metadata }).select('id').single()
          if (newDoc) await supabase.from('document_versions').insert({ document_id: newDoc.id, version_number: 1, title: docSpec.title, sections: docSpec.sections, metadata: docSpec.metadata, created_by: user?.id })
        }
      } catch {}
    } catch (err) {
      console.error(err)
      setMessages(prev => [...prev, { role: 'au', content: 'PDF generation error. Please try again.', type: 'text' }])
    } finally {
      setGenerating(false) }
  }

  function fmt(t: string) {
    return t.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>')
  }

  return (
    <div className="flex flex-col flex-1" style={{ height: '100vh' }}>
      <div className="bg-white border-b border-gray-200 flex items-center justify-between px-7 py-4 flex-shrink-0">
        <div>
          <div className="text-xs text-gray-400 tracking-widest uppercase">Creation</div>
          <div className="flex items-center gap-3">
            <div className="font-bebas text-2xl text-aurum-black tracking-wide">{docType.label}</div>
            {isPlaceMode && <span className="text-xs bg-aurum-yellow text-aurum-black px-2 py-0.5 font-bold">PLACE AS-IS</span>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select onChange={e => { const b = brands.find(x => x.id === e.target.value); if (b) selectBrand(b) }}
            className="border border-gray-200 px-3 py-2 text-xs text-aurum-black outline-none focus:border-aurum-black bg-white"
            value={brand?.id || ''}>
            <option value="">Select brand...</option>
            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          {brand && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3" style={{ background: brand.primary_color }}/>
              <div className="w-3 h-3" style={{ background: brand.secondary_color }}/>
              <div className="w-3 h-3 border border-gray-200" style={{ background: brand.accent_color }}/>
            </div>
          )}
          {docSpec && (
            <button onClick={generatePDF} disabled={generating}
              className="bg-aurum-black text-white px-5 py-2 text-xs font-medium hover:bg-aurum-yellow hover:text-aurum-black transition-colors disabled:opacity-50">
              {generating ? 'Generating...' : 'Download PDF'}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5 bg-aurum-surface">
            {messages.map((msg, i) => (
              <div key={i} className={'flex gap-3 ' + (msg.role === 'user' ? 'flex-row-reverse' : '')}>
                <div className={'w-8 h-8 flex-shrink-0 flex items-center justify-center text-xs font-bold ' + (msg.role === 'au' ? 'bg-aurum-black text-aurum-yellow' : 'bg-aurum-yellow text-aurum-black')}>
                  {msg.role === 'au' ? 'AU' : 'ME'}
                </div>
                {msg.type === 'thinking' ? (
                  <div className="bg-white border border-gray-200 px-4 py-3 flex gap-1 items-center">
                    {[0, 150, 300].map(d => <div key={d} className="w-1.5 h-1.5 bg-aurum-yellow rounded-full animate-bounce" style={{ animationDelay: d + 'ms' }}/>)}
                    <span className="text-xs text-gray-400 ml-2">AU is working...</span>
                  </div>
                ) : msg.type === 'document-ready' ? (
                  <div className="bg-aurum-black text-white px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-10 flex items-center justify-center flex-shrink-0" style={{ background: brand?.secondary_color }}>
                      <span className="font-bold text-xs" style={{ color: brand?.primary_color }}>PDF</span>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 uppercase tracking-wide">Document ready</div>
                      <div className="text-sm font-medium text-aurum-yellow">{docSpec?.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{docSpec?.sections.length} sections</div>
                    </div>
                    <button onClick={generatePDF} disabled={generating}
                      className="ml-auto bg-aurum-yellow text-aurum-black px-3 py-1.5 text-xs font-bold hover:opacity-90 disabled:opacity-50">
                      {generating ? '...' : 'Download'}
                    </button>
                  </div>
                ) : (
                  <div className={'px-4 py-3 max-w-2xl text-sm leading-relaxed ' + (msg.role === 'au' ? 'bg-white border border-gray-200 text-gray-700' : 'bg-aurum-black text-white')}
                    dangerouslySetInnerHTML={{ __html: fmt(msg.content) }}/>
                )}
              </div>
            ))}
            <div ref={bottomRef}/>
          </div>

          <div className="border-t border-gray-200 bg-white px-6 py-4 flex-shrink-0">
            {uploadedName && (
              <div className="flex items-center gap-2 mb-3 text-xs text-gray-500 bg-gray-50 border border-gray-200 px-3 py-2">
                <span className="bg-aurum-yellow text-aurum-black px-1.5 py-0.5 font-bold text-xs">REF</span>
                <span>{uploadedName}</span>
                <button onClick={() => { setUploadedName(''); setUploadedText('') }} className="ml-auto text-gray-400 hover:text-gray-600">x</button>
              </div>
            )}
            <div className="flex gap-3 items-end">
              <button onClick={() => fileRef.current?.click()} className="border border-gray-200 p-2.5 hover:border-aurum-black transition-colors flex-shrink-0" title="Upload file">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v8M5 5l3-3 3 3M2 11v1a2 2 0 002 2h8a2 2 0 002-2v-1" stroke="#666" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <input ref={fileRef} type="file" accept=".txt,.pdf" className="hidden" onChange={handleFile}/>
              <textarea value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder={isPlaceMode ? 'Ask for layout adjustments only...' : 'Describe the document, paste content, or ask AU to improve any section...'}
                rows={2} className="flex-1 border border-gray-200 px-4 py-3 text-sm resize-none outline-none focus:border-aurum-black placeholder-gray-300"/>
              <button onClick={send} disabled={loading || !input.trim()}
                className="bg-aurum-black text-white px-5 py-3 text-xs font-medium hover:bg-aurum-yellow hover:text-aurum-black transition-colors disabled:opacity-40 flex-shrink-0">
                Send
              </button>
            </div>
            {isPlaceMode && <div className="text-xs text-aurum-yellow mt-2">Place as-is mode — upload a file or ask for layout adjustments only</div>}
          </div>
        </div>

        {docSpec && brand && (
          <div className="w-72 border-l border-gray-200 bg-white flex flex-col flex-shrink-0">
            <div className="px-5 py-4 border-b border-gray-200">
              <div className="text-xs text-gray-400 uppercase tracking-wide">Preview</div>
              <div className="text-sm font-medium text-aurum-black mt-0.5 truncate">{docSpec.title}</div>
            </div>
            <div className="mx-5 mt-4 p-4 mb-4" style={{ background: brand.primary_color }}>
              <div className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: brand.secondary_color }}>{brand.name}</div>
              <div className="text-white text-sm font-bold leading-tight">{docSpec.title}</div>
              {docSpec.subtitle && <div className="text-xs mt-1" style={{ color: brand.accent_color }}>{docSpec.subtitle}</div>}
              <div className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.4)' }}>{docSpec.metadata.date}</div>
            </div>
            <div className="px-5 flex-1 overflow-y-auto">
              <div className="text-xs text-gray-400 uppercase tracking-widest mb-2 font-medium">Sections ({docSpec.sections.length})</div>
              {docSpec.sections.map((s, i) => (
                <div key={i} className="flex gap-3 items-start py-2.5 border-b border-gray-100 last:border-0">
                  <div className="w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: brand.secondary_color, color: brand.primary_color }}>
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <div>
                    <div className="text-xs font-medium text-aurum-black">{s.heading}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{s.content.substring(0, 65)}...</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-gray-200">
              <button onClick={generatePDF} disabled={generating}
                className="w-full bg-aurum-black text-white py-3 text-xs font-bold tracking-widest hover:bg-aurum-yellow hover:text-aurum-black transition-colors disabled:opacity-50">
                {generating ? 'GENERATING...' : 'DOWNLOAD PDF'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function PDFPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center text-sm text-gray-400">Loading...</div>}>
      <PDFStudioInner />
    </Suspense>
  )
}
