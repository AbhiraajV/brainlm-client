'use client'

import { Loader2, Mic, Square } from 'lucide-react'
import { type RecordingState } from '@/hooks/useAudioRecorder'

interface MicButtonProps {
  state: RecordingState
  onToggle: () => void
  disabled?: boolean
}

export function MicButton({ state, onToggle, disabled }: MicButtonProps) {
  const isRecording = state === 'recording'
  const isProcessing = state === 'processing'

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled || isProcessing}
      aria-label={isRecording ? 'Stop recording' : 'Start recording'}
      className={`
        flex-shrink-0
        w-10 h-10
        flex items-center justify-center
        rounded-full
        transition-all duration-200
        focus:outline-none
        focus-visible:ring-2
        focus-visible:ring-[var(--color-accent)]
        focus-visible:ring-offset-2
        disabled:opacity-50
        disabled:cursor-not-allowed
        ${isRecording
          ? 'bg-[var(--color-error)] text-white animate-pulse'
          : 'bg-[var(--color-bg)] text-[var(--color-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10'
        }
      `}
    >
      {isProcessing ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : isRecording ? (
        <Square className="w-5 h-5" fill="currentColor" />
      ) : (
        <Mic className="w-5 h-5" />
      )}
    </button>
  )
}
