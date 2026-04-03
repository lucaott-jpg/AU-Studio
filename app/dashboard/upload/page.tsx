'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'

interface Brand {
  id: string; name: string
  primary_color: string; secondary_color: string; accent_color: string
  font_heading: string; font_body: string
  logo_url: string | null; logo_transparent_url: string | null
  legal_name: string; tone: string
}

interface ParsedContent {
  title: string
  sections: { heading: string; content: string }[]
  rawText: string
}

type TemplateKey = 'minimal' | 'institutional' | 'split' | 'executive'

const TEMPLATES: { key: TemplateKey; label: string; desc: string }[] = [
  { key: 'minimal',       label: 'Minimal',       desc: 'White pages, clean typography, color accents only' },
  { key: 'institutional', label: 'Institutional',  desc: 'Dark cover, white content pages, gold accents' },
  { key: 'split',         label: 'Split',          desc: 'Color left column, content right â€” high impact' },
  { key: 'executive',     label: 'Executive',      desc: 'Full bleed cover, conservative, ultra-tight' },
]

function hexToRgb(h: string) {
  const c = h.replace('#', '')
  return { r: parseInt(c.slice(0,2),16)||0, g: parseInt(c.slice(2,4),16)||0, b: parseInt(c.slice(4,6),16)||0 }
}

function isDark(hex: string) {
  const { r, g, b } = hexToRgb(hex)
  return (r * 0.299 + g * 0.587 + b * 0.114) < 128
}

export default function UploadPage() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [brand, setBrand] = useState<Brand | null>(null)
  const [template, setTemplate] = useState<TemplateKey>('institutional')
  const [content, setContent] = useState<ParsedContent | null>(null)
  const [fileName, setFileName] = useState('')
  const [status, setStatus] = useState<'idle' | 'reading' | 'ready' | 'generating'>('idle')
  const [generating, setGenerating] = useState(false)
  const [logoDataUrl, setLogoDataUrl] = useState<string>('')
  const fileRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('brands').select('*').order('name').then(({ data }) => setBrands(data || []))
  }, [])

  // Preload logo when brand changes
  useEffect(() => {
    if (!brand) { setLogoDataUrl(''); return }
    const url = brand.logo_transparent_url || brand.logo_url
    if (!url) { setLogoDataUrl(''); return }
    const img = new Image(); img.crossOrigin = 'anonymous'
    img.onload = () => {
      const cv = document.createElement('canvas')
      cv.width = img.naturalWidth; cv.height = img.naturalHeight
      cv.getContext('2d')!.drawImage(img, 0, 0)
      setLogoDataUrl(cv.toDataURL('image/png'))
    }
    img.onerror = () => setLogoDataUrl('')
    img.src = url
  }, [brand])

  async function processFile(file: File) {
    setStatus('reading')
    setFileName(file.name)
    setContent(null)

    let rawText = ''

    try {
      if (file.type === 'text/plain') {
        rawText = await file.text()
      } else if (file.type === 'application/pdf') {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
        const buf = await file.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const tc = await page.getTextContent()
          rawText += tc.items.map((x: any) => x.str).join(' ') + '\n'
        }
      } else if (file.name.endsWith('.docx')) {
        const mammoth = await import('mammoth')
        const buf = await file.arrayBuffer()
        const result = await mammoth.extractRawText({ arrayBuffer: buf })
        rawText = result.value
      } else {
        rawText = await file.text()
      }

      // Parse into sections
      const parsed = parseContent(rawText, file.name)
      setContent(parsed)
      setStatus('ready')
    } catch (err) {
      console.error(err)
      setStatus('idle')
      alert('Could not read this file. Please try PDF or plain text.')
    }
  }

  function parseContent(text: string, filename: string): ParsedContent {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l)
    const title = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')

    // Group lines into sections by detecting headers
    const sections: { heading: string; content: string }[] = []
    let currentHeading = 'Overview'
    let currentContent: string[] = []

    for (const line of lines) {
      // Detect section headers: all caps, short lines, or lines ending with ":"
      const isHeader = (
        (line === line.toUpperCase() && line.length < 60 && line.length > 2 && !/^\d/.test(line)) ||
        (line.endsWith(':') && line.length < 50) ||
        /^(TOTAL|Total)\s+[A-Z]/.test(line) === false && /^[A-Z][A-Z\s&]+$/.test(line) && line.length < 40
      )

      if (isHeader && currentContent.length > 0) {
        sections.push({ heading: currentHeading, content: currentContent.join('\n') })
        currentHeading = line.replace(/:$/, '')
        currentContent = []
      } else if (isHeader && currentContent.length === 0) {
        currentHeading = line.replace(/:$/, '')
      } else {
        currentContent.push(line)
      }
    }

    if (currentContent.length > 0) {
      sections.push({ heading: currentHeading, content: currentContent.join('\n') })
    }

    // Fallback: split into chunks of ~500 chars
    if (sections.length === 0 || sections.length === 1) {
      const chunks = text.match(/.{1,800}/gs) || []
      return {
        title,
        rawText: text,
        sections: chunks.map((chunk, i) => ({ heading: i === 0 ? 'Content' : `Section ${i + 1}`, content: chunk }))
      }
    }

    return { title, rawText: text, sections: sections.slice(0, 12) }
  }

  async function generate() {
    if (!content || !brand) return
    setGenerating(true)
    setStatus('generating')

    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const W = 210, H = 297, M = 20, CW = W - M * 2
      const P = hexToRgb(brand.primary_color)
      const S = hexToRgb(brand.secondary_color)
      const A = hexToRgb(brand.accent_color)
      const dark = isDark(brand.primary_color)
      const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

      function addLogo(x: number, y: number, maxW: number, maxH: number) {
        if (!logoDataUrl) return
        const img = new Image(); img.src = logoDataUrl
        if (!img.naturalWidth) return
        const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight)
        const lw = img.naturalWidth * ratio, lh = img.naturalHeight * ratio
        try { doc.addImage(logoDataUrl, 'PNG', x, y, lw, lh) } catch {}
      }

      function pageHeader(pageNum: number) {
        if (template === 'minimal') {
          doc.setFillColor(255,255,255); doc.rect(0,0,W,12,'F')
          doc.setFillColor(S.r,S.g,S.b); doc.rect(0,11,W,0.5,'F')
          doc.setTextColor(P.r,P.g,P.b); doc.setFontSize(7); doc.setFont('helvetica','bold')
          doc.text((brand?.name ?? "").toUpperCase(), M, 8)
          doc.setTextColor(160,160,160); doc.setFont('helvetica','normal')
          doc.text(content!.title.toUpperCase().substring(0,50), W-M, 8, {align:'right'})
        } else if (template === 'institutional' || template === 'executive') {
          doc.setFillColor(P.r,P.g,P.b); doc.rect(0,0,W,12,'F')
          doc.setFillColor(S.r,S.g,S.b); doc.rect(0,0,4,12,'F')
          doc.setTextColor(S.r,S.g,S.b); doc.setFontSize(7); doc.setFont('helvetica','bold')
          doc.text((brand?.name ?? "").toUpperCase(), 8, 8)
          doc.setTextColor(dark?160:100,dark?160:100,dark?160:100)
          doc.text(content!.title.substring(0,50).toUpperCase(), W-M, 8, {align:'right'})
        } else if (template === 'split') {
          doc.setFillColor(P.r,P.g,P.b); doc.rect(0,0,55,H,'F')
          doc.setFillColor(S.r,S.g,S.b); doc.rect(55,0,W-55,12,'F')
          doc.setTextColor(255,255,255); doc.setFontSize(6.5); doc.setFont('helvetica','bold')
          doc.text((brand?.name ?? "").toUpperCase(), 5, 8)
        }
      }

      function pageFooter(pageNum: number) {
        if (template === 'split') {
          doc.setTextColor(255,255,255,0.4 as any); doc.setFontSize(7); doc.setFont('helvetica','normal')
          doc.text(String(pageNum), 27, H-8, {align:'center'})
          doc.text(today, 27, H-14, {align:'center'})
        } else {
          doc.setFillColor(A.r,A.g,A.b); doc.rect(0,H-8,W,0.5,'F')
          doc.setFillColor(template==='minimal'?248:P.r, template==='minimal'?248:P.g, template==='minimal'?248:P.b)
          doc.rect(0,H-7.5,W,7.5,'F')
          doc.setTextColor(template==='minimal'?100:130,template==='minimal'?100:130,template==='minimal'?100:130)
          doc.setFontSize(7); doc.setFont('helvetica','normal')
          doc.text(today, M, H-3)
          doc.text(String(pageNum), W-M, H-3, {align:'right'})
        }
      }

      // â”€â”€ COVER PAGE â”€â”€
      if (template === 'minimal') {
        // White cover with strong typography
        doc.setFillColor(255,255,255); doc.rect(0,0,W,H,'F')
        doc.setFillColor(P.r,P.g,P.b); doc.rect(0,0,W,4,'F')
        doc.setFillColor(S.r,S.g,S.b); doc.rect(0,4,W,1,'F')

        // Logo top right
        addLogo(W-M-50, 20, 45, 18)

        doc.setTextColor(P.r,P.g,P.b); doc.setFontSize(9); doc.setFont('helvetica','bold')
        doc.text((brand?.name ?? "").toUpperCase(), M, 35)
        doc.setFillColor(S.r,S.g,S.b); doc.rect(M, 37, 25, 0.8, 'F')

        doc.setTextColor(10,10,10); doc.setFontSize(28); doc.setFont('helvetica','bold')
        const tl = doc.splitTextToSize(content.title.toUpperCase(), CW-10)
        let ty = 52
        tl.forEach((l: string) => { doc.text(l, M, ty); ty += 10 })

        doc.setFillColor(P.r,P.g,P.b); doc.rect(M, H-60, CW, 0.5, 'F')
        doc.setTextColor(100,100,100); doc.setFontSize(8); doc.setFont('helvetica','normal')
        doc.text('PREPARED BY', M, H-50)
        doc.text('DATE', 90, H-50)
        doc.setTextColor(10,10,10); doc.setFont('helvetica','bold'); doc.setFontSize(9)
        doc.text('AU Studio', M, H-42)
        doc.text(today, 90, H-42)
        doc.setTextColor(100,100,100); doc.setFontSize(7); doc.setFont('helvetica','normal')
        doc.text(brand.legal_name || brand.name, M, H-28)

      } else if (template === 'institutional') {
        // Dark cover
        doc.setFillColor(P.r,P.g,P.b); doc.rect(0,0,W,H,'F')
        doc.setFillColor(S.r,S.g,S.b); doc.rect(0,0,6,H,'F')
        doc.setFillColor(A.r,A.g,A.b); doc.rect(W-55,0,55,7,'F')

        // Logo with white backing if dark
        if (logoDataUrl) {
          const img = new Image(); img.src = logoDataUrl
          if (img.naturalWidth) {
            const ratio = Math.min(50/img.naturalWidth, 20/img.naturalHeight)
            const lw = img.naturalWidth*ratio, lh = img.naturalHeight*ratio
            const lx = W-M-lw, ly = 14
            if (dark) { doc.setFillColor(255,255,255); doc.roundedRect(lx-3, ly-2, lw+6, lh+4, 1, 1, 'F') }
            try { doc.addImage(logoDataUrl,'PNG',lx,ly,lw,lh) } catch {}
          }
        }

        doc.setTextColor(S.r,S.g,S.b); doc.setFontSize(9); doc.setFont('helvetica','bold')
        doc.text((brand?.name ?? "").toUpperCase(), M, 36)
        doc.setFillColor(S.r,S.g,S.b); doc.rect(M,39,30,0.8,'F')

        doc.setTextColor(255,255,255); doc.setFontSize(26); doc.setFont('helvetica','bold')
        let ty = 56
        doc.splitTextToSize(content.title.toUpperCase(), CW-15).forEach((l: string) => { doc.text(l,M,ty); ty+=9 })

        doc.setFillColor(S.r,S.g,S.b); doc.rect(0,H-46,W,0.8,'F')
        doc.setFillColor(12,12,12); doc.rect(0,H-45,W,45,'F')
        doc.setTextColor(100,100,100); doc.setFontSize(7.5); doc.setFont('helvetica','normal')
        doc.text('PREPARED BY',M,H-32); doc.text('DATE',90,H-32); doc.text('CLASSIFICATION',148,H-32)
        doc.setTextColor(255,255,255); doc.setFontSize(9); doc.setFont('helvetica','bold')
        doc.text('AU Studio',M,H-23); doc.text(today,90,H-23); doc.text('CONFIDENTIAL',148,H-23)
        doc.setTextColor(100,100,100); doc.setFontSize(7); doc.setFont('helvetica','normal')
        doc.text(brand.legal_name||brand.name,M,H-11)

      } else if (template === 'split') {
        // Split: primary left column full height
        doc.setFillColor(P.r,P.g,P.b); doc.rect(0,0,55,H,'F')
        doc.setFillColor(255,255,255); doc.rect(55,0,W-55,H,'F')
        doc.setFillColor(S.r,S.g,S.b); doc.rect(55,0,2,H,'F')

        // Logo on left column
        addLogo(5, 20, 44, 22)

        doc.setTextColor(S.r,S.g,S.b); doc.setFontSize(7); doc.setFont('helvetica','bold')
        doc.text((brand?.name ?? "").toUpperCase(), 5, 55)
        doc.setTextColor(255,255,255,0.5 as any); doc.setFontSize(6.5); doc.setFont('helvetica','normal')
        doc.text(today, 5, 62)

        // Right side content
        doc.setTextColor(P.r,P.g,P.b); doc.setFontSize(24); doc.setFont('helvetica','bold')
        let ty = 60
        doc.splitTextToSize(content.title.toUpperCase(), W-55-M-5).forEach((l: string) => { doc.text(l,62,ty); ty+=9 })
        doc.setFillColor(S.r,S.g,S.b); doc.rect(62, ty+2, W-55-M-5, 0.8, 'F')

        doc.setTextColor(100,100,100); doc.setFontSize(8); doc.setFont('helvetica','normal')
        doc.text('PREPARED BY Â· AU Studio', 62, H-30)
        doc.text('DATE Â· '+today, 62, H-22)
        doc.text('CONFIDENTIAL', 62, H-14)

      } else if (template === 'executive') {
        // Executive: full bleed top half, white bottom
        doc.setFillColor(P.r,P.g,P.b); doc.rect(0,0,W,H*0.55,'F')
        doc.setFillColor(255,255,255); doc.rect(0,H*0.55,W,H*0.45,'F')
        doc.setFillColor(S.r,S.g,S.b); doc.rect(0,H*0.55-1,W,2,'F')

        // Logo
        if (logoDataUrl) {
          const img = new Image(); img.src = logoDataUrl
          if (img.naturalWidth) {
            const ratio = Math.min(50/img.naturalWidth, 18/img.naturalHeight)
            const lw = img.naturalWidth*ratio, lh = img.naturalHeight*ratio
            const lx = W-M-lw, ly = 16
            if (dark) { doc.setFillColor(255,255,255); doc.roundedRect(lx-3,ly-2,lw+6,lh+4,1,1,'F') }
            try { doc.addImage(logoDataUrl,'PNG',lx,ly,lw,lh) } catch {}
          }
        }

        doc.setTextColor(S.r,S.g,S.b); doc.setFontSize(8); doc.setFont('helvetica','normal')
        doc.text((brand?.name ?? "").toUpperCase(), M, 30)

        doc.setTextColor(255,255,255); doc.setFontSize(28); doc.setFont('helvetica','bold')
        let ty = H*0.55-50
        doc.splitTextToSize(content.title.toUpperCase(), CW).forEach((l: string) => { doc.text(l,M,ty); ty+=10 })

        doc.setTextColor(10,10,10); doc.setFontSize(8); doc.setFont('helvetica','normal')
        doc.text('Prepared by AU Studio  |  '+today+'  |  Confidential', M, H*0.55+20)
        doc.setFillColor(A.r,A.g,A.b); doc.rect(M, H*0.55+24, 40, 0.5, 'F')
        doc.setTextColor(80,80,80); doc.setFontSize(10); doc.setFont('helvetica','normal')
        doc.text(brand.legal_name||brand.name, M, H*0.55+35)
      }

      // â”€â”€ CONTENTS PAGE â”€â”€
      doc.addPage()
      pageHeader(2)

      const contentStart = template === 'split' ? 62 : M
      const contentWidth = template === 'split' ? W-55-M-5 : CW
      let y = template === 'split' ? 22 : 26

      doc.setTextColor(P.r,P.g,P.b); doc.setFontSize(16); doc.setFont('helvetica','bold')
      doc.text('CONTENTS', contentStart, y)
      doc.setFillColor(S.r,S.g,S.b); doc.rect(contentStart, y+2, 18, 0.8, 'F')
      y += 14

      content.sections.forEach((s, i) => {
        if (i%2===0) { doc.setFillColor(248,248,248); doc.rect(contentStart-2, y-5, contentWidth+4, 9, 'F') }
        doc.setFontSize(8.5); doc.setFont('helvetica','bold'); doc.setTextColor(S.r,S.g,S.b)
        doc.text(String(i+1).padStart(2,'0'), contentStart, y)
        doc.setFont('helvetica','normal'); doc.setTextColor(30,30,30)
        doc.text(s.heading, contentStart+9, y)
        doc.setTextColor(180,180,180); doc.text(String(i+3), contentStart+contentWidth, y, {align:'right'})
        y += 10
      })
      pageFooter(2)

      // â”€â”€ CONTENT PAGES â”€â”€
      content.sections.forEach((section, idx) => {
        doc.addPage()
        pageHeader(idx+3)

        const cx = template === 'split' ? 62 : M
        const cw = template === 'split' ? W-55-M-5 : CW
        let y = template === 'split' ? 22 : 26

        // Section badge + title
        doc.setFillColor(A.r,A.g,A.b); doc.rect(cx, y-5, 9, 9, 'F')
        doc.setTextColor(template==='minimal'?P.r:isDark(brand.accent_color)?255:P.r,
                         template==='minimal'?P.g:isDark(brand.accent_color)?255:P.g,
                         template==='minimal'?P.b:isDark(brand.accent_color)?255:P.b)
        doc.setFontSize(8); doc.setFont('helvetica','bold')
        doc.text(String(idx+1).padStart(2,'0'), cx+1.5, y)

        doc.setTextColor(P.r,P.g,P.b); doc.setFontSize(13); doc.setFont('helvetica','bold')
        doc.text(section.heading.toUpperCase(), cx+13, y)

        doc.setFillColor(S.r,S.g,S.b); doc.rect(cx, y+3, cw, 0.5, 'F')
        y += 12

        // Body - detect financial data for monospace
        const isFinancial = /\d{1,3}(,\d{3})*\.\d{2}/.test(section.content)
        if (isFinancial) {
          doc.setFontSize(8.5); doc.setFont('courier','normal'); doc.setTextColor(35,35,35)
        } else {
          doc.setFontSize(9.5); doc.setFont('helvetica','normal'); doc.setTextColor(42,42,42)
        }

        const lines = doc.splitTextToSize(section.content, cw)
        for (const line of lines) {
          if (y > H-14) {
            pageFooter(idx+3)
            doc.addPage()
            pageHeader(idx+3)
            y = template==='split' ? 22 : 22
            if (isFinancial) { doc.setFontSize(8.5); doc.setFont('courier','normal'); doc.setTextColor(35,35,35) }
            else { doc.setFontSize(9.5); doc.setFont('helvetica','normal'); doc.setTextColor(42,42,42) }
          }
          doc.text(line, cx, y); y += isFinancial ? 5 : 5.5
        }
        pageFooter(idx+3)
      })

      // Save
      const safeName = content.title.replace(/[^a-zA-Z0-9]/g,'_')
      doc.save(safeName+'_'+brand.name+'_'+template+'.pdf')
      setStatus('ready')
    } catch(err) {
      console.error(err)
      alert('PDF generation failed. Please try again.')
      setStatus('ready')
    } finally {
      setGenerating(false)
    }
  }

  function cycleTemplate() {
    const keys: TemplateKey[] = ['minimal','institutional','split','executive']
    const idx = keys.indexOf(template)
    setTemplate(keys[(idx+1) % keys.length])
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [brand])

  const onDragOver = (e: React.DragEvent) => e.preventDefault()

  const currentTemplate = TEMPLATES.find(t => t.key === template)!

  return (
    <div className="flex flex-col flex-1 h-screen overflow-hidden">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between flex-shrink-0">
        <div>
          <div className="text-xs text-gray-400 tracking-widest uppercase">AU Studio</div>
          <div className="font-bebas text-2xl text-aurum-black tracking-wide">Document Renderer</div>
        </div>
        <div className="flex items-center gap-4">
          {/* Brand selector */}
          <select onChange={e => { const b = brands.find(x => x.id===e.target.value); setBrand(b||null) }}
            value={brand?.id||''}
            className="border border-gray-200 px-3 py-2 text-xs text-aurum-black outline-none focus:border-aurum-black bg-white min-w-[160px]">
            <option value="">Select brand...</option>
            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>

          {/* Color preview */}
          {brand && (
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded-sm border border-gray-200" style={{background:brand.primary_color}} title="Primary"/>
              <div className="w-4 h-4 rounded-sm border border-gray-200" style={{background:brand.secondary_color}} title="Secondary"/>
              <div className="w-4 h-4 rounded-sm border border-gray-200" style={{background:brand.accent_color}} title="Accent"/>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel - Upload + Template */}
        <div className="w-72 border-r border-gray-100 bg-white flex flex-col flex-shrink-0">
          {/* Upload zone */}
          <div className="p-5 border-b border-gray-100">
            <div className="text-xs text-gray-400 uppercase tracking-widest mb-3">Document</div>
            <div
              ref={dropRef}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-sm p-6 text-center cursor-pointer transition-all ${
                status === 'reading' ? 'border-aurum-yellow bg-yellow-50' :
                content ? 'border-aurum-black bg-gray-50' :
                'border-gray-200 hover:border-aurum-black hover:bg-gray-50'
              }`}>
              {status === 'reading' ? (
                <div>
                  <div className="text-xs text-aurum-yellow font-medium animate-pulse">Reading file...</div>
                </div>
              ) : content ? (
                <div>
                  <div className="text-xs font-medium text-aurum-black truncate">{fileName}</div>
                  <div className="text-xs text-gray-400 mt-1">{content.sections.length} sections detected</div>
                  <div className="text-xs text-aurum-yellow mt-2 underline">Upload different file</div>
                </div>
              ) : (
                <div>
                  <div className="text-2xl mb-2 text-gray-300">â†‘</div>
                  <div className="text-xs font-medium text-gray-500">Drop file here or click</div>
                  <div className="text-xs text-gray-300 mt-1">PDF Â· Word Â· Excel Â· Text</div>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt,.xlsx,.xls,.csv" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if(f) processFile(f) }}/>
          </div>

          {/* Template selector */}
          <div className="p-5 flex-1">
            <div className="text-xs text-gray-400 uppercase tracking-widest mb-3">Template</div>
            <div className="space-y-2">
              {TEMPLATES.map(t => (
                <button key={t.key} onClick={() => setTemplate(t.key)}
                  className={`w-full text-left p-3 border transition-all ${
                    template === t.key
                      ? 'border-aurum-black bg-aurum-black text-white'
                      : 'border-gray-200 hover:border-gray-400 text-aurum-black'
                  }`}>
                  <div className="text-xs font-semibold">{t.label}</div>
                  <div className={`text-xs mt-0.5 ${template===t.key?'text-gray-400':'text-gray-400'}`}>{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <div className="p-5 border-t border-gray-100">
            <button
              onClick={generate}
              disabled={!content || !brand || generating}
              className="w-full bg-aurum-yellow text-aurum-black py-3.5 text-xs font-bold tracking-widest hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed">
              {generating ? 'GENERATING...' : 'DOWNLOAD PDF'}
            </button>
            {content && brand && (
              <button onClick={cycleTemplate}
                className="w-full mt-2 border border-gray-200 py-2.5 text-xs text-gray-500 hover:border-aurum-black hover:text-aurum-black transition-colors">
                â†» Try next template
              </button>
            )}
          </div>
        </div>

        {/* Right panel - Preview */}
        <div className="flex-1 bg-aurum-surface overflow-y-auto flex flex-col items-center justify-center p-8">
          {!content || !brand ? (
            <div className="text-center">
              <div className="font-bebas text-6xl text-gray-100 tracking-widest mb-4">AU</div>
              <div className="text-sm text-gray-400 mb-2">Select a brand and upload a document</div>
              <div className="text-xs text-gray-300">PDF Â· Word Â· Excel Â· Text supported</div>
            </div>
          ) : (
            <div className="w-full max-w-lg">
              {/* Mini cover preview */}
              <div className="text-xs text-gray-400 uppercase tracking-widest mb-3 text-center">
                Preview â€” {currentTemplate.label}
              </div>

              {/* Cover mockup */}
              <div className="w-full aspect-[210/297] relative mb-4 shadow-2xl overflow-hidden"
                style={{
                  background: template==='minimal'||template==='executive'?'white':brand.primary_color,
                  border: template==='minimal' ? '1px solid #eee' : 'none'
                }}>

                {/* Template-specific mockup */}
                {template === 'minimal' && (
                  <>
                    <div className="absolute top-0 left-0 right-0 h-1" style={{background:brand.primary_color}}/>
                    <div className="absolute top-1 left-0 right-0 h-0.5" style={{background:brand.secondary_color}}/>
                    <div className="absolute top-6 left-5 text-xs font-bold" style={{color:brand.primary_color, fontSize:'8px'}}>{brand.name.toUpperCase()}</div>
                    <div className="absolute top-12 left-5 right-5 font-bold leading-tight text-gray-900" style={{fontSize:'16px'}}>{content.title.toUpperCase()}</div>
                    <div className="absolute bottom-8 left-5" style={{background:brand.primary_color, height:'0.5px', width:'80%'}}/>
                    <div className="absolute bottom-4 left-5 text-gray-400" style={{fontSize:'7px'}}>AU Studio Â· {today}</div>
                  </>
                )}
                {template === 'institutional' && (
                  <>
                    <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{background:brand.secondary_color}}/>
                    <div className="absolute top-6 left-5 text-xs font-bold" style={{color:brand.secondary_color, fontSize:'8px'}}>{brand.name.toUpperCase()}</div>
                    <div className="absolute top-12 left-5 right-5 font-bold leading-tight text-white" style={{fontSize:'16px'}}>{content.title.toUpperCase()}</div>
                    <div className="absolute bottom-0 left-0 right-0 h-14 bg-black/50"/>
                    <div className="absolute bottom-4 left-5 text-white" style={{fontSize:'7px', opacity:0.7}}>AU Studio Â· Confidential Â· {today}</div>
                  </>
                )}
                {template === 'split' && (
                  <>
                    <div className="absolute left-0 top-0 bottom-0" style={{width:'30%', background:brand.primary_color}}/>
                    <div className="absolute top-0 bottom-0" style={{left:'30%', width:'1px', background:brand.secondary_color}}/>
                    <div className="absolute top-8 font-bold text-white" style={{left:'5%', fontSize:'8px'}}>{brand.name}</div>
                    <div className="absolute top-10 right-0 font-bold leading-tight" style={{left:'33%', fontSize:'14px', color:brand.primary_color, width:'60%'}}>{content.title.toUpperCase()}</div>
                  </>
                )}
                {template === 'executive' && (
                  <>
                    <div className="absolute top-0 left-0 right-0" style={{height:'55%', background:brand.primary_color}}/>
                    <div className="absolute" style={{top:'55%', left:0, right:0, height:'2px', background:brand.secondary_color}}/>
                    <div className="absolute top-6 left-5 text-xs" style={{color:brand.secondary_color, fontSize:'7px'}}>{brand.name.toUpperCase()}</div>
                    <div className="absolute font-bold leading-tight text-white" style={{top:'35%', left:'5%', fontSize:'14px', width:'85%'}}>{content.title.toUpperCase()}</div>
                    <div className="absolute text-gray-500" style={{top:'60%', left:'5%', fontSize:'7px'}}>AU Studio Â· {today}</div>
                  </>
                )}
              </div>

              {/* Sections list */}
              <div className="bg-white border border-gray-200 divide-y divide-gray-50">
                {content.sections.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{background:brand.secondary_color, color:brand.primary_color}}>
                      {String(i+1).padStart(2,'0')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-aurum-black truncate">{s.heading}</div>
                      <div className="text-xs text-gray-400 truncate">{s.content.substring(0,60)}...</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


