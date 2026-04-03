import { NextRequest, NextResponse } from 'next/server'
import Replicate from 'replicate'

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
})

export async function POST(req: NextRequest) {
  try {
    const { prompt, style } = await req.json()

    if (!prompt) {
      return NextResponse.json({ error: 'No prompt provided' }, { status: 400 })
    }

    // Enhance prompt with style direction
    const enhancedPrompt = `${prompt}, ${style || 'professional corporate photography, clean, high quality, 4k'}. AU Studio brand aesthetic: clean, bold, black and yellow corporate identity.`

    const output = await replicate.run(
      'black-forest-labs/flux-schnell',
      {
        input: {
          prompt: enhancedPrompt,
          num_outputs: 1,
          aspect_ratio: '16:9',
          output_format: 'png',
          output_quality: 90,
        },
      }
    )

    const imageUrl = Array.isArray(output) ? output[0] : output

    return NextResponse.json({ imageUrl })
  } catch (error: any) {
    console.error('Replicate API error:', error)
    return NextResponse.json({ error: error.message || 'Image generation failed' }, { status: 500 })
  }
}
