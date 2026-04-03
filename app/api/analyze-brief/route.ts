import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(req: NextRequest) {
  try {
    const { briefing, type, systemPrompt, history } = await req.json()

    if (!briefing) {
      return NextResponse.json({ error: 'No briefing provided' }, { status: 400 })
    }

    const defaultSystem = `You are AU, an elite institutional document specialist for AU Studio, an internal corporate creative hub.
You create professional, polished institutional documents — reports, proposals, executive briefs, and presentations.
Always respond in a professional, precise tone. Never casual. Speak like a senior partner at a top consultancy.`

    const messages = history && history.length > 0
      ? history
      : [{ role: 'user', content: `Analyze this ${type || 'document'} briefing:\n\n${briefing}` }]

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: systemPrompt || defaultSystem,
      messages,
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''

    try {
      const clean = text.replace(/```json|```/g, '').trim()
      const analysis = JSON.parse(clean)
      return NextResponse.json({ analysis, rawResponse: text })
    } catch {
      return NextResponse.json({ rawResponse: text })
    }
  } catch (error: any) {
    console.error('AU API error:', error)
    return NextResponse.json({ error: error.message || 'Analysis failed' }, { status: 500 })
  }
}
