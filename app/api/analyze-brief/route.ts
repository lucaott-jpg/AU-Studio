import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(req: NextRequest) {
  try {
    const { briefing, type } = await req.json()

    if (!briefing) {
      return NextResponse.json({ error: 'No briefing provided' }, { status: 400 })
    }

    const systemPrompt = `You are a creative director at AU Studio, an internal creative hub.
You analyze project briefings and provide structured, actionable creative direction.
Always respond in JSON format with the following structure:
{
  "structure": "Suggested structure or outline",
  "tone": "Recommended tone and style",
  "visual_direction": "Visual and design recommendations",
  "key_messages": ["message 1", "message 2", "message 3"],
  "suggestions": ["actionable suggestion 1", "actionable suggestion 2", "actionable suggestion 3"]
}`

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Analyze this ${type || 'presentation'} briefing and provide creative direction:\n\n${briefing}`,
        },
      ],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''

    // Parse JSON response
    const clean = text.replace(/```json|```/g, '').trim()
    const analysis = JSON.parse(clean)

    return NextResponse.json({ analysis })
  } catch (error: any) {
    console.error('Claude API error:', error)
    return NextResponse.json({ error: error.message || 'Analysis failed' }, { status: 500 })
  }
}
