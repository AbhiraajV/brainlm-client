'use client';

import { useState } from 'react';
import { Check, AlertCircle } from 'lucide-react';
import { ChatInputBar } from '@/components/ui/ChatInputBar';

interface TrackerInputProps {
  sessionId: string;
  trackerType: 'gym' | 'diet';
  isProcessing: boolean;
  onSubmit: (text: string) => void;
  statusMessage?: string | null;
  statusType?: 'success' | 'error' | 'info' | null;
}

export function TrackerInput({
  trackerType,
  isProcessing,
  onSubmit,
  statusMessage,
  statusType,
}: TrackerInputProps) {
  const [value, setValue] = useState('');

  const handleSubmit = () => {
    if (!value.trim() || isProcessing) return;

    const text = value.trim();
    setValue('');
    onSubmit(text);
  };

  const placeholder = trackerType === 'gym'
    ? 'bench 80kg x 8, another set, remove last...'
    : 'eggs and toast for breakfast, protein shake...';

  return (
    <ChatInputBar
      value={value}
      onChange={setValue}
      onSubmit={handleSubmit}
      placeholder={placeholder}
      disabled={isProcessing}
      isLoading={isProcessing}
      statusToast={
        statusMessage ? (
          <div className={`
            flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg text-xs
            transition-all duration-300
            ${statusType === 'success' ? 'bg-[var(--color-lime)]/10 text-[var(--color-lime)]' : ''}
            ${statusType === 'error' ? 'bg-red-500/10 text-red-400' : ''}
            ${statusType === 'info' ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]' : ''}
          `}>
            {statusType === 'success' && <Check className="w-3 h-3" />}
            {statusType === 'error' && <AlertCircle className="w-3 h-3" />}
            <span>{statusMessage}</span>
          </div>
        ) : undefined
      }
    />
  );
}
