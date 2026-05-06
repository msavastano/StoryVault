'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Story } from './library';
import { ArrowLeft, ChevronLeft, ChevronRight, Type } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/components/auth-provider';
import {
  useReaderPreferences,
  FONT_SIZE_PX,
  LINE_HEIGHT,
  MAX_WIDTH,
  ReaderTheme,
  ReaderFontFamily,
  ReaderLineSpacing,
  ReaderMargin,
} from '@/hooks/use-reader-preferences';

const THEME_CLASSES: Record<ReaderTheme, string> = {
  light: 'bg-[#fcfcfc] text-[#1a1a1a]',
  sepia: 'bg-[#f4ecd8] text-[#5b4636]',
  dark: 'bg-[#121212] text-[#e0e0e0]',
};

const THEME_SWATCH: Record<ReaderTheme, string> = {
  light: 'bg-[#fcfcfc] text-[#1a1a1a] border-gray-300',
  sepia: 'bg-[#f4ecd8] text-[#5b4636] border-[#d9c9a8]',
  dark: 'bg-[#121212] text-[#e0e0e0] border-gray-700',
};

export function Reader({ story, onBack }: { story: Story; onBack: () => void }) {
  const { user } = useAuth();
  const { prefs, update } = useReaderPreferences();
  const [currentPage, setCurrentPage] = useState(story.currentPage || 0);
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  const pages = useMemo(() => {
    const elements = story.content.match(/<p[\s\S]*?<\/p>|<hr>/gi) || [];
    const result = [];
    for (let i = 0; i < elements.length; i += 4) {
      result.push(elements.slice(i, i + 4).join('\n'));
    }
    if (result.length === 0) result.push(story.content);
    return result;
  }, [story.content]);

  useEffect(() => {
    if (currentPage >= pages.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentPage(Math.max(0, pages.length - 1));
    }
  }, [pages.length, currentPage]);

  useEffect(() => {
    if (!showSettings) return;
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSettings]);

  const handlePageChange = async (newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (!user) return;

    try {
      const storyRef = doc(db, `users/${user.uid}/stories/${story.id}`);
      await updateDoc(storyRef, { currentPage: newPage });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/stories/${story.id}`);
    }
  };

  const fontFamilyClass = prefs.fontFamily === 'serif' ? 'font-serif' : 'font-sans';

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 ${THEME_CLASSES[prefs.theme]}`}>
      <header className="px-6 py-4 flex items-center justify-between border-b border-current/10 sticky top-0 bg-inherit z-10">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-medium opacity-70 hover:opacity-100 transition-opacity"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Library
        </button>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex text-sm opacity-60">
            Page {currentPage + 1} of {pages.length}
          </div>
          <div ref={settingsRef} className="relative">
            <button
              onClick={() => setShowSettings((s) => !s)}
              className="p-2 rounded-full hover:bg-current/5 opacity-70 hover:opacity-100 transition-opacity flex items-center gap-1"
              title="Reading settings"
              aria-expanded={showSettings}
            >
              <Type className="w-4 h-4" />
              <span className="text-xs font-semibold tracking-tight">Aa</span>
            </button>
            {showSettings && (
              <SettingsPopover
                prefs={prefs}
                onChange={update}
              />
            )}
          </div>
        </div>
      </header>

      <main className={`flex-1 flex flex-col mx-auto w-full px-6 py-12 md:py-24 ${fontFamilyClass}`} style={{ maxWidth: MAX_WIDTH[prefs.margin] }}>
        <div className="mb-12 md:mb-16 text-center">
          <h1 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight leading-tight">{story.title}</h1>
          <p className="text-lg opacity-80 italic">{story.author}</p>
        </div>

        <div
          className="max-w-none [&_p]:mb-[1em] [&_em]:italic [&_strong]:font-semibold [&_hr]:my-10 [&_hr]:border-current/20"
          style={{
            fontSize: `${FONT_SIZE_PX[prefs.fontSize]}px`,
            lineHeight: LINE_HEIGHT[prefs.lineSpacing],
          }}
          dangerouslySetInnerHTML={{ __html: pages[currentPage] || '' }}
        />
      </main>

      <footer className="px-6 py-6 flex items-center justify-center gap-8 border-t border-current/10 bg-inherit sticky bottom-0 z-10">
        <button
          onClick={() => handlePageChange(Math.max(0, currentPage - 1))}
          disabled={currentPage === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-full hover:bg-current/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <ChevronLeft className="w-5 h-5" /> Previous
        </button>
        <span className="sm:hidden text-sm opacity-60">
          {currentPage + 1} / {pages.length}
        </span>
        <button
          onClick={() => handlePageChange(Math.min(pages.length - 1, currentPage + 1))}
          disabled={currentPage === pages.length - 1}
          className="flex items-center gap-2 px-4 py-2 rounded-full hover:bg-current/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          Next <ChevronRight className="w-5 h-5" />
        </button>
      </footer>
    </div>
  );
}

function SettingsPopover({
  prefs,
  onChange,
}: {
  prefs: ReturnType<typeof useReaderPreferences>['prefs'];
  onChange: (patch: Partial<ReturnType<typeof useReaderPreferences>['prefs']>) => void;
}) {
  return (
    <div
      className="absolute right-0 top-full mt-2 w-72 rounded-2xl shadow-xl border border-current/10 bg-white text-gray-900 p-4 z-20"
      role="dialog"
    >
      <Row label="Font size">
        <Stepper
          value={prefs.fontSize}
          min={0}
          max={FONT_SIZE_PX.length - 1}
          onChange={(fontSize) => onChange({ fontSize })}
          renderValue={(v) => `${FONT_SIZE_PX[v]}px`}
        />
      </Row>

      <Row label="Font">
        <SegmentedToggle<ReaderFontFamily>
          value={prefs.fontFamily}
          options={[
            { value: 'serif', label: 'Serif', className: 'font-serif' },
            { value: 'sans', label: 'Sans', className: 'font-sans' },
          ]}
          onChange={(fontFamily) => onChange({ fontFamily })}
        />
      </Row>

      <Row label="Theme">
        <div className="flex gap-2">
          {(['light', 'sepia', 'dark'] as ReaderTheme[]).map((t) => (
            <button
              key={t}
              onClick={() => onChange({ theme: t })}
              className={`flex-1 py-3 rounded-lg border-2 text-sm font-medium transition-all ${THEME_SWATCH[t]} ${prefs.theme === t ? 'ring-2 ring-indigo-500 ring-offset-2' : 'opacity-70 hover:opacity-100'}`}
              aria-pressed={prefs.theme === t}
            >
              Aa
            </button>
          ))}
        </div>
      </Row>

      <Row label="Line spacing">
        <SegmentedToggle<ReaderLineSpacing>
          value={prefs.lineSpacing}
          options={[
            { value: 'tight', label: 'Tight' },
            { value: 'normal', label: 'Normal' },
            { value: 'loose', label: 'Loose' },
          ]}
          onChange={(lineSpacing) => onChange({ lineSpacing })}
        />
      </Row>

      <Row label="Margins" last>
        <SegmentedToggle<ReaderMargin>
          value={prefs.margin}
          options={[
            { value: 'narrow', label: 'Narrow' },
            { value: 'normal', label: 'Normal' },
            { value: 'wide', label: 'Wide' },
          ]}
          onChange={(margin) => onChange({ margin })}
        />
      </Row>
    </div>
  );
}

function Row({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={last ? '' : 'mb-4 pb-4 border-b border-gray-100'}>
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{label}</div>
      {children}
    </div>
  );
}

function Stepper({
  value,
  min,
  max,
  onChange,
  renderValue,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  renderValue: (v: number) => string;
}) {
  return (
    <div className="flex items-center justify-between bg-gray-100 rounded-lg p-1">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="px-3 py-1.5 rounded-md hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium"
        aria-label="Decrease"
      >
        A−
      </button>
      <span className="text-sm font-medium tabular-nums">{renderValue(value)}</span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="px-3 py-1.5 rounded-md hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed text-base font-medium"
        aria-label="Increase"
      >
        A+
      </button>
    </div>
  );
}

function SegmentedToggle<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; className?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${opt.className || ''} ${value === opt.value ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
          aria-pressed={value === opt.value}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
