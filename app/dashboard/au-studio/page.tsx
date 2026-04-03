'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'

interface Message { role: 'user' | 'au'; content: string; type?: 'text' | 'thinking' }

export default function AUStudioPage() {
  const [messages, setMessages] = useState<Message[]>([{
    role: 'au', type: 'text',
    content: `Welcome to AU Studio. I am your institutional document strategist.\n\nI can help you:\n\n• **Create** any document type — reports, teasers, LOIs, pitch decks\n• **Refine** existing content to institutional standard\n• **Analyze** deals and suggest document strategies\n• **Advise** on structure, tone, and approach\n\nWhat would you like to work on?`
  }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function send() {
    if (!input.trim() || loading) return
    const msg = input.trim(); setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg, type: 'text' }, { role: 'au', content: '', type: 'thinking' }])
    setLoading(true)
    try {
      const sys = `You are AU, an elite institutional document strategist. You operate at BlackRock / McKinsey / Goldman Sachs level.
You help users plan, create, and refine institutional documents for deals, investments, and corporate communications.
You are concise, precise, and professional. You ask smart questions to understand what the user needs.
When suggesting documents, always recommend going to the specific section (PDF Studio, Pitch Deck, etc.) to generate them.`
      const history = messages.filter(m => m.type !== 'thinking').map(m => ({ role: m.role === 'au' ? 'assistant' : 'user', content: m.content }))
      history.push({ role: 'user', content: msg })
      const res = await fetch('/api/analyze-brief', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ briefing: msg, systemPrompt: sys, history }) })
      const data = await res.json()
      setMessages(prev => prev.filter(m => m.type !== 'thinking'))
      if (data.rawResponse) setMessages(prev => [...prev, { role: 'au', content: data.rawResponse, type: 'text' }])
    } catch {
      setMessages(prev => [...prev.filter(m => m.type !== 'thinking'), { role: 'au', content: 'Connection error. Please try again.', type: 'text' }])
    } finally { setLoading(false) }
  }

  function fmt(t: string) {
    return t.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>')
  }

  return (
    <div className="flex flex-col flex-1" style={{ height: '100vh' }}>
      <div className="bg-white border-b border-gray-100 px-8 py-5 flex-shrink-0">
        <div className="text-xs text-gray-400 tracking-widest uppercase mb-0.5">AI Assistant</div>
        <div className="font-bebas text-2xl text-aurum-black tracking-wide">AU Studio</div>
      </div>
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5 bg-aurum-surface">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 flex-shrink-0 flex items-center justify-center text-xs font-bold ${msg.role === 'au' ? 'bg-aurum-black text-aurum-yellow' : 'bg-aurum-yellow text-aurum-black'}`}>
              {msg.role === 'au' ? 'AU' : 'ME'}
            </div>
            {msg.type === 'thinking' ? (
              <div className="bg-white border border-gray-200 px-4 py-3 flex gap-1 items-center">
                {[0, 150, 300].map(d => <div key={d} className="w-1.5 h-1.5 bg-aurum-yellow rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }}/>)}
                <span className="text-xs text-gray-400 ml-2">AU is thinking...</span>
              </div>
            ) : (
              <div className={`px-4 py-3 max-w-2xl text-sm leading-relaxed ${msg.role === 'au' ? 'bg-white border border-gray-200 text-gray-700' : 'bg-aurum-black text-white'}`}
                dangerouslySetInnerHTML={{ __html: fmt(msg.content) }}/>
            )}
          </div>
        ))}
        <div ref={bottomRef}/>
      </div>
      <div className="border-t border-gray-200 bg-white px-8 py-4 flex-shrink-0">
        <div className="flex gap-3 items-end">
          <textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Ask AU anything — document strategy, deal analysis, content review..."
            rows={2} className="flex-1 border border-gray-200 px-4 py-3 text-sm resize-none outline-none focus:border-aurum-black placeholder-gray-300"/>
          <button onClick={send} disabled={loading || !input.trim()}
            className="bg-aurum-black text-white px-6 py-3 text-xs font-medium hover:bg-aurum-yellow hover:text-aurum-black transition-colors disabled:opacity-40">
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
