'use client'

import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ArrowRight } from 'lucide-react'
import { MicButton } from '@/components/ui/MicButton'
import { HelpModal } from '@/components/ui/HelpModal'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { useTypewriterPlaceholder } from '@/components/ui/TypewriterPlaceholder'
import { createEvent } from '@/server/actions/event.actions'

// Use useLayoutEffect on client, useEffect on server
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

export function EventInput() {
  const [text, setText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const router = useRouter()

  // Auto-resize textarea when text changes
  useIsomorphicLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto'
    // Set to scrollHeight, capped at max
    const maxHeight = 150 // ~5 lines on mobile
    const newHeight = Math.min(textarea.scrollHeight, maxHeight)
    textarea.style.height = `${newHeight}px`
    // Enable scrolling if content exceeds max
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [text])

  const handleTranscription = useCallback((transcribedText: string) => {
    setText(prev => {
      const newText = prev ? `${prev} ${transcribedText}` : transcribedText
      return newText.trim()
    })
    // Focus the textarea after transcription
    setTimeout(() => textareaRef.current?.focus(), 0)
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

    try {
      await createEvent({ content })
      setText('')
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
      router.refresh()
    } catch (err) {
      console.error('Failed to create event:', err)
      setError('Failed to save. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Submit on Cmd/Ctrl + Enter
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const isRecording = recordingState === 'recording'
  const isProcessing = recordingState === 'processing'

  const placeholder = useTypewriterPlaceholder({ isRecording, isProcessing })

  return (
    <div className="w-full">
      {/* Error message */}
      {error && (
        <div className="mb-2 px-3 py-2 text-sm text-[var(--color-error)] bg-[var(--color-error)]/10 rounded-[var(--radius-sm)]">
          {error}
        </div>
      )}

      <div className={`
        relative
        flex items-end gap-3
        p-3
        bg-[var(--color-surface)]
        border border-[var(--color-line)]
        rounded-[var(--radius-md)]
        transition-all duration-200
        ${isRecording ? 'border-[var(--color-error)]/50 ring-2 ring-[var(--color-error)]/20' : ''}
        focus-within:border-[var(--color-accent)]/50
        focus-within:ring-2
        focus-within:ring-[var(--color-accent)]/20
      `}>
        {/* Help button - top right corner */}
        <div className="absolute top-1 right-1 z-10">
          <HelpModal />
        </div>

        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isSubmitting}
          rows={1}
          className="
            flex-1
            min-h-[60px]
            py-2.5 px-1
            pr-10
            text-[16px] text-[var(--color-text)]
            placeholder:text-[var(--color-muted)]
            bg-transparent
            border-none
            resize-none
            focus:outline-none
            disabled:opacity-50
            leading-relaxed
          "
        />

        {/* Mic button */}
        <MicButton
          state={recordingState}
          onToggle={toggleRecording}
          disabled={isSubmitting}
        />

        {/* Submit button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!text.trim() || isSubmitting || isRecording}
          className="
            flex-shrink-0
            w-10 h-10
            flex items-center justify-center
            rounded-full
            bg-[var(--color-accent)]
            text-white
            transition-all duration-200
            hover:opacity-90
            focus:outline-none
            focus-visible:ring-2
            focus-visible:ring-[var(--color-accent)]
            focus-visible:ring-offset-2
            disabled:opacity-40
            disabled:cursor-not-allowed
          "
          aria-label="Submit"
        >
          {isSubmitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <ArrowRight className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Keyboard hint - hidden on mobile */}
      <p className="hidden sm:block mt-2 text-[11px] text-[var(--color-muted)] text-center">
        Press <kbd className="px-1.5 py-0.5 bg-[var(--color-bg)] rounded text-[10px]">⌘</kbd> + <kbd className="px-1.5 py-0.5 bg-[var(--color-bg)] rounded text-[10px]">Enter</kbd> to submit
      </p>
    </div>
  )
}
