import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { text, filename, docType } = await req.json()

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: `You are a document structure specialist. Your job is to read raw text extracted from a PDF and return a clean, properly structured JSON document. 

RULES:
1. Create a clean title from the document content (NOT the filename)
2. Identify logical sections based on the document type
3. Preserve ALL content exactly — do not summarize or change any text
4. For contracts: Parties, Overview, Scope, Pricing, Payment, Terms, Signatures
5. For letters: Header, Subject, Body, Closing
6. For financial: Assets, Liabilities & Equity
7. For reports: Executive Summary, Background, Analysis, Findings, Recommendations
8. Return ONLY valid JSON, no markdown, no backticks

Return this exact JSON structure:
{
  "title": "Clean Document Title",
  "sections": [
    { "heading": "SECTION NAME", "content": "Full exact content of this section..." }
  ]
}`,
      messages: [{
        role: 'user',
        content: `Document type: ${docType}\nFilename: ${filename}\n\nRaw text:\n${text.substring(0, 15000)}`
      }]
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : '{}'
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
    return NextResponse.json(parsed)
  } catch (error: any) {
    console.error('Parse error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
