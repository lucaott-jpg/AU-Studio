'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'au'
  content: string
  type?: 'text' | 'document-ready' | 'thinking'
}

interface DocumentSpec {
  title: string
  sections: { heading: string; content: string }[]
  metadata: { company: string; date: string; prepared_by: string; confidential: boolean }
}

export default function PDFPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'au',
      content: 'Hello. I\'m AU, your institutional document specialist. I create professional PDFs — reports, proposals, executive briefs, and presentations.\n\nTo get started, tell me what document you need. You can:\n\n• **Describe it** — "Create a quarterly report for our investors"\n• **Upload a reference** — drop a file and I\'ll use it as a base\n• **Give me specifications** — title, sections, tone, audience\n\nWhat would you like to create today?',
      type: 'text'
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [docSpec, setDocSpec] = useState<DocumentSpec | null>(null)
  const [generating, setGenerating] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadedFile(file)
    setMessages(prev => [...prev, {
      role: 'user',
      content: `📎 Uploaded reference: ${file.name}`,
      type: 'text'
    }, {
      role: 'au',
      content: `I've received **${file.name}** as your reference document. I'll use its structure, tone, and content as the foundation for your new document.\n\nNow tell me: what would you like me to create based on this? For example:\n• "Create a similar report for Q2 2025"\n• "Adapt this as an investor proposal"\n• "Reformat this as an executive brief"`,
      type: 'text'
    }])
  }

  async function handleSend() {
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage, type: 'text' }])
    setLoading(true)

    // Add thinking indicator
    setMessages(prev => [...prev, { role: 'au', content: '', type: 'thinking' }])

    try {
      const systemPrompt = `You are AU, an elite institutional document specialist for AU Studio, an internal corporate creative hub. 
Your role is to help users create professional, polished PDF documents — executive reports, proposals, investor briefs, operational manuals, and institutional presentations.

PERSONALITY: Professional, precise, concise. You speak like a senior partner at a top consultancy. Never casual.

WHEN THE USER DESCRIBES A DOCUMENT THEY WANT:
1. Ask 2-3 focused clarifying questions if needed (audience, length, key data points)
2. OR if you have enough information, respond with a JSON block wrapped in <DOCUMENT_SPEC> tags like this:

<DOCUMENT_SPEC>
{
  "title": "Document Title",
  "metadata": {
    "company": "Company Name or AU Studio",
    "date": "April 2026",
    "prepared_by": "AU Studio",
    "confidential": true
  },
  "sections": [
    { "heading": "Executive Summary", "content": "Full paragraph content here..." },
    { "heading": "Section 2 Title", "content": "Full paragraph content here..." }
  ]
}
</DOCUMENT_SPEC>

Always include at least 4-6 substantive sections with real, professional content. Make the content institutional quality — data-driven language, formal tone, structured arguments.

If the user uploads a reference, adapt your output to match that document's structure and purpose.
If the user asks for revisions, update the document spec accordingly.
Never break character. Always respond as AU.`

      const conversationHistory = messages
        .filter(m => m.type !== 'thinking')
        .map(m => ({
          role: m.role === 'au' ? 'assistant' : 'user',
          content: m.content
        }))

      conversationHistory.push({ role: 'user', content: userMessage })

      const response = await fetch('/api/analyze-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          briefing: userMessage,
          type: 'pdf',
          systemPrompt,
          history: conversationHistory
        })
      })

      const data = await response.json()

      // Remove thinking indicator
      setMessages(prev => prev.filter(m => m.type !== 'thinking'))

      if (data.rawResponse) {
        const raw = data.rawResponse

        // Check if response contains a document spec
        const specMatch = raw.match(/<DOCUMENT_SPEC>([\s\S]*?)<\/DOCUMENT_SPEC>/)
        if (specMatch) {
          try {
            const spec = JSON.parse(specMatch[1].trim())
            setDocSpec(spec)

            const textBefore = raw.replace(/<DOCUMENT_SPEC>[\s\S]*?<\/DOCUMENT_SPEC>/, '').trim()

            setMessages(prev => [...prev, {
              role: 'au',
              content: textBefore || 'Your document is ready. Review the preview on the right and click **Generate PDF** to download.',
              type: 'text'
            }, {
              role: 'au',
              content: `**Document ready:** ${spec.title}`,
              type: 'document-ready'
            }])
          } catch {
            setMessages(prev => [...prev, { role: 'au', content: raw, type: 'text' }])
          }
        } else {
          setMessages(prev => [...prev, { role: 'au', content: raw, type: 'text' }])
        }
      } else {
        setMessages(prev => [...prev, {
          role: 'au',
          content: 'I encountered an issue. Please try again.',
          type: 'text'
        }])
      }
    } catch {
      setMessages(prev => prev.filter(m => m.type !== 'thinking'))
      setMessages(prev => [...prev, {
        role: 'au',
        content: 'Connection error. Please try again.',
        type: 'text'
      }])
    } finally {
      setLoading(false)
    }
  }

  async function generatePDF() {
    if (!docSpec) return
    setGenerating(true)

    try {
      // Dynamically import jsPDF
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

      const pageW = 210
      const pageH = 297
      const margin = 20
      const contentW = pageW - margin * 2
      let y = 0

      // ── Cover page ──
      // Black header bar
      doc.setFillColor(10, 10, 10)
      doc.rect(0, 0, pageW, 60, 'F')

      // Yellow accent line
      doc.setFillColor(245, 200, 66)
      doc.rect(0, 60, pageW, 3, 'F')

      // Company name
      doc.setTextColor(245, 200, 66)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text(docSpec.metadata.company.toUpperCase(), margin, 25)

      // Title
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(22)
      doc.setFont('helvetica', 'bold')
      const titleLines = doc.splitTextToSize(docSpec.title.toUpperCase(), contentW)
      doc.text(titleLines, margin, 42)

      // Metadata block
      doc.setFillColor(247, 247, 245)
      doc.rect(0, 63, pageW, 40, 'F')

      doc.setTextColor(100, 100, 100)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text('PREPARED BY', margin, 76)
      doc.text('DATE', 90, 76)
      doc.text('CLASSIFICATION', 150, 76)

      doc.setTextColor(10, 10, 10)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text(docSpec.metadata.prepared_by, margin, 84)
      doc.text(docSpec.metadata.date, 90, 84)
      doc.text(docSpec.metadata.confidential ? 'CONFIDENTIAL' : 'INTERNAL USE', 150, 84)

      // Table of contents
      y = 120
      doc.setTextColor(10, 10, 10)
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text('TABLE OF CONTENTS', margin, y)

      doc.setFillColor(245, 200, 66)
      doc.rect(margin, y + 2, 30, 1.5, 'F')

      y += 12
      docSpec.sections.forEach((section, i) => {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(60, 60, 60)
        doc.text(`${String(i + 1).padStart(2, '0')}  ${section.heading}`, margin, y)
        doc.setTextColor(200, 200, 200)
        doc.text(`${i + 2}`, pageW - margin, y, { align: 'right' })
        y += 8
      })

      // Footer on cover
      doc.setFillColor(10, 10, 10)
      doc.rect(0, pageH - 20, pageW, 20, 'F')
      doc.setTextColor(245, 200, 66)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text('AU STUDIO · INTERNAL CREATIVE HUB', margin, pageH - 8)
      doc.setTextColor(100, 100, 100)
      doc.text('CONFIDENTIAL', pageW - margin, pageH - 8, { align: 'right' })

      // ── Content pages ──
      docSpec.sections.forEach((section, idx) => {
        doc.addPage()
        y = margin

        // Page header
        doc.setFillColor(10, 10, 10)
        doc.rect(0, 0, pageW, 14, 'F')
        doc.setTextColor(245, 200, 66)
        doc.setFontSize(7)
        doc.setFont('helvetica', 'bold')
        doc.text(docSpec.title.toUpperCase(), margin, 9)
        doc.setTextColor(150, 150, 150)
        doc.text(docSpec.metadata.company.toUpperCase(), pageW - margin, 9, { align: 'right' })

        y = 28

        // Section number + title
        doc.setFillColor(245, 200, 66)
        doc.rect(margin, y - 6, 8, 8, 'F')
        doc.setTextColor(10, 10, 10)
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.text(`${String(idx + 1).padStart(2, '0')}`, margin + 1.5, y)

        doc.setFontSize(16)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(10, 10, 10)
        doc.text(section.heading.toUpperCase(), margin + 12, y)

        // Accent line
        doc.setFillColor(245, 200, 66)
        doc.rect(margin, y + 3, contentW, 0.8, 'F')

        y += 14

        // Body content
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(50, 50, 50)
        const lines = doc.splitTextToSize(section.content, contentW)
        lines.forEach((line: string) => {
          if (y > pageH - 25) {
            doc.addPage()
            y = 25
            // mini header
            doc.setFillColor(10, 10, 10)
            doc.rect(0, 0, pageW, 14, 'F')
            doc.setTextColor(245, 200, 66)
            doc.setFontSize(7)
            doc.setFont('helvetica', 'bold')
            doc.text(docSpec.title.toUpperCase(), margin, 9)
            y = 25
          }
          doc.setFontSize(10)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(50, 50, 50)
          doc.text(line, margin, y)
          y += 6
        })

        // Page footer
        doc.setFillColor(247, 247, 245)
        doc.rect(0, pageH - 14, pageW, 14, 'F')
        doc.setTextColor(150, 150, 150)
        doc.setFontSize(8)
        doc.text(docSpec.metadata.date, margin, pageH - 6)
        doc.setTextColor(10, 10, 10)
        doc.setFont('helvetica', 'bold')
        doc.text(`${idx + 2}`, pageW - margin, pageH - 6, { align: 'right' })
      })

      doc.save(`${docSpec.title.replace(/\s+/g, '_')}_AU_Studio.pdf`)

      setMessages(prev => [...prev, {
        role: 'au',
        content: `✓ **${docSpec.title}** has been downloaded as a PDF. Would you like me to revise any section, adjust the tone, or create a variation of this document?`,
        type: 'text'
      }])
    } catch (err) {
      console.error(err)
      setMessages(prev => [...prev, {
        role: 'au',
        content: 'PDF generation encountered an error. Please try again.',
        type: 'text'
      }])
    } finally {
      setGenerating(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function formatMessage(content: string) {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>')
      .replace(/^• /gm, '&nbsp;&nbsp;• ')
  }

  return (
    <div className="flex flex-col flex-1 h-screen">
      {/* Topbar */}
      <div className="bg-white border-b border-gray-200 flex items-center justify-between px-7 py-4 flex-shrink-0">
        <div>
          <div className="text-xs text-gray-400 tracking-widest uppercase">Creation</div>
          <div className="font-bebas text-2xl text-aurum-black tracking-wide">PDF Studio</div>
        </div>
        <div className="flex gap-3 items-center">
          <span className="text-xs text-gray-400">Institutional document generator</span>
          {docSpec && (
            <button
              onClick={generatePDF}
              disabled={generating}
              className="bg-aurum-black text-white px-5 py-2 text-xs font-medium tracking-wide hover:bg-aurum-yellow hover:text-aurum-black transition-colors disabled:opacity-50"
            >
              {generating ? 'Generating...' : '↓ Download PDF'}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Chat area */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatar */}
                <div className={`w-8 h-8 flex-shrink-0 flex items-center justify-center text-xs font-bold
                  ${msg.role === 'au' ? 'bg-aurum-black text-aurum-yellow' : 'bg-aurum-yellow text-aurum-black'}`}>
                  {msg.role === 'au' ? 'AU' : 'ME'}
                </div>

                {/* Bubble */}
                {msg.type === 'thinking' ? (
                  <div className="bg-white border border-gray-200 px-4 py-3 max-w-lg">
                    <div className="flex gap-1 items-center">
                      <div className="w-1.5 h-1.5 bg-aurum-yellow rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 bg-aurum-yellow rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 bg-aurum-yellow rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      <span className="text-xs text-gray-400 ml-2">AU is thinking...</span>
                    </div>
                  </div>
                ) : msg.type === 'document-ready' ? (
                  <div className="bg-aurum-black text-white px-4 py-3 max-w-lg flex items-center gap-3">
                    <div className="w-8 h-10 bg-aurum-yellow flex items-center justify-center flex-shrink-0">
                      <span className="text-aurum-black font-bold text-xs">PDF</span>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 uppercase tracking-wide">Document ready</div>
                      <div className="text-sm font-medium text-aurum-yellow">{docSpec?.title}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{docSpec?.sections.length} sections · {docSpec?.metadata.date}</div>
                    </div>
                    <button
                      onClick={generatePDF}
                      disabled={generating}
                      className="ml-auto bg-aurum-yellow text-aurum-black px-3 py-1.5 text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {generating ? '...' : '↓ PDF'}
                    </button>
                  </div>
                ) : (
                  <div className={`px-4 py-3 max-w-2xl text-sm leading-relaxed
                    ${msg.role === 'au'
                      ? 'bg-white border border-gray-200 text-gray-700'
                      : 'bg-aurum-black text-white'
                    }`}
                    dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
                  />
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-gray-200 bg-white px-6 py-4 flex-shrink-0">
            {uploadedFile && (
              <div className="flex items-center gap-2 mb-3 text-xs text-gray-500 bg-gray-50 border border-gray-200 px-3 py-2">
                <span className="bg-aurum-yellow text-aurum-black px-1.5 py-0.5 font-bold text-xs">REF</span>
                <span>{uploadedFile.name}</span>
                <button onClick={() => setUploadedFile(null)} className="ml-auto text-gray-400 hover:text-gray-600">✕</button>
              </div>
            )}
            <div className="flex gap-3 items-end">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex-shrink-0 border border-gray-200 p-2.5 hover:border-aurum-black transition-colors"
                title="Upload reference document"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2v8M5 5l3-3 3 3M2 11v1a2 2 0 002 2h8a2 2 0 002-2v-1" stroke="#666" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={handleFileUpload} />

              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe the document you need... (Press Enter to send, Shift+Enter for new line)"
                rows={2}
                className="flex-1 border border-gray-200 px-4 py-3 text-sm text-aurum-black resize-none outline-none focus:border-aurum-black transition-colors placeholder-gray-300"
              />

              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="flex-shrink-0 bg-aurum-black text-white px-5 py-3 text-xs font-medium tracking-wide hover:bg-aurum-yellow hover:text-aurum-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
            <div className="text-xs text-gray-300 mt-2">AU creates institutional-grade PDFs · Upload a reference to match existing formats</div>
          </div>
        </div>

        {/* Document preview panel */}
        {docSpec && (
          <div className="w-80 border-l border-gray-200 bg-white flex flex-col overflow-hidden flex-shrink-0">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wide">Preview</div>
                <div className="text-sm font-medium text-aurum-black mt-0.5 truncate">{docSpec.title}</div>
              </div>
              <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5">Ready</span>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {/* Mini cover */}
              <div className="bg-aurum-black p-4 mb-4">
                <div className="text-aurum-yellow text-xs font-bold tracking-widest uppercase mb-1">{docSpec.metadata.company}</div>
                <div className="text-white text-sm font-bold leading-tight">{docSpec.title}</div>
                <div className="text-gray-400 text-xs mt-2">{docSpec.metadata.date}</div>
                {docSpec.metadata.confidential && (
                  <div className="mt-2 text-xs border border-gray-600 text-gray-400 px-2 py-0.5 inline-block">CONFIDENTIAL</div>
                )}
              </div>

              {/* Sections list */}
              <div className="section-label">Sections ({docSpec.sections.length})</div>
              {docSpec.sections.map((s, i) => (
                <div key={i} className="flex gap-3 items-start py-3 border-b border-gray-100 last:border-0">
                  <div className="w-6 h-6 bg-aurum-yellow flex items-center justify-center flex-shrink-0 text-xs font-bold text-aurum-black">
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <div>
                    <div className="text-xs font-medium text-aurum-black">{s.heading}</div>
                    <div className="text-xs text-gray-400 mt-0.5 line-clamp-2">{s.content.substring(0, 80)}...</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 py-4 border-t border-gray-200">
              <button
                onClick={generatePDF}
                disabled={generating}
                className="w-full bg-aurum-black text-white py-3 text-xs font-bold tracking-widest hover:bg-aurum-yellow hover:text-aurum-black transition-colors disabled:opacity-50"
              >
                {generating ? 'GENERATING PDF...' : '↓ GENERATE PDF'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
