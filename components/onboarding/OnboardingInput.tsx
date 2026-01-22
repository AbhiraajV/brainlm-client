'use client';

import { useRef, useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { MicButton } from '@/components/ui/MicButton';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';

// Use useLayoutEffect on client, useEffect on server
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

interface OnboardingInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}

export function OnboardingInput({
  value,
  onChange,
  placeholder = 'Type your answer...',
  label,
}: OnboardingInputProps) {
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea when text changes
  useIsomorphicLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    // Set to scrollHeight, capped at max
    const maxHeight = 200;
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
    // Enable scrolling if content exceeds max
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [value]);

  const handleTranscription = useCallback(
    (transcribedText: string) => {
      onChange(value ? `${value} ${transcribedText}`.trim() : transcribedText.trim());
      // Focus the textarea after transcription
      setTimeout(() => textareaRef.current?.focus(), 0);
    },
    [value, onChange]
  );

  const handleError = useCallback((errorMsg: string) => {
    setError(errorMsg);
    setTimeout(() => setError(null), 3000);
  }, []);

  const { state: recordingState, toggleRecording } = useAudioRecorder({
    onTranscription: handleTranscription,
    onError: handleError,
  });

  const isRecording = recordingState === 'recording';
  const isProcessing = recordingState === 'processing';

  return (
    <div className="w-full">
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
          {label}
        </label>
      )}

      {/* Error message */}
      {error && (
        <div className="mb-2 px-3 py-2 text-sm text-[var(--color-error)] bg-[var(--color-error)]/10 rounded-[var(--radius-sm)]">
          {error}
        </div>
      )}

      <div
        className={`
          flex items-start gap-3
          p-3
          bg-[var(--color-surface)]
          border border-[var(--color-line)]
          rounded-[var(--radius-md)]
          transition-all duration-200
          ${isRecording ? 'border-[var(--color-error)]/50 ring-2 ring-[var(--color-error)]/20' : ''}
          focus-within:border-[var(--color-accent)]/50
          focus-within:ring-2
          focus-within:ring-[var(--color-accent)]/20
        `}
      >
        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={isRecording ? 'Listening...' : isProcessing ? 'Transcribing...' : placeholder}
          rows={3}
          className="
            flex-1
            min-h-[80px]
            py-2 px-1
            text-[16px] text-[var(--color-text)]
            placeholder:text-[var(--color-muted)]
            bg-transparent
            border-none
            resize-none
            focus:outline-none
            leading-relaxed
          "
        />

        {/* Mic button */}
        <MicButton
          state={recordingState}
          onToggle={toggleRecording}
          disabled={false}
        />
      </div>
    </div>
  );
}
