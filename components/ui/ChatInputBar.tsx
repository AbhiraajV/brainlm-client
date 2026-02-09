'use client';

import { useRef, useLayoutEffect, useEffect, type ReactNode } from 'react';
import { ArrowUp, Loader2 } from 'lucide-react';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

interface ChatInputBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  leftSlot?: ReactNode;
  statusToast?: ReactNode;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export function ChatInputBar({
  value,
  onChange,
  onSubmit,
  placeholder = 'Type a message...',
  disabled = false,
  isLoading = false,
  leftSlot,
  statusToast,
  onKeyDown: onKeyDownProp,
}: ChatInputBarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useIsomorphicLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const maxHeight = 96; // ~4 lines
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (onKeyDownProp) {
      onKeyDownProp(e);
      if (e.defaultPrevented) return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="w-full">
      {statusToast}

      <div
        className={`
          flex items-end gap-2
          pl-3 pr-1.5 py-1.5
          bg-[var(--color-surface)]
          border border-[var(--color-line)]
          rounded-full
        `}
      >
        {leftSlot}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          rows={1}
          className="
            flex-1
            py-1 px-0
            text-[16px] text-[var(--color-text)]
            placeholder:text-[var(--color-muted)]
            bg-transparent
            border-none outline-none
            resize-none
            focus:outline-none focus:ring-0 focus:border-none
            focus-visible:outline-none
            disabled:opacity-50
            leading-normal
          "
          style={{ boxShadow: 'none', border: 'none', outline: 'none' }}
        />

        <button
          type="button"
          onClick={onSubmit}
          disabled={!value.trim() || disabled || isLoading}
          className="
            flex-shrink-0
            w-8 h-8
            flex items-center justify-center
            rounded-full
            bg-[var(--color-accent)]
            text-white
            transition-opacity duration-200
            hover:opacity-90
            focus:outline-none
            disabled:opacity-40
            disabled:cursor-not-allowed
          "
          aria-label="Send"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ArrowUp className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}
