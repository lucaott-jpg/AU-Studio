'use client'

import { useState } from 'react'

const styleOptions = [
  { id: 'corporate', label: 'Corporate', desc: 'Professional, clean' },
  { id: 'editorial', label: 'Editorial', desc: 'Magazine-style' },
  { id: 'minimal', label: 'Minimal', desc: 'Clean, white space' },
  { id: 'bold', label: 'Bold', desc: 'High contrast, graphic' },
]

export default function ImagesPage() {
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState('corporate')
  const [generating, setGenerating] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function handleGenerate() {
    if (!prompt.trim()) return
    setGenerating(true)
    setError('')
    setImageUrl(null)

    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, style }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setImageUrl(data.imageUrl)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="flex flex-col flex-1">
      <div className="bg-white border-b border-gray-200 flex items-center justify-between px-7 py-4">
        <div>
          <div className="text-xs text-gray-400 tracking-widest uppercase">Creation</div>
          <div className="font-bebas text-2xl text-aurum-black tracking-wide">Image Generation</div>
        </div>
        <div className="flex gap-3">
          <button className="btn-outline">Save to project</button>
          <button className="btn-primary">Publish</button>
        </div>
      </div>

      <div className="flex flex-1">
        <div className="flex-1 p-6 flex flex-col gap-5">
          {/* Prompt */}
          <div className="bg-white border border-gray-200 p-4">
            <div className="section-label">Image prompt</div>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Describe the image you want to generate. E.g: Modern office space with natural light, two professionals in a meeting, clean and corporate aesthetic..."
              className="w-full border-none outline-none text-sm text-gray-700 resize-none min-h-[80px] leading-relaxed placeholder-gray-300"
            />
            <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-2">
              <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-1 font-medium">Replicate · Flux</span>
              <button
                onClick={handleGenerate}
                disabled={generating || !prompt.trim()}
                className="bg-aurum-black text-white px-4 py-2 text-xs font-medium hover:bg-aurum-yellow hover:text-aurum-black
                  transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {generating ? 'Generating...' : 'Generate image →'}
              </button>
            </div>
          </div>

          {/* Style selector */}
          <div>
            <div className="section-label">Visual style</div>
            <div className="grid grid-cols-4 gap-2">
              {styleOptions.map(s => (
                <button key={s.id} onClick={() => setStyle(s.id)}
                  className={`border p-3 text-left transition-all
                    ${style === s.id ? 'border-aurum-black bg-aurum-black text-white' : 'border-gray-200 bg-white hover:border-gray-400'}`}>
                  <div className={`text-xs font-medium ${style === s.id ? 'text-aurum-yellow' : 'text-aurum-black'}`}>{s.label}</div>
                  <div className={`text-xs mt-0.5 ${style === s.id ? 'text-gray-400' : 'text-gray-400'}`}>{s.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Result */}
          <div className="bg-gray-50 border border-gray-200 min-h-[300px] flex items-center justify-center relative overflow-hidden">
            {generating && (
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-aurum-yellow border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-gray-400">Generating your image...</span>
              </div>
            )}
            {imageUrl && !generating && (
              <>
                <img src={imageUrl} alt="Generated" className="w-full h-full object-contain" />
                <div className="absolute bottom-3 right-3 flex gap-2">
                  <a href={imageUrl} download="aurum-generated.png"
                    className="bg-aurum-black text-white text-xs px-3 py-2 font-medium hover:bg-aurum-yellow hover:text-aurum-black transition-colors">
                    Download PNG
                  </a>
                </div>
              </>
            )}
            {!imageUrl && !generating && (
              <div className="text-center">
                <div className="font-bebas text-4xl text-gray-200 tracking-widest mb-2">CANVAS</div>
                <div className="text-xs text-gray-300">Your generated image will appear here</div>
              </div>
            )}
          </div>

          {error && (
            <div className="text-xs text-red-500 bg-red-50 border border-red-200 p-3">{error}</div>
          )}
        </div>
      </div>
    </div>
  )
}
