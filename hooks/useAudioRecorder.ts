'use client'

import { useState, useRef, useCallback } from 'react'

export type RecordingState = 'idle' | 'recording' | 'processing'

interface UseAudioRecorderOptions {
  onTranscription?: (text: string) => void
  onError?: (error: string) => void
}

export function useAudioRecorder({ onTranscription, onError }: UseAudioRecorderOptions = {}) {
  const [state, setState] = useState<RecordingState>('idle')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      })

      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.start()
      setState('recording')
    } catch (err) {
      console.error('Microphone access error:', err)
      onError?.('Could not access microphone')
    }
  }, [onError])

  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current || state !== 'recording') return

    setState('processing')

    return new Promise<Blob>((resolve) => {
      const mediaRecorder = mediaRecorderRef.current!

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType
        const blob = new Blob(chunksRef.current, { type: mimeType })

        // Clean up stream
        streamRef.current?.getTracks().forEach(track => track.stop())
        streamRef.current = null

        resolve(blob)
      }

      mediaRecorder.stop()
    })
  }, [state])

  const transcribe = useCallback(async (audioBlob: Blob) => {
    try {
      const formData = new FormData()
      // Convert to a file with proper extension based on mime type
      const extension = audioBlob.type.includes('webm') ? 'webm' : 'm4a'
      const file = new File([audioBlob], `recording.${extension}`, { type: audioBlob.type })
      formData.append('audio', file)

      const { transcribeAudio } = await import('@/server/actions/stt.actions')
      const result = await transcribeAudio(formData)

      if ('error' in result) {
        onError?.(result.error)
      } else {
        onTranscription?.(result.text)
      }
    } catch (err) {
      console.error('Transcription error:', err)
      onError?.('Transcription failed')
    } finally {
      setState('idle')
    }
  }, [onTranscription, onError])

  const toggleRecording = useCallback(async () => {
    if (state === 'recording') {
      const blob = await stopRecording()
      if (blob) {
        await transcribe(blob)
      }
    } else if (state === 'idle') {
      await startRecording()
    }
    // If processing, do nothing
  }, [state, startRecording, stopRecording, transcribe])

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && state === 'recording') {
      mediaRecorderRef.current.stop()
      streamRef.current?.getTracks().forEach(track => track.stop())
      streamRef.current = null
      chunksRef.current = []
      setState('idle')
    }
  }, [state])

  return {
    state,
    isRecording: state === 'recording',
    isProcessing: state === 'processing',
    toggleRecording,
    cancelRecording,
  }
}
