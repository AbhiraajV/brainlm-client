'use client'

import { useState, useRef, useCallback } from 'react'
import { MicButton } from '@/components/ui/MicButton'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { useTypewriterPlaceholder } from '@/components/ui/TypewriterPlaceholder'
import { createEvent } from '@/server/actions/event.actions'
import { useEventsCacheStore } from '@/store/events-cache.store'
import { ChatInputBar } from '@/components/ui/ChatInputBar'

export function EventInput() {
  const [text, setText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Optimistic updates via events cache
  const { addPendingEvent, confirmEvent, markFailed } = useEventsCacheStore()

  const handleTranscription = useCallback((transcribedText: string) => {
    setText(prev => {
      const newText = prev ? `${prev} ${transcribedText}` : transcribedText
      return newText.trim()
    })
  }, [])

  const handleError = useCallback((errorMsg: string) => {
    setError(errorMsg)
    setTimeout(() => setError(null), 3000)
  }, [])

  const { state: recordingState, toggleRecording } = useAudioRecorder({
    onTranscription: handleTranscription,
    onError: handleError,
  })

  const handleSubmit = async () => {
    const content = text.trim()
    if (!content || isSubmitting) return

    setIsSubmitting(true)
    setError(null)

    // Capture timestamp at the moment of submission (user's local time)
    const occurredAt = new Date()

    // Optimistic update: add to pending immediately with the captured timestamp
    const tempId = addPendingEvent(content, occurredAt)

    // Clear input right away for better UX
    setText('')

    try {
      const result = await createEvent({ content, occurredAt })
      // Confirm the pending event with server data
      confirmEvent(tempId, {
        id: result.event.id,
        content: result.event.content,
        createdAt: result.event.createdAt.toISOString(),
        occurredAt: result.event.occurredAt?.toISOString() ?? null,
      })
    } catch (err) {
      console.error('Failed to create event:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to save. Please try again.'
      markFailed(tempId, errorMessage)
      setError(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const isRecording = recordingState === 'recording'
  const isProcessing = recordingState === 'processing'

  const placeholder = useTypewriterPlaceholder({ isRecording, isProcessing })

  return (
    <ChatInputBar
      value={text}
      onChange={setText}
      onSubmit={handleSubmit}
      placeholder={placeholder}
      disabled={isSubmitting || isRecording}
      isLoading={isSubmitting}
      leftSlot={
        <MicButton
          state={recordingState}
          onToggle={toggleRecording}
          disabled={isSubmitting}
        />
      }
      statusToast={
        error ? (
          <div className="mb-2 px-3 py-2 text-sm text-[var(--color-error)] bg-[var(--color-error)]/10 rounded-[var(--radius-sm)]">
            {error}
          </div>
        ) : undefined
      }
    />
  )
}
