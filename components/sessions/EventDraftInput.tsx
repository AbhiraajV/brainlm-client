'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { Plus } from 'lucide-react';

interface EventDraftInputProps {
  onAdd: (content: string) => void;
}

export function EventDraftInput({ onAdd }: EventDraftInputProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed) {
      onAdd(trimmed);
      setValue('');
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add an event..."
        className="
          flex-1 px-3 py-2
          bg-[var(--color-bg)]
          border border-[var(--color-line)]
          rounded-[var(--radius-sm)]
          text-[0.9375rem] text-[var(--color-text)]
          placeholder:text-[var(--color-muted)]
          transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-1
        "
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!value.trim()}
        className="
          p-2
          bg-[var(--color-accent)] text-white
          rounded-[var(--radius-sm)]
          transition-all duration-200
          hover:bg-[var(--color-accent-dark)]
          focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2
          disabled:opacity-50 disabled:cursor-not-allowed
          active:scale-95
        "
        aria-label="Add event"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}
