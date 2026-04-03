'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase-browser'

const previews = [
  { id: 'transparent', label: 'Transparent', bg: 'checker', textColor: '#0A0A0A' },
  { id: 'white', label: 'On white', bg: '#FFFFFF', textColor: '#0A0A0A' },
  { id: 'black', label: 'On black', bg: '#0A0A0A', textColor: '#F5C842' },
  { id: 'yellow', label: 'On yellow', bg: '#F5C842', textColor: '#0A0A0A' },
]

const brandColors = [
  { name: 'AU Yellow', hex: '#F5C842' },
  { name: 'Studio Black', hex: '#0A0A0A' },
  { name: 'Pure White', hex: '#FFFFFF' },
  { name: 'Surface', hex: '#F7F7F5' },
]

export default function LogoStudioPage() {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [removedUrl, setRemovedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [mode, setMode] = useState('auto')
  const [activeBg, setActiveBg] = useState('transparent')
  const [copied, setCopied] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setRemovedUrl(null)
    setStatus('File loaded. Ready to remove background.')
    const url = URL.createObjectURL(f)
    setPreviewUrl(url)
  }

  async function handleRemoveBg() {
    if (!file) {
      setStatus('Please upload a logo file first.')
      return
    }
    setLoading(true)
    setProgress(0)
    setStatus('Removing background...')

    // Simulate progress while waiting
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 85) { clearInterval(interval); return 85 }
        return p + Math.floor(Math.random() * 15) + 5
      })
    }, 300)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('mode', mode)

      const res = await fetch('/api/remove-bg', {
        method: 'POST',
        body: formData,
      })

      clearInterval(interval)

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to remove background')
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      setRemovedUrl(url)
      setProgress(100)
      setStatus('Background removed successfully. Ready to export.')
    } catch (err: any) {
      setStatus(`Error: ${err.message}`)
      setProgress(0)
    } finally {
      setLoading(false)
    }
  }

  function handleCopy(hex: string) {
    navigator.clipboard.writeText(hex)
    setCopied(hex)
    setTimeout(() => setCopied(''), 1500)
  }

  function handleDownload(label: string) {
    const url = removedUrl || previewUrl
    if (!url) { setStatus('No image to download yet.'); return }
    const a = document.createElement('a')
    a.href = url
    a.download = `aurum-logo-${label.toLowerCase().replace(/\s/g, '-')}.png`
    a.click()
  }

  const displayUrl = removedUrl || previewUrl

  return (
    <div className="flex flex-col flex-1">
      {/* Topbar */}
      <div className="bg-white border-b border-gray-200 flex items-center justify-between px-7 py-4">
        <div>
          <div className="text-xs text-gray-400 tracking-widest uppercase">AU Studio</div>
          <div className="font-bebas text-2xl text-aurum-black tracking-wide">Logo Studio</div>
        </div>
        <div className="flex gap-3">
          <button className="btn-outline">Save to project</button>
          <button className="btn-primary">Publish asset</button>
        </div>
      </div>

      <div className="flex flex-1">
        {/* Main area */}
        <div className="flex-1 p-6 flex flex-col gap-5 border-r border-gray-200">
          {/* Upload */}
          <div>
            <div className="section-label">Upload logo file</div>
            <div
              onClick={() => fileRef.current?.click()}
              className="bg-white border-2 border-dashed border-gray-200 hover:border-aurum-yellow transition-colors
                cursor-pointer flex flex-col items-center justify-center gap-3 p-8 text-center min-h-[160px]"
            >
              {previewUrl ? (
                <img src={previewUrl} alt="Uploaded logo" className="max-h-28 max-w-full object-contain" />
              ) : (
                <>
                  <div className="w-10 h-10 border border-gray-200 flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M9 2v10M5 6l4-4 4 4" stroke="#AAA" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M2 13v1a2 2 0 002 2h10a2 2 0 002-2v-1" stroke="#AAA" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="text-sm font-medium text-aurum-black">Drop your logo here</div>
                  <div className="text-xs text-gray-400">PNG, JPG, SVG, WEBP — up to 20MB</div>
                  <button
                    onClick={e => { e.stopPropagation(); fileRef.current?.click() }}
                    className="bg-aurum-black text-white px-5 py-2 text-xs font-medium hover:bg-aurum-yellow hover:text-aurum-black transition-colors"
                  >
                    Browse file
                  </button>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>

          {/* Previews */}
          <div>
            <div className="section-label">Logo previews</div>
            <div className="grid grid-cols-2 gap-3">
              {previews.map(p => (
                <div key={p.id} className="bg-white border border-gray-200 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                    <span className="text-xs text-gray-400 uppercase tracking-wide">{p.label}</span>
                    <span className={`text-xs px-2 py-0.5 border font-medium
                      ${removedUrl || previewUrl ? 'text-green-700 bg-green-50 border-green-200' : 'text-gray-400 bg-gray-50 border-gray-200'}`}>
                      {removedUrl ? 'Done' : previewUrl ? 'Original' : 'Waiting'}
                    </span>
                  </div>
                  <div
                    className="h-28 flex items-center justify-center"
                    style={{
                      background: p.bg === 'checker'
                        ? 'repeating-conic-gradient(#E0E0E0 0% 25%, #F5F5F5 0% 50%) 0 0 / 12px 12px'
                        : p.bg
                    }}
                  >
                    {displayUrl ? (
                      <img src={displayUrl} alt="Logo preview" className="max-h-20 max-w-full object-contain p-2" />
                    ) : (
                      <span className="font-bebas text-xl tracking-widest" style={{ color: p.textColor }}>LOGO</span>
                    )}
                  </div>
                  <div className="px-3 py-2 border-t border-gray-100 flex justify-end">
                    <button
                      onClick={() => handleDownload(p.label)}
                      className="text-xs font-medium text-aurum-black border border-gray-200 px-3 py-1.5
                        hover:bg-aurum-black hover:text-white transition-colors"
                    >
                      Download PNG
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="w-72 bg-white flex flex-col divide-y divide-gray-100">
          {/* Background removal */}
          <div className="p-5">
            <div className="text-sm font-medium text-aurum-black mb-4">Background removal</div>
            {[
              ['1', 'Upload', 'your logo above (PNG or JPG)'],
              ['2', 'Choose', 'removal mode below'],
              ['3', 'Click Remove', '— AI returns a clean transparent PNG'],
            ].map(([n, bold, rest]) => (
              <div key={n} className="flex gap-3 items-start mb-3">
                <div className="w-5 h-5 bg-aurum-black text-aurum-yellow text-xs font-bebas flex items-center justify-center flex-shrink-0">
                  {n}
                </div>
                <div className="text-xs text-gray-500 leading-relaxed">
                  <span className="font-medium text-aurum-black">{bold}</span> {rest}
                </div>
              </div>
            ))}

            <div className="section-label mt-4">Removal mode</div>
            <div className="flex gap-2 mb-4">
              {['auto', 'solid', 'white'].map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 py-2 text-xs font-medium border transition-all capitalize
                    ${mode === m ? 'bg-aurum-black border-aurum-black text-white' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}
                >
                  {m === 'auto' ? 'Auto AI' : m === 'solid' ? 'Solid color' : 'White only'}
                </button>
              ))}
            </div>

            <button
              onClick={handleRemoveBg}
              disabled={loading || !file}
              className="w-full bg-aurum-yellow text-aurum-black py-3 font-bebas tracking-widest text-sm
                hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : 'Remove background'}
            </button>

            {/* Progress bar */}
            {progress > 0 && (
              <div className="mt-3 h-0.5 bg-gray-100 overflow-hidden">
                <div
                  className="h-full bg-aurum-yellow transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
            {status && (
              <p className={`text-xs mt-2 ${status.startsWith('Error') ? 'text-red-500' : 'text-green-600'}`}>
                {status}
              </p>
            )}
          </div>

          {/* Brand color identifier */}
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-aurum-black">Brand colors</div>
              <span className="text-xs bg-aurum-yellow text-aurum-black px-2 py-0.5 font-medium">Use outside app</span>
            </div>
            {brandColors.map(c => (
              <div key={c.hex} className="flex items-center gap-3 mb-3">
                <div
                  className="w-8 h-8 flex-shrink-0 border border-gray-200 cursor-pointer hover:scale-110 transition-transform"
                  style={{ background: c.hex }}
                  onClick={() => handleCopy(c.hex)}
                />
                <div className="flex-1">
                  <div className="text-xs font-medium text-aurum-black">{c.name}</div>
                  <div className="text-xs text-gray-400 font-mono">{c.hex}</div>
                </div>
                <button
                  onClick={() => handleCopy(c.hex)}
                  className="text-xs font-medium text-aurum-yellow hover:underline"
                >
                  {copied === c.hex ? 'Copied!' : 'Copy'}
                </button>
              </div>
            ))}
            <div className="text-xs text-gray-300 mt-2 leading-relaxed">
              Click any swatch or Copy to paste HEX directly into Figma, PowerPoint, or any design tool.
            </div>
          </div>

          {/* Export */}
          <div className="p-5">
            <div className="text-sm font-medium text-aurum-black mb-3">Export formats</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'PNG', sub: 'transparent', primary: true },
                { label: 'SVG', sub: 'vector', primary: false },
                { label: 'PNG', sub: 'on white', primary: false },
                { label: 'PDF', sub: 'print ready', primary: false },
              ].map((btn, i) => (
                <button
                  key={i}
                  onClick={() => handleDownload(`${btn.label}-${btn.sub}`)}
                  className={`border py-2.5 text-center text-xs font-medium transition-all
                    ${btn.primary
                      ? 'bg-aurum-black border-aurum-black text-aurum-yellow hover:bg-aurum-yellow hover:text-aurum-black hover:border-aurum-yellow'
                      : 'border-gray-200 text-gray-500 hover:border-aurum-black hover:text-aurum-black'
                    }`}
                >
                  <div>{btn.label}</div>
                  <div className="text-xs opacity-60 mt-0.5">{btn.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Powered by */}
          <div className="p-5 mt-auto">
            <div className="section-label">Powered by</div>
            <div className="flex gap-2">
              <span className="border border-gray-200 px-3 py-1.5 text-xs text-gray-500 font-medium">Remove.bg</span>
              <span className="border border-gray-200 px-3 py-1.5 text-xs text-gray-500 font-medium">Rembg AI</span>
            </div>
            <div className="text-xs text-gray-300 mt-3 leading-relaxed">
              Results saved automatically to Supabase storage.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
