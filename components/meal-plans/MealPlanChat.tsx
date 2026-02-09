'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Loader2, Zap } from 'lucide-react';
import type { MealPlanEntry, DietGoal } from '@/lib/sessions/types';
import {
  chatWithMealPlanCoach,
  generateMealPlanFromChat,
  getMealPlanCoachGreeting,
} from '@/server/actions/meal-plan-suggestion.actions';
import { ChatInputBar } from '@/components/ui/ChatInputBar';
import { FixedInputContainer } from '@/components/ui/FixedInputContainer';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface GeneratedMealPlanData {
  name: string;
  description?: string;
  dietGoal: DietGoal;
  tdee: number;
  targetCalories: number;
  proteinPerKg?: number;
  rationale: string;
  targets: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
  };
  meals: MealPlanEntry[];
  bodyStats?: {
    weight: number;
    weightUnit: string;
    height?: number;
    heightUnit?: string;
    age?: number;
    gender?: string;
  };
}

interface MealPlanChatProps {
  onPlanGenerated: (plan: GeneratedMealPlanData, summary: string) => void;
  onCancel?: () => void;
}

export function MealPlanChat({ onPlanGenerated, onCancel }: MealPlanChatProps) {
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
        const { greeting } = await getMealPlanCoachGreeting();
        setMessages([{ role: 'assistant', content: greeting }]);
      } catch {
        setMessages([{ role: 'assistant', content: "What are your diet goals? Let's build a plan." }]);
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
      const { response } = await chatWithMealPlanCoach(trimmedInput, messages);
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
      setError('Describe your diet goals first.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const { mealPlan, summary, error: genError } = await generateMealPlanFromChat(messages);

      if (genError || !mealPlan) {
        setError(genError || 'Generation failed.');
        return;
      }

      setMessages(prev => [...prev, { role: 'assistant', content: summary }]);
      onPlanGenerated(mealPlan, summary);
    } catch {
      setError('Generation failed.');
    } finally {
      setIsGenerating(false);
    }
  }, [messages, onPlanGenerated]);

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
      <div className="flex-1 overflow-y-auto px-4 py-2 pb-24 space-y-2">
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

      {/* Fixed input at bottom */}
      <FixedInputContainer>
        <ChatInputBar
          value={input}
          onChange={setInput}
          onSubmit={handleSend}
          placeholder="Describe your diet goals..."
          disabled={isLoading || isGenerating}
          isLoading={isLoading}
        />

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={!canGenerate}
          className={`w-full mt-2 py-2 flex items-center justify-center gap-1.5 text-sm font-medium rounded-full transition-all ${
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
          Generate Plan
        </button>

        {onCancel && (
          <button
            onClick={onCancel}
            className="w-full mt-1 py-1.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]"
          >
            Cancel
          </button>
        )}
      </FixedInputContainer>
    </div>
  );
}
