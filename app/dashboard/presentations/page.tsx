'use client'

import { useState } from 'react'

export default function PresentationsPage() {
  const [briefing, setBriefing] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<any>(null)
  const [error, setError] = useState('')

  async function handleAnalyze() {
    if (!briefing.trim()) return
    setAnalyzing(true)
    setError('')
    setAnalysis(null)

    try {
      const res = await fetch('/api/analyze-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefing, type: 'presentation' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setAnalysis(data.analysis)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="flex flex-col flex-1">
      <div className="bg-white border-b border-gray-200 flex items-center justify-between px-7 py-4">
        <div>
          <div className="text-xs text-gray-400 tracking-widest uppercase">Creation</div>
          <div className="font-bebas text-2xl text-aurum-black tracking-wide">New Presentation</div>
        </div>
        <div className="flex gap-3">
          <button className="btn-outline">Save draft</button>
          <button className="btn-primary">Publish</button>
        </div>
      </div>

      <div className="flex flex-1">
        {/* Main */}
        <div className="flex-1 p-6 flex flex-col gap-5 border-r border-gray-200">
          {/* Type selector */}
          <div>
            <div className="section-label">Content type</div>
            <div className="flex gap-2">
              {['PDF', 'Presentation', 'Image', 'Logo'].map(t => (
                <button key={t}
                  className={`px-4 py-2 text-xs font-medium border transition-all
                    ${t === 'Presentation' ? 'bg-aurum-black border-aurum-black text-white' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Briefing */}
          <div className="bg-white border border-gray-200 p-4">
            <div className="section-label">Project briefing</div>
            <textarea
              value={briefing}
              onChange={e => setBriefing(e.target.value)}
              placeholder="Describe the goal of this presentation. AU will analyze and suggest structure, tone, and visual direction..."
              className="w-full border-none outline-none text-sm text-gray-700 resize-none min-h-[80px] leading-relaxed placeholder-gray-300"
            />
            <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-2">
              <span className="text-xs bg-aurum-yellow text-aurum-black px-2 py-1 font-medium tracking-wide">AU</span>
              <button
                onClick={handleAnalyze}
                disabled={analyzing || !briefing.trim()}
                className="bg-aurum-black text-white px-4 py-2 text-xs font-medium hover:bg-aurum-yellow hover:text-aurum-black
                  transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {analyzing ? 'Analyzing...' : 'Analyze briefing →'}
              </button>
            </div>
          </div>

          {/* Canvas */}
          <div className="bg-gray-50 border border-gray-200 min-h-[220px] flex items-center justify-center flex-col gap-3 relative cursor-pointer hover:border-aurum-black transition-colors">
            <span className="absolute top-3 right-3 text-xs bg-aurum-black text-aurum-yellow px-2 py-1 font-medium tracking-wide">PPT Canvas</span>
            <div className="w-10 h-10 border border-gray-200 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="2" y="3" width="16" height="12" rx="1" stroke="#CCC" strokeWidth="1" />
                <line x1="10" y1="15" x2="10" y2="18" stroke="#CCC" strokeWidth="1" />
                <line x1="6" y1="18" x2="14" y2="18" stroke="#CCC" strokeWidth="1" />
              </svg>
            </div>
            <span className="text-sm text-gray-400">Slide editing area</span>
            <span className="text-xs text-gray-300">Click to open full editor</span>
          </div>

          {/* Export */}
          <div>
            <div className="section-label">Export as</div>
            <div className="flex gap-2">
              {['PPTX', 'PDF', 'PNG'].map(f => (
                <button key={f} className="btn-outline">{f}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="w-72 bg-white flex flex-col divide-y divide-gray-100 p-5 gap-5">
          {/* AI Tools */}
          <div>
            <div className="section-label">AI tools</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="border border-green-200 bg-green-50 p-3 cursor-pointer hover:border-green-400 transition-colors">
                <div className="text-xs text-green-700 font-medium mb-1">AU</div>
                <div className="text-xs text-gray-400">Text & structure</div>
              </div>
              <div className="border border-indigo-200 bg-indigo-50 p-3 cursor-pointer hover:border-indigo-400 transition-colors">
                <div className="text-xs text-indigo-700 font-medium mb-1">Replicate</div>
                <div className="text-xs text-gray-400">Image generation</div>
              </div>
            </div>
          </div>

          {/* AU analysis results */}
          {error && (
            <div className="text-xs text-red-500 bg-red-50 border border-red-200 p-3">{error}</div>
          )}
          {analysis && (
            <div>
              <div className="section-label">AU analysis</div>
              <div className="flex flex-col gap-3">
                {[
                  { label: 'Structure', val: analysis.structure },
                  { label: 'Tone', val: analysis.tone },
                  { label: 'Visual direction', val: analysis.visual_direction },
                ].map(item => (
                  <div key={item.label} className="border border-gray-100 bg-gray-50 p-3">
                    <div className="text-xs text-aurum-yellow font-medium uppercase tracking-wide mb-1">{item.label}</div>
                    <div className="text-xs text-gray-600 leading-relaxed">{item.val}</div>
                  </div>
                ))}
                {analysis.suggestions?.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Suggestions</div>
                    {analysis.suggestions.map((s: string, i: number) => (
                      <div key={i} className="flex gap-2 items-start mb-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-aurum-yellow flex-shrink-0 mt-1" />
                        <div className="text-xs text-gray-500 leading-relaxed">{s}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          {!analysis && !error && (
            <div>
              <div className="section-label">AU suggestions</div>
              <div className="flex flex-col gap-2">
                {[
                  { label: 'Structure', text: 'Strong opening + 3 visual differentials + 2 detailed cases + clear CTA.' },
                  { label: 'Tone', text: 'Institutional but accessible. Use data visuals, avoid dense slides.' },
                ].map(s => (
                  <div key={s.label} className="border border-gray-100 bg-gray-50 p-3 cursor-pointer hover:border-aurum-yellow transition-colors">
                    <div className="text-xs text-aurum-yellow font-medium uppercase tracking-wide mb-1">{s.label}</div>
                    <div className="text-xs text-gray-500 leading-relaxed">{s.text}</div>
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
