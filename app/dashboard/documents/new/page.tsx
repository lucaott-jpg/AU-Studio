'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

interface Brand {
  id: string; name: string
  primary_color: string; secondary_color: string; accent_color: string
  font_heading: string; font_body: string
  logo_url: string | null; logo_transparent_url: string | null
  legal_name: string
}

type TemplateKey = 'minimal' | 'institutional' | 'split' | 'executive'

const DOC_TYPES = [
  { key: 'report',     label: 'Report',              desc: 'Analytical report with findings' },
  { key: 'teaser',     label: 'Investment Teaser',   desc: 'High-level opportunity overview' },
  { key: 'loi',        label: 'Letter of Intent',    desc: 'Preliminary transaction terms' },
  { key: 'memo',       label: 'Executive Memo',      desc: 'Internal leadership communication' },
  { key: 'proposal',   label: 'Proposal',            desc: 'Business proposal with scope' },
  { key: 'termsheet',  label: 'Term Sheet',          desc: 'Principal transaction terms' },
  { key: 'board',      label: 'Board Presentation',  desc: 'Board-level strategy presentation' },
  { key: 'pitch-deck', label: 'Pitch Deck',          desc: 'Investor or client presentation' },
]

const TEMPLATES: { key: TemplateKey; label: string; desc: string }[] = [
  { key: 'minimal',       label: 'Minimal',       desc: 'White pages, clean typography' },
  { key: 'institutional', label: 'Institutional', desc: 'Dark cover, white content pages' },
  { key: 'split',         label: 'Split',         desc: 'Color left column, content right' },
  { key: 'executive',     label: 'Executive',     desc: 'Full bleed cover, conservative' },
]

function hexToRgb(h: string) {
  const c = h.replace('#', '')
  return { r: parseInt(c.slice(0,2),16)||0, g: parseInt(c.slice(2,4),16)||0, b: parseInt(c.slice(4,6),16)||0 }
}

function isDark(hex: string) {
  const { r, g, b } = hexToRgb(hex)
  return (r * 0.299 + g * 0.587 + b * 0.114) < 128
}

function parseContent(text: string, filename: string) {
  const title = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim()
  const fullText = text.trim()
  const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean)

  // Detect financial document
  const isFinancial = /(TOTAL ASSETS|Total Checking|LIABILITIES & EQUITY|Net Income)/i.test(fullText)
  if (isFinancial) {
    const splitIdx = fullText.search(/LIABILITIES & EQUITY|Liabilities\s*\n/i)
    if (splitIdx > 0) {
      return {
        title,
        sections: [
          { heading: 'ASSETS', content: fullText.substring(0, splitIdx).trim() },
          { heading: 'LIABILITIES & EQUITY', content: fullText.substring(splitIdx).trim() }
        ]
      }
    }
    return { title, sections: [{ heading: 'FINANCIAL STATEMENT', content: fullText }] }
  }

  // Detect letter/memo
  const isLetter = /(Dear |Sincerely,|To:|Subject:|hereby notify|pursuant to the terms)/i.test(fullText)
  if (isLetter) {
    const sections: { heading: string; content: string }[] = []
    const subjectMatch = fullText.match(/Subject:\s*(.+)/i)
    const dearIdx = fullText.search(/Dear /i)
    const sincerelyIdx = fullText.search(/Sincerely,|Best regards,|Regards,/i)
    const subjectIdx = fullText.search(/Subject:/i)

    // Header block
    const headerEnd = Math.min(
      subjectIdx > 0 ? subjectIdx : 9999,
      dearIdx > 0 ? dearIdx : 9999
    )
    if (headerEnd > 20 && headerEnd < 9999) {
      sections.push({ heading: 'FROM', content: fullText.substring(0, headerEnd).trim() })
    }

    // Subject
    if (subjectMatch) {
      sections.push({ heading: 'SUBJECT', content: subjectMatch[1].trim() })
    }

    // Body paragraphs
    const bodyStart = dearIdx > 0 ? dearIdx : (subjectIdx > 0 ? subjectIdx + 50 : 0)
    const bodyEnd = sincerelyIdx > 0 ? sincerelyIdx : fullText.length
    const bodyText = fullText.substring(bodyStart, bodyEnd).trim()

    // Split body into 2-3 logical chunks
    const paragraphs = bodyText.split(/\n\n+/).filter(p => p.trim().length > 30)
    const chunkSize = Math.ceil(paragraphs.length / 2)
    const bodyLabels = ['NOTICE', 'DETAILS & REQUIREMENTS']

    if (paragraphs.length <= 2) {
      sections.push({ heading: 'BODY', content: bodyText })
    } else {
      paragraphs.forEach((p, i) => {
        const chunkIdx = Math.floor(i / chunkSize)
        const label = bodyLabels[chunkIdx] || 'CONTINUED'
        const existing = sections.find(s => s.heading === label)
        if (existing) { existing.content += '\n\n' + p }
        else { sections.push({ heading: label, content: p }) }
      })
    }

    // Closing
    if (sincerelyIdx > 0) {
      sections.push({ heading: 'CLOSING', content: fullText.substring(sincerelyIdx).trim() })
    }

    return { title, sections: sections.filter(s => s.content.length > 5).slice(0, 8) }
  }

  // Generic: detect all-caps headers
  const sections: { heading: string; content: string }[] = []
  let heading = 'OVERVIEW'
  let contentLines: string[] = []

  for (const line of lines) {
    const isAllCaps = line === line.toUpperCase() && line.length < 50 && line.length > 3
    const hasNoNumbers = !/(,\d{3}|\d+\.\d{2}|^\d)/.test(line)
    const isHeader = isAllCaps && hasNoNumbers && !line.includes('@')

    if (isHeader && contentLines.length > 2) {
      sections.push({ heading, content: contentLines.join('\n') })
      heading = line
      contentLines = []
    } else if (isHeader && contentLines.length === 0) {
      heading = line
    } else {
      contentLines.push(line)
    }
  }
  if (contentLines.length > 0) sections.push({ heading, content: contentLines.join('\n') })

  if (sections.length === 0) {
    return { title, sections: [{ heading: 'CONTENT', content: fullText }] }
  }

  return { title, sections: sections.slice(0, 10) }
}

export default function NewDocumentPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<'type' | 'brand' | 'upload' | 'template' | 'generating'>('type')
  const [docType, setDocType] = useState('')
  const [brand, setBrand] = useState<Brand | null>(null)
  const [brands, setBrands] = useState<Brand[]>([])
  const [template, setTemplate] = useState<TemplateKey>('institutional')
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState<{ title: string; sections: { heading: string; content: string }[] } | null>(null)
  const [reading, setReading] = useState(false)
  const [logoDataUrl, setLogoDataUrl] = useState('')
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  useEffect(() => {
    supabase.from('brands').select('*').order('name').then(({ data }) => setBrands(data || []))
  }, [])

  useEffect(() => {
    if (!brand) { setLogoDataUrl(''); return }
    const url = brand.logo_transparent_url || brand.logo_url
    if (!url) { setLogoDataUrl(''); return }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const cv = document.createElement('canvas')
      cv.width = img.naturalWidth; cv.height = img.naturalHeight
      cv.getContext('2d')!.drawImage(img, 0, 0)
      setLogoDataUrl(cv.toDataURL('image/png'))
    }
    img.onerror = () => setLogoDataUrl('')
    img.src = url
  }, [brand])

  async function handleFile(f: File) {
    setFileName(f.name); setReading(true); setParsed(null)
    let text = ''
    try {
      if (f.type === 'application/pdf') {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
        const buf = await f.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const tc = await page.getTextContent()
          text += tc.items.map((x: any) => x.str).join(' ') + '\n'
        }
      } else if (f.name.endsWith('.docx')) {
        const mammoth = await import('mammoth')
        text = (await mammoth.extractRawText({ arrayBuffer: await f.arrayBuffer() })).value
      } else {
        text = await f.text()
      }
      setParsed(parseContent(text, f.name))
    } catch (e) { console.error(e) }
    setReading(false)
  }

  async function generate() {
    if (!parsed || !brand) return
    setStep('generating')

    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const W = 210, H = 297, M = 20, CW = W - M * 2
      const P = hexToRgb(brand.primary_color)
      const S = hexToRgb(brand.secondary_color)
      const A = hexToRgb(brand.accent_color)
      const dark = isDark(brand.primary_color)
      const docLabel = DOC_TYPES.find(t => t.key === docType)?.label.toUpperCase() || 'DOCUMENT'

      // Logo helper - async, proper sizing
      async function placeLogo(x: number, y: number, maxW: number, maxH: number) {
        if (!logoDataUrl) return
        try {
          const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = logoDataUrl
          })
          const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight)
          const lw = img.naturalWidth * ratio, lh = img.naturalHeight * ratio
          // White backing only for non-transparent logo on dark background
          if (dark && !brand?.logo_transparent_url) {
            doc.setFillColor(255, 255, 255); doc.rect(x - 2, y - 2, lw + 4, lh + 4, 'F')
          }
          doc.addImage(logoDataUrl, 'PNG', x, y, lw, lh)
        } catch {}
      }

      function pageHeader() {
        if (template === 'minimal') {
          doc.setFillColor(255,255,255); doc.rect(0,0,W,11,'F')
          doc.setFillColor(S.r,S.g,S.b); doc.rect(0,10.5,W,0.5,'F')
          doc.setTextColor(P.r,P.g,P.b); doc.setFontSize(7); doc.setFont('helvetica','bold')
          doc.text(brand.name.toUpperCase(), M, 7)
          doc.setTextColor(160,160,160); doc.setFont('helvetica','normal')
          doc.text(parsed!.title.substring(0,50).toUpperCase(), W-M, 7, {align:'right'})
        } else if (template === 'split') {
          doc.setFillColor(P.r,P.g,P.b); doc.rect(0,0,55,H,'F')
          doc.setFillColor(S.r,S.g,S.b); doc.rect(55,0,W-55,11,'F')
          doc.setTextColor(255,255,255); doc.setFontSize(6.5); doc.setFont('helvetica','bold')
          doc.text(brand.name.toUpperCase(), 5, 7)
        } else {
          doc.setFillColor(P.r,P.g,P.b); doc.rect(0,0,W,11,'F')
          doc.setFillColor(S.r,S.g,S.b); doc.rect(0,0,4,11,'F')
          doc.setTextColor(S.r,S.g,S.b); doc.setFontSize(7); doc.setFont('helvetica','bold')
          doc.text(brand.name.toUpperCase(), 8, 7)
          doc.setTextColor(140,140,140); doc.setFont('helvetica','normal')
          doc.text(parsed!.title.substring(0,50).toUpperCase(), W-M, 7, {align:'right'})
        }
      }

      function pageFooter(pg: number) {
        if (template === 'split') {
          doc.setTextColor(200,200,200); doc.setFontSize(6.5); doc.setFont('helvetica','normal')
          doc.text(String(pg), 27, H-8, {align:'center'})
          doc.text(today, 27, H-14, {align:'center'})
        } else {
          const bgDark = template !== 'minimal'
          doc.setFillColor(A.r,A.g,A.b); doc.rect(0,H-8,W,0.5,'F')
          doc.setFillColor(bgDark?P.r:248, bgDark?P.g:248, bgDark?P.b:248)
          doc.rect(0,H-7.5,W,7.5,'F')
          doc.setTextColor(bgDark?130:100,bgDark?130:100,bgDark?130:100)
          doc.setFontSize(7); doc.setFont('helvetica','normal')
          doc.text(today, M, H-3); doc.text(String(pg), W-M, H-3, {align:'right'})
        }
      }

      // â”€â”€ COVER â”€â”€
      if (template === 'institutional') {
        doc.setFillColor(P.r,P.g,P.b); doc.rect(0,0,W,H,'F')
        doc.setFillColor(S.r,S.g,S.b); doc.rect(0,0,5,H,'F')
        doc.setFillColor(A.r,A.g,A.b); doc.rect(W-52,0,52,6,'F')
        await placeLogo(W-M-46, 13, 41, 17)
        doc.setTextColor(A.r,A.g,A.b); doc.setFontSize(7.5); doc.setFont('helvetica','normal')
        doc.text(docLabel, M, 26)
        doc.setTextColor(S.r,S.g,S.b); doc.setFontSize(8.5); doc.setFont('helvetica','bold')
        doc.text(brand.name.toUpperCase(), M, 34)
        doc.setFillColor(S.r,S.g,S.b); doc.rect(M,37,28,0.7,'F')
        doc.setTextColor(255,255,255); doc.setFontSize(24); doc.setFont('helvetica','bold')
        let ty = 52
        doc.splitTextToSize(parsed.title.toUpperCase(), CW-12).forEach((l: string) => { doc.text(l,M,ty); ty+=8.5 })
        // Footer bar
        doc.setFillColor(S.r,S.g,S.b); doc.rect(0,H-44,W,0.7,'F')
        doc.setFillColor(12,12,12); doc.rect(0,H-43,W,43,'F')
        doc.setTextColor(100,100,100); doc.setFontSize(7); doc.setFont('helvetica','normal')
        doc.text('PREPARED BY',M,H-31); doc.text('DATE',90,H-31); doc.text('CLASSIFICATION',148,H-31)
        doc.setTextColor(255,255,255); doc.setFontSize(8.5); doc.setFont('helvetica','bold')
        doc.text('AU Studio',M,H-22); doc.text(today,90,H-22); doc.text('CONFIDENTIAL',148,H-22)
        doc.setTextColor(90,90,90); doc.setFontSize(6.5); doc.setFont('helvetica','normal')
        doc.text(brand.legal_name||brand.name, M, H-10)

      } else if (template === 'minimal') {
        doc.setFillColor(255,255,255); doc.rect(0,0,W,H,'F')
        doc.setFillColor(P.r,P.g,P.b); doc.rect(0,0,W,3,'F')
        doc.setFillColor(S.r,S.g,S.b); doc.rect(0,3,W,0.8,'F')
        await placeLogo(W-M-46, 16, 41, 16)
        doc.setTextColor(S.r,S.g,S.b); doc.setFontSize(7.5); doc.setFont('helvetica','normal')
        doc.text(docLabel, M, 26)
        doc.setTextColor(P.r,P.g,P.b); doc.setFontSize(8.5); doc.setFont('helvetica','bold')
        doc.text(brand.name.toUpperCase(), M, 34)
        doc.setFillColor(S.r,S.g,S.b); doc.rect(M,36.5,22,0.6,'F')
        doc.setTextColor(10,10,10); doc.setFontSize(26); doc.setFont('helvetica','bold')
        let ty = 52
        doc.splitTextToSize(parsed.title.toUpperCase(), CW-5).forEach((l: string) => { doc.text(l,M,ty); ty+=9 })
        doc.setFillColor(P.r,P.g,P.b); doc.rect(M,H-56,CW,0.4,'F')
        doc.setTextColor(100,100,100); doc.setFontSize(7.5); doc.setFont('helvetica','normal')
        doc.text('PREPARED BY',M,H-47); doc.text('DATE',90,H-47)
        doc.setTextColor(10,10,10); doc.setFont('helvetica','bold'); doc.setFontSize(8.5)
        doc.text('AU Studio',M,H-39); doc.text(today,90,H-39)
        doc.setTextColor(150,150,150); doc.setFontSize(7); doc.setFont('helvetica','normal')
        doc.text(brand.legal_name||brand.name, M, H-25)

      } else if (template === 'split') {
        doc.setFillColor(P.r,P.g,P.b); doc.rect(0,0,55,H,'F')
        doc.setFillColor(255,255,255); doc.rect(55,0,W-55,H,'F')
        doc.setFillColor(S.r,S.g,S.b); doc.rect(55,0,1.5,H,'F')
        await placeLogo(4, 18, 46, 20)
        doc.setTextColor(S.r,S.g,S.b); doc.setFontSize(6.5); doc.setFont('helvetica','bold')
        doc.text(brand.name.toUpperCase(), 5, 52)
        doc.setTextColor(A.r,A.g,A.b); doc.setFontSize(7); doc.setFont('helvetica','normal')
        doc.text(docLabel, 62, 40)
        doc.setTextColor(P.r,P.g,P.b); doc.setFontSize(22); doc.setFont('helvetica','bold')
        let ty = 54
        doc.splitTextToSize(parsed.title.toUpperCase(), W-55-M-8).forEach((l: string) => { doc.text(l,62,ty); ty+=8 })
        doc.setFillColor(S.r,S.g,S.b); doc.rect(62,ty+2,W-55-M-8,0.6,'F')
        doc.setTextColor(100,100,100); doc.setFontSize(7.5); doc.setFont('helvetica','normal')
        doc.text('AU Studio  |  '+today+'  |  Confidential', 62, H-25)
        doc.text(brand.legal_name||brand.name, 62, H-15)

      } else { // executive
        doc.setFillColor(P.r,P.g,P.b); doc.rect(0,0,W,H*0.52,'F')
        doc.setFillColor(255,255,255); doc.rect(0,H*0.52,W,H*0.48,'F')
        doc.setFillColor(S.r,S.g,S.b); doc.rect(0,H*0.52-0.8,W,1.6,'F')
        await placeLogo(W-M-46, 14, 41, 16)
        doc.setTextColor(A.r,A.g,A.b); doc.setFontSize(7.5); doc.setFont('helvetica','normal')
        doc.text(docLabel, M, 26)
        doc.setTextColor(S.r,S.g,S.b); doc.setFontSize(7.5); doc.setFont('helvetica','bold')
        doc.text(brand.name.toUpperCase(), M, 33)
        doc.setTextColor(255,255,255); doc.setFontSize(26); doc.setFont('helvetica','bold')
        let ty = H*0.52-46
        doc.splitTextToSize(parsed.title.toUpperCase(), CW).forEach((l: string) => { doc.text(l,M,ty); ty+=9 })
        doc.setTextColor(80,80,80); doc.setFontSize(7.5); doc.setFont('helvetica','normal')
        doc.text('Prepared by AU Studio  Â·  '+today+'  Â·  Confidential', M, H*0.52+18)
        doc.setFillColor(A.r,A.g,A.b); doc.rect(M,H*0.52+22,35,0.5,'F')
        doc.setTextColor(60,60,60); doc.setFontSize(9); doc.setFont('helvetica','normal')
        doc.text(brand.legal_name||brand.name, M, H*0.52+32)
      }

      // â”€â”€ CONTENTS â”€â”€
      doc.addPage(); pageHeader()
      const cx = template === 'split' ? 62 : M
      const cw = template === 'split' ? W-55-M-8 : CW
      let y = 24
      doc.setTextColor(P.r,P.g,P.b); doc.setFontSize(15); doc.setFont('helvetica','bold')
      doc.text('CONTENTS', cx, y)
      doc.setFillColor(S.r,S.g,S.b); doc.rect(cx, y+2, 16, 0.8, 'F')
      y += 13
      parsed.sections.forEach((s, i) => {
        if (i%2===0) { doc.setFillColor(248,248,248); doc.rect(cx-2,y-5,cw+4,9,'F') }
        doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(S.r,S.g,S.b)
        doc.text(String(i+1).padStart(2,'0'), cx, y)
        doc.setFont('helvetica','normal'); doc.setTextColor(30,30,30)
        doc.text(s.heading, cx+8, y)
        doc.setTextColor(190,190,190); doc.text(String(i+3), cx+cw, y, {align:'right'})
        y += 9
      })
      pageFooter(2)

      // â”€â”€ CONTENT PAGES â”€â”€
      parsed.sections.forEach((section, idx) => {
        doc.addPage(); pageHeader()
        let y = 24
        doc.setFillColor(A.r,A.g,A.b); doc.rect(cx,y-5,9,9,'F')
        const accentDark = isDark(brand.accent_color)
        doc.setTextColor(accentDark?255:P.r, accentDark?255:P.g, accentDark?255:P.b)
        doc.setFontSize(7.5); doc.setFont('helvetica','bold')
        doc.text(String(idx+1).padStart(2,'0'), cx+1.5, y)
        doc.setTextColor(P.r,P.g,P.b); doc.setFontSize(12); doc.setFont('helvetica','bold')
        doc.text(section.heading.toUpperCase(), cx+12, y)
        doc.setFillColor(S.r,S.g,S.b); doc.rect(cx, y+3, cw, 0.5, 'F')
        y += 12

        const isFinancial = /(,\d{3}|\d+\.\d{2})/.test(section.content)
        const fontSize = isFinancial ? 8.5 : 9.5
        const fontFamily = isFinancial ? 'courier' : 'helvetica'
        doc.setFontSize(fontSize); doc.setFont(fontFamily,'normal'); doc.setTextColor(40,40,40)

        const contentLines = section.content.split('\n')
        for (const rawLine of contentLines) {
          const wrapped = doc.splitTextToSize(rawLine || ' ', cw)
          for (const line of wrapped) {
            if (y > H-14) {
              pageFooter(idx+3)
              doc.addPage(); pageHeader()
              y = 22
              doc.setFontSize(fontSize); doc.setFont(fontFamily,'normal'); doc.setTextColor(40,40,40)
            }
            doc.text(line, cx, y)
            y += isFinancial ? 4.8 : 5.5
          }
        }
        pageFooter(idx+3)
      })

      // Save
      const safeName = parsed.title.replace(/[^a-zA-Z0-9]/g, '_')
      doc.save(safeName + '_' + brand.name + '_' + template + '.pdf')

      // Save to Supabase
      try {
        const { data: { user } } = await supabase.auth.getUser()
        await supabase.from('documents').insert({
          title: parsed.title,
          doc_type: docType,
          brand_id: brand.id,
          created_by: user?.id,
          status: 'draft',
          current_version: 1,
          sections: parsed.sections,
          metadata: { company: brand.name, date: today, template }
        })
      } catch (e) { console.error('Save error:', e) }

      router.push('/dashboard')
    } catch (err) {
      console.error(err)
      setStep('template')
    }
  }

  const steps = ['type', 'brand', 'upload', 'template'] as const
  const stepIdx = steps.indexOf(step as any)

  if (step === 'generating') {
    return (
      <div className="flex-1 flex items-center justify-center bg-aurum-surface">
        <div className="text-center">
          <div className="font-bebas text-5xl text-aurum-black tracking-widest mb-4 animate-pulse">GENERATING</div>
          <div className="text-sm text-gray-400">Applying brand template...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-screen bg-aurum-surface">
      <div className="bg-white border-b border-gray-100 px-8 py-4 flex items-center gap-6 flex-shrink-0">
        <button onClick={() => router.push('/dashboard')} className="text-xs text-gray-400 hover:text-aurum-black transition-colors">Back</button>
        <div className="flex items-center gap-2 flex-1">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={'text-xs font-medium transition-colors ' + (i <= stepIdx ? 'text-aurum-black' : 'text-gray-300')}>
                {i+1}. {s.charAt(0).toUpperCase()+s.slice(1)}
              </div>
              {i < steps.length-1 && <div className={'w-8 h-px ' + (i < stepIdx ? 'bg-aurum-black' : 'bg-gray-200')}/>}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center p-12">
        <div className="w-full max-w-3xl">

          {step === 'type' && (
            <div>
              <div className="mb-8">
                <div className="font-bebas text-4xl text-aurum-black tracking-wide mb-2">Select document type</div>
                <div className="text-sm text-gray-400">What kind of document are you creating?</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {DOC_TYPES.map(t => (
                  <button key={t.key} onClick={() => { setDocType(t.key); setStep('brand') }}
                    className="text-left p-5 bg-white border border-gray-200 hover:border-aurum-black transition-all group">
                    <div className="text-sm font-semibold text-aurum-black">{t.label}</div>
                    <div className="text-xs text-gray-400 mt-1">{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'brand' && (
            <div>
              <div className="mb-8">
                <div className="font-bebas text-4xl text-aurum-black tracking-wide mb-2">Select brand</div>
                <div className="text-sm text-gray-400">Which brand identity should this document use?</div>
              </div>
              {brands.length === 0 ? (
                <div className="bg-white border border-gray-200 p-12 text-center">
                  <div className="text-sm text-gray-400 mb-4">No brands yet.</div>
                  <button onClick={() => router.push('/dashboard/brands')}
                    className="bg-aurum-black text-white px-6 py-2.5 text-xs font-medium hover:bg-aurum-yellow hover:text-aurum-black transition-colors">
                    Create brand first
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {brands.map(b => (
                    <button key={b.id} onClick={() => { setBrand(b); setStep('upload') }}
                      className="w-full text-left bg-white border border-gray-200 p-5 hover:border-aurum-black transition-all flex items-center gap-5">
                      <div className="flex gap-1 flex-shrink-0">
                        <div className="w-5 h-10 rounded-sm" style={{ background: b.primary_color }}/>
                        <div className="w-5 h-10 rounded-sm" style={{ background: b.secondary_color }}/>
                        <div className="w-5 h-10 rounded-sm border border-gray-100" style={{ background: b.accent_color }}/>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-aurum-black">{b.name}</div>
                        {b.legal_name && <div className="text-xs text-gray-400 mt-0.5">{b.legal_name}</div>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <button onClick={() => setStep('type')} className="mt-6 text-xs text-gray-400 hover:text-aurum-black transition-colors">Back</button>
            </div>
          )}

          {step === 'upload' && (
            <div>
              <div className="mb-8">
                <div className="font-bebas text-4xl text-aurum-black tracking-wide mb-2">Upload document</div>
                <div className="text-sm text-gray-400">Drop your file. AU reads the content and applies your brand template.</div>
              </div>
              <div
                onClick={() => fileRef.current?.click()}
                className={'bg-white border-2 border-dashed p-16 text-center cursor-pointer transition-all ' + (reading ? 'border-aurum-yellow' : parsed ? 'border-aurum-black' : 'border-gray-200 hover:border-gray-400')}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if(f) handleFile(f) }}
                onDragOver={e => e.preventDefault()}>
                {reading ? (
                  <div className="text-sm text-aurum-yellow animate-pulse font-medium">Reading file...</div>
                ) : parsed ? (
                  <div>
                    <div className="text-sm font-semibold text-aurum-black">{fileName}</div>
                    <div className="text-xs text-gray-400 mt-1">{parsed.sections.length} sections detected</div>
                    <div className="text-xs text-aurum-yellow mt-3 underline">Upload different file</div>
                  </div>
                ) : (
                  <div>
                    <div className="text-4xl text-gray-200 mb-4">â†‘</div>
                    <div className="text-sm font-medium text-gray-500 mb-1">Drop file here or click to browse</div>
                    <div className="text-xs text-gray-300">PDF Â· Word (.docx) Â· Text</div>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if(f) handleFile(f) }}/>
              <div className="flex items-center justify-between mt-6">
                <button onClick={() => setStep('brand')} className="text-xs text-gray-400 hover:text-aurum-black transition-colors">Back</button>
                {parsed && (
                  <button onClick={() => setStep('template')}
                    className="bg-aurum-black text-white px-8 py-3 text-xs font-bold tracking-widest hover:bg-aurum-yellow hover:text-aurum-black transition-all">
                    CONTINUE
                  </button>
                )}
              </div>
            </div>
          )}

          {step === 'template' && brand && parsed && (
            <div>
              <div className="mb-8">
                <div className="font-bebas text-4xl text-aurum-black tracking-wide mb-2">Choose template</div>
                <div className="text-sm text-gray-400">Select a visual layout. Same content, different presentation.</div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-8">
                {TEMPLATES.map(t => (
                  <button key={t.key} onClick={() => setTemplate(t.key)}
                    className={'text-left border-2 transition-all overflow-hidden ' + (template===t.key ? 'border-aurum-black' : 'border-gray-200 hover:border-gray-400')}>
                    <div className="h-28 relative overflow-hidden"
                      style={{ background: t.key==='minimal'||t.key==='executive' ? '#fff' : brand.primary_color }}>
                      {t.key==='minimal' && (
                        <>
                          <div className="absolute top-0 left-0 right-0 h-1" style={{background:brand.primary_color}}/>
                          <div className="absolute top-5 left-4 text-xs font-bold" style={{color:brand.primary_color,fontSize:'7px'}}>{brand.name}</div>
                          <div className="absolute top-9 left-4 right-4 font-bold text-gray-900" style={{fontSize:'11px'}}>{parsed.title.substring(0,30)}</div>
                          <div className="absolute bottom-3 left-4 right-4 h-px" style={{background:brand.secondary_color}}/>
                        </>
                      )}
                      {t.key==='institutional' && (
                        <>
                          <div className="absolute left-0 top-0 bottom-0 w-1" style={{background:brand.secondary_color}}/>
                          <div className="absolute top-5 left-4 font-bold" style={{color:brand.secondary_color,fontSize:'7px'}}>{brand.name}</div>
                          <div className="absolute top-9 left-4 right-4 font-bold text-white" style={{fontSize:'11px'}}>{parsed.title.substring(0,30)}</div>
                          <div className="absolute bottom-0 left-0 right-0 h-8 bg-black/50"/>
                        </>
                      )}
                      {t.key==='split' && (
                        <>
                          <div className="absolute left-0 top-0 bottom-0 w-1/3" style={{background:brand.primary_color}}/>
                          <div className="absolute top-0 bottom-0 w-px" style={{left:'33%',background:brand.secondary_color}}/>
                          <div className="absolute top-6 font-bold text-white" style={{left:'4%',fontSize:'7px'}}>{brand.name}</div>
                          <div className="absolute top-6 font-bold" style={{left:'37%',fontSize:'11px',color:brand.primary_color,width:'58%'}}>{parsed.title.substring(0,25)}</div>
                        </>
                      )}
                      {t.key==='executive' && (
                        <>
                          <div className="absolute top-0 left-0 right-0 h-1/2" style={{background:brand.primary_color}}/>
                          <div className="absolute h-px" style={{top:'50%',left:0,right:0,background:brand.secondary_color}}/>
                          <div className="absolute top-4 left-4 font-bold text-white" style={{fontSize:'7px'}}>{brand.name}</div>
                          <div className="absolute font-bold text-white" style={{top:'28%',left:'4%',fontSize:'10px',width:'88%'}}>{parsed.title.substring(0,30)}</div>
                        </>
                      )}
                      {template===t.key && (
                        <div className="absolute top-2 right-2 w-5 h-5 bg-aurum-yellow flex items-center justify-center">
                          <span className="text-aurum-black font-bold text-xs">âœ“</span>
                        </div>
                      )}
                    </div>
                    <div className="p-3 bg-white">
                      <div className="text-xs font-semibold text-aurum-black">{t.label}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{t.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <button onClick={() => setStep('upload')} className="text-xs text-gray-400 hover:text-aurum-black transition-colors">Back</button>
                <button onClick={generate}
                  className="bg-aurum-yellow text-aurum-black px-10 py-4 text-xs font-bold tracking-widest hover:opacity-90 transition-opacity">
                  GENERATE + DOWNLOAD PDF
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

