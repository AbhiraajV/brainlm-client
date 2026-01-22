'use server'

import { requireUser } from '@/server/auth'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

export async function transcribeAudio(formData: FormData): Promise<{ text: string } | { error: string }> {
  await requireUser()

  if (!OPENAI_API_KEY) {
    return { error: 'OpenAI API key not configured' }
  }

  const audioFile = formData.get('audio') as File
  if (!audioFile) {
    return { error: 'No audio file provided' }
  }

  try {
    const openaiFormData = new FormData()
    openaiFormData.append('file', audioFile)
    openaiFormData.append('model', 'whisper-1')
    openaiFormData.append('language', 'en')

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: openaiFormData,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('OpenAI STT error:', errorData)
      return { error: 'Transcription failed' }
    }

    const data = await response.json()
    return { text: data.text || '' }
  } catch (error) {
    console.error('STT error:', error)
    return { error: 'Transcription failed' }
  }
}
