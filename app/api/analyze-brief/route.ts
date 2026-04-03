import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || ''
    let briefing = '', type = '', systemPrompt = '', history: any[] = [], fileBase64 = '', fileType = ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      briefing = formData.get('briefing') as string || ''
      type = formData.get('type') as string || ''
      systemPrompt = formData.get('systemPrompt') as string || ''
      const historyStr = formData.get('history') as string || '[]'
      history = JSON.parse(historyStr)
      const file = formData.get('file') as File | null
      if (file) {
        const buffer = await file.arrayBuffer()
        fileBase64 = Buffer.from(buffer).toString('base64')
        fileType = file.type
      }
    } else {
      const body = await req.json()
      briefing = body.briefing || ''
      type = body.type || ''
      systemPrompt = body.systemPrompt || ''
      history = body.history || []
    }

    if (!briefing && !fileBase64) {
      return NextResponse.json({ error: 'No content provided' }, { status: 400 })
    }

    const defaultSystem = `You are AU, an elite institutional document strategist for AU Studio. You operate at BlackRock / McKinsey / Goldman Sachs level. Always respond professionally and precisely.`

    let messages: any[] = history.length > 0 ? history : []

    if (fileBase64) {
      // Build message with file
      const userContent: any[] = []
      if (fileType === 'application/pdf') {
        userContent.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileBase64 } })
      } else if (fileType.startsWith('image/')) {
        userContent.push({ type: 'image', source: { type: 'base64', media_type: fileType, data: fileBase64 } })
      }
      if (briefing) userContent.push({ type: 'text', text: briefing })
      messages = [...messages, { role: 'user', content: userContent }]
    } else if (messages.length === 0) {
      messages = [{ role: 'user', content: briefing }]
    }

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
