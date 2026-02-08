'use client';

import { useRef } from 'react';
import { Loader2 } from 'lucide-react';

export interface GeneratePromptAreaProps {
  title: string;
  subtitle?: string;
  helperText: string;
  placeholder: string;
  chips: { label: string; text: string }[];
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  submitLabel: string;
  submitIcon: React.ReactNode;
  isLoading: boolean;
  loadingLabel?: string;
  error?: string | null;
  variant?: 'primary' | 'outline';
}

export const EXERCISE_GENERATION_CHIPS = [
  { label: 'Compounds', text: 'Focus on compound movements' },
  { label: 'No machines', text: 'Avoid machines, use free weights only' },
  { label: 'Supersets', text: 'Include supersets where possible' },
  { label: 'Heavy strength', text: 'Prioritize heavy sets in the 3-6 rep range' },
  { label: 'High volume', text: 'Use high volume (4+ sets per exercise)' },
  { label: 'Time efficient', text: 'Keep exercises time-efficient with minimal rest' },
  { label: 'Injury...', text: 'I have an injury: ' },
];

export const PLAN_EDIT_CHIPS = [
  { label: 'Add rest day', text: 'Add a rest day' },
  { label: 'More upper body', text: 'Add more upper body training' },
  { label: 'More legs', text: 'Add more leg-focused training' },
  { label: 'Fewer days', text: 'Reduce training days to ' },
  { label: 'Add cardio', text: 'Add a dedicated cardio day' },
  { label: 'Switch to PPL', text: 'Change the split to Push/Pull/Legs' },
];

export function GeneratePromptArea({
  title,
  subtitle,
  helperText,
  placeholder,
  chips,
  value,
  onChange,
  onSubmit,
  submitLabel,
  submitIcon,
  isLoading,
  loadingLabel,
  error,
  variant = 'primary',
}: GeneratePromptAreaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChipClick = (chipText: string) => {
    const separator = value.trim() ? '. ' : '';
    onChange(value + separator + chipText);
    textareaRef.current?.focus();
  };

  const isPrimary = variant === 'primary';

  return (
    <div className="px-4 py-4 space-y-2.5">
      {/* Title row */}
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-bold uppercase tracking-wide text-[var(--color-lime)]">
          {title}
        </span>
        {subtitle && (
          <span className="text-[11px] text-[var(--color-muted)]">{subtitle}</span>
        )}
      </div>

      {/* Helper text */}
      <p className="text-[11px] text-[var(--color-muted)]/70">{helperText}</p>

      {/* Chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
        {chips.map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={() => handleChipClick(chip.text)}
            disabled={isLoading}
            className="shrink-0 px-2.5 py-1 text-[11px] rounded-full border border-[var(--color-line)] text-[var(--color-muted)] hover:border-[var(--color-lime)] hover:text-[var(--color-lime)] transition-colors disabled:opacity-40"
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={isLoading}
        className="w-full px-3 py-2 text-sm bg-[var(--color-surface)] border border-[var(--color-line)] rounded resize-none focus:outline-none focus:border-[var(--color-lime)] placeholder:text-[var(--color-muted)]/50 disabled:opacity-50"
      />

      {/* Submit button */}
      <button
        onClick={onSubmit}
        disabled={isLoading}
        className={`flex items-center justify-center gap-2 w-full py-2.5 px-4 text-sm font-medium transition-colors disabled:opacity-60 ${
          isPrimary
            ? 'bg-[var(--color-lime)] text-[var(--color-bg)] hover:bg-[var(--color-lime)]/90'
            : 'border border-[var(--color-lime)] text-[var(--color-lime)] hover:bg-[var(--color-lime)]/10'
        }`}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {loadingLabel || 'Generating...'}
          </>
        ) : (
          <>
            {submitIcon}
            {submitLabel}
          </>
        )}
      </button>

      {/* Error */}
      {error && (
        <p className="text-[11px] text-[var(--color-coral)]">{error}</p>
      )}
    </div>
  );
}
