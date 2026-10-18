'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';

export interface ManualStoryValues {
  title: string;
  author: string;
  source: string;
  text: string;
}

interface Props {
  onSave: (values: ManualStoryValues) => Promise<void>;
  onCancel: () => void;
}

// Shown when a story can't be fetched or extracted automatically: the reader
// pastes the text in themselves and it is saved without going through the AI.
export function ManualStoryForm({ onSave, onCancel }: Props) {
  const [values, setValues] = useState<ManualStoryValues>({ title: '', author: '', source: '', text: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof ManualStoryValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const canSave = values.title.trim() !== '' && values.text.trim() !== '' && !saving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(values);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to save the story.');
      setSaving(false);
    }
  };

  return (
    <form className="manual-form" onSubmit={handleSubmit}>
      <div className="manual-head">
        <h3>Add it manually</h3>
        <span className="intake-meta">copy the story from the page and paste it below</span>
      </div>
      <div className="manual-fields">
        <div className="input-wrap">
          <span className="prefix">TITLE</span>
          <input required maxLength={1000} value={values.title} onChange={set('title')} placeholder="Story title" disabled={saving} />
        </div>
        <div className="input-wrap">
          <span className="prefix">AUTHOR</span>
          <input maxLength={1000} value={values.author} onChange={set('author')} placeholder="Unknown" disabled={saving} />
        </div>
        <div className="input-wrap">
          <span className="prefix">MAGAZINE</span>
          <input maxLength={2000} value={values.source} onChange={set('source')} placeholder="Clarkesworld, Uncanny…" disabled={saving} />
        </div>
      </div>
      <textarea
        required
        value={values.text}
        onChange={set('text')}
        placeholder="Paste the story text here. Leave a blank line between paragraphs; a line of * * * marks a scene break."
        disabled={saving}
      />
      {error && <div className="err">{error}</div>}
      <div className="manual-actions">
        <button type="submit" className="add-btn" disabled={!canSave}>
          {saving ? <span className="spin" /> : <Check className="w-4 h-4" />}
          Save story
        </button>
        <button type="button" className="add-btn ghost" onClick={onCancel} disabled={saving}>
          <X className="w-4 h-4" />
          Cancel
        </button>
      </div>
    </form>
  );
}
