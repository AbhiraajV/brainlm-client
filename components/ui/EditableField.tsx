'use client';

import { useState, useRef, useEffect } from 'react';

// ============================================================================
// EDITABLE NUMBER
// ============================================================================

export function EditableNumber({
  value,
  onConfirm,
  className,
  inputClassName,
}: {
  value: number;
  onConfirm: (v: number) => void;
  className?: string;
  inputClassName?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(String(value));
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { setEditVal(String(value)); }, [value]);
  useEffect(() => { if (editing) ref.current?.select(); }, [editing]);

  const confirm = () => {
    const num = parseInt(editVal);
    if (!isNaN(num) && num >= 0) onConfirm(num);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={ref}
        type="number"
        value={editVal}
        onChange={(e) => setEditVal(e.target.value)}
        onBlur={confirm}
        onKeyDown={(e) => { if (e.key === 'Enter') confirm(); }}
        className={inputClassName || 'w-16 text-center bg-transparent border-b border-[var(--color-lime)] outline-none text-sm font-medium text-[var(--color-text)]'}
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={className || 'text-sm font-medium text-[var(--color-text)] border-b border-dashed border-transparent hover:border-[var(--color-lime)]/50'}
    >
      {value}
    </button>
  );
}

// ============================================================================
// EDITABLE SELECT
// ============================================================================

export function EditableSelect({
  value,
  options,
  onConfirm,
  className,
}: {
  value: string;
  options: { value: string; label: string }[];
  onConfirm: (v: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLSelectElement>(null);

  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  const handleChange = (newVal: string) => {
    onConfirm(newVal);
    setEditing(false);
  };

  if (editing) {
    return (
      <select
        ref={ref}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => setEditing(false)}
        className="bg-[var(--color-surface)] border border-[var(--color-lime)] outline-none text-sm text-[var(--color-text)] px-1 py-0.5"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  }

  const display = options.find(o => o.value === value)?.label ?? value;
  return (
    <button
      onClick={() => setEditing(true)}
      className={className || 'text-sm text-[var(--color-text)] border-b border-dashed border-transparent hover:border-[var(--color-lime)]/50'}
    >
      {display}
    </button>
  );
}

// ============================================================================
// EDITABLE TEXT
// ============================================================================

export function EditableText({
  value,
  onConfirm,
  placeholder,
  className,
}: {
  value: string;
  onConfirm: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { setEditVal(value); }, [value]);
  useEffect(() => { if (editing) ref.current?.select(); }, [editing]);

  const confirm = () => {
    onConfirm(editVal.trim());
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={ref}
        type="text"
        value={editVal}
        onChange={(e) => setEditVal(e.target.value)}
        onBlur={confirm}
        onKeyDown={(e) => { if (e.key === 'Enter') confirm(); }}
        placeholder={placeholder}
        className="bg-transparent border-b border-[var(--color-lime)] outline-none text-sm text-[var(--color-text)] w-full"
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={className || 'text-sm text-[var(--color-text)] border-b border-dashed border-transparent hover:border-[var(--color-lime)]/50 text-left'}
    >
      {value || <span className="text-[var(--color-muted)]">{placeholder || 'Click to edit'}</span>}
    </button>
  );
}
