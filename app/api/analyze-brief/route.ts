import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { briefing, type, systemPrompt, history } = await req.json()
    if (!briefing) return NextResponse.json({ error: 'No content provided' }, { status: 400 })
    const defaultSystem = `You are AU, an elite institutional document strategist for AU Studio. You operate at BlackRock / McKinsey / Goldman Sachs level.`
    const messages = history && history.length > 0 ? history : [{ role: 'user', content: briefing }]
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: systemPrompt || defaultSystem,
      messages,
    })
    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    try {
      const analysis = JSON.parse(text.replace(/```json|```/g, '').trim())
      return NextResponse.json({ analysis, rawResponse: text })
    } catch {
      return NextResponse.json({ rawResponse: text })
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Analysis failed' }, { status: 500 })
  }
}
