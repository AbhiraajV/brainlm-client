'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Zap } from 'lucide-react';
import type { WorkoutTemplate } from '@/lib/sessions/types';
import {
  chatWithTemplateCoach,
  generateTemplateFromChat,
  getTemplateCoachGreeting,
} from '@/server/actions/template-suggestion.actions';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface TemplateChatProps {
  onTemplateGenerated: (
    template: Omit<WorkoutTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>,
    summary: string
  ) => void;
  onCancel?: () => void;
}

export function TemplateChat({ onTemplateGenerated, onCancel }: TemplateChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasGreeted, setHasGreeted] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (hasGreeted) return;
    const fetchGreeting = async () => {
      setHasGreeted(true);
      try {
        const { greeting } = await getTemplateCoachGreeting();
        setMessages([{ role: 'assistant', content: greeting }]);
      } catch {
        setMessages([{ role: 'assistant', content: "What type of workout are you planning?" }]);
      }
    };
    fetchGreeting();
  }, [hasGreeted]);

  const handleSend = useCallback(async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: trimmedInput };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const { response } = await chatWithTemplateCoach(trimmedInput, messages);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch {
      setError('Failed to get response.');
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [input, isLoading, messages]);

  const handleGenerate = useCallback(async () => {
    if (messages.length < 2) {
      setError('Describe your workout first.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const { template, summary, error: genError } = await generateTemplateFromChat(messages);

      if (genError || !template) {
        setError(genError || 'Generation failed.');
        return;
      }

      setMessages(prev => [...prev, { role: 'assistant', content: summary }]);
      onTemplateGenerated(template, summary);
    } catch {
      setError('Generation failed.');
    } finally {
      setIsGenerating(false);
    }
  }, [messages, onTemplateGenerated]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canGenerate = messages.length >= 2 && !isLoading && !isGenerating;

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-2.5 py-1.5 text-[13px] ${
                message.role === 'user'
                  ? 'bg-[var(--color-lime)]/15 text-[var(--color-lime)] border border-[var(--color-lime)]/30'
                  : 'text-[var(--color-text)]'
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="px-2.5 py-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--color-muted)]" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-1.5 text-[11px] text-[var(--color-coral)]">
          {error}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-[var(--color-line)] p-3">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your workout..."
            disabled={isLoading || isGenerating}
            className="flex-1 px-2.5 py-2 text-sm bg-transparent border border-[var(--color-line)] focus:outline-none focus:border-[var(--color-lime)]/50 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || isGenerating}
            className="px-2.5 py-2 border border-[var(--color-line)] text-[var(--color-muted)] disabled:opacity-30 hover:border-[var(--color-lime)]/50 hover:text-[var(--color-lime)] transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className={`px-3 py-2 flex items-center gap-1.5 text-sm font-medium transition-all ${
              canGenerate
                ? 'bg-[var(--color-lime)] text-[var(--color-bg)] hover:bg-[var(--color-lime)]/90'
                : 'border border-[var(--color-line)] text-[var(--color-muted)] opacity-40'
            }`}
          >
            {isGenerating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">Generate</span>
          </button>
        </div>

        {onCancel && (
          <button
            onClick={onCancel}
            className="w-full mt-2 py-1.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
