'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useTemplatesStore } from '@/store/templates.store';
import { useHydrated } from '@/hooks/useHydrated';
import { TemplateCard } from '@/components/templates';
import { BackButton } from '@/components/ui/BackButton';

export default function TemplatesPage() {
  const hydrated = useHydrated();
  const router = useRouter();
  const templatesMap = useTemplatesStore((s) => s.templates);
  const templateIds = useTemplatesStore((s) => s.templateIds);
  const templates = useMemo(
    () => templateIds.map((id) => templatesMap[id]).filter(Boolean),
    [templateIds, templatesMap]
  );
  const deleteTemplate = useTemplatesStore((s) => s.deleteTemplate);
  const createTemplate = useTemplatesStore((s) => s.createTemplate);

  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const handleCreateNew = () => {
    if (!newName.trim()) return;
    const id = createTemplate({
      name: newName.trim(),
      exercises: [],
      muscleGroups: [],
    });
    setNewName('');
    setIsCreating(false);
    router.push(`/templates/${id}`);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this template?')) {
      deleteTemplate(id);
    }
  };

  if (!hydrated) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
        <header className="h-12 flex items-center px-4 border-b border-[var(--color-line)]">
          <span className="text-sm font-medium text-[var(--color-text)]">Templates</span>
        </header>
        <main className="flex-1 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-[var(--color-line)] border-t-[var(--color-lime)] rounded-full animate-spin" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
      {/* Header */}
      <header className="sticky top-0 z-10 h-12 flex items-center justify-between px-4 border-b border-[var(--color-line)] bg-[var(--color-bg)]">
        <span className="text-sm font-medium text-[var(--color-text)]">Templates</span>
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-1 px-2 py-1 text-[11px] text-[var(--color-lime)] border border-[var(--color-lime)]/30 hover:bg-[var(--color-lime)]/10"
          >
            <Plus className="w-3 h-3" />
            New
          </button>
        )}
      </header>

      {/* Create form */}
      {isCreating && (
        <div className="px-4 py-3 border-b border-[var(--color-line)]">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Template name..."
            className="w-full px-2.5 py-2 text-sm bg-transparent border border-[var(--color-line)] focus:outline-none focus:border-[var(--color-lime)]/50"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleCreateNew()}
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => { setIsCreating(false); setNewName(''); }}
              className="px-2 py-1 text-xs text-[var(--color-muted)]"
            >
              cancel
            </button>
            <button
              onClick={handleCreateNew}
              disabled={!newName.trim()}
              className="px-2 py-1 text-xs text-[var(--color-lime)] disabled:opacity-40"
            >
              create
            </button>
          </div>
        </div>
      )}

      {/* Templates list */}
      <main className="flex-1">
        {templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 px-4">
            <p className="text-sm text-[var(--color-muted)]">No templates</p>
            <p className="text-xs text-[var(--color-muted)]/60 mt-1">
              Create one to get started
            </p>
          </div>
        ) : (
          <div>
            {templates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onClick={() => router.push(`/templates/${template.id}`)}
                onDelete={() => handleDelete(template.id)}
              />
            ))}
          </div>
        )}
      </main>

      <BackButton />
    </div>
  );
}
