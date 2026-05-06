'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Story } from './library';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
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

const THEME_CLASS: Record<ReaderTheme, string> = {
  light: 'theme-light',
  sepia: 'theme-parchment',
  dark: 'theme-dark',
};

const THEME_SWATCH_CLASS: Record<ReaderTheme, string> = {
  light: 'light',
  sepia: 'parchment',
  dark: 'dark',
};

function getYear(createdAt: any): string | null {
  try {
    if (!createdAt) return null;
    if (typeof createdAt?.toDate === 'function') {
      return String(createdAt.toDate().getFullYear());
    }
    if (createdAt instanceof Date) return String(createdAt.getFullYear());
    if (typeof createdAt === 'number') return String(new Date(createdAt).getFullYear());
  } catch {
    return null;
  }
  return null;
}

export function Reader({ story, onBack }: { story: Story; onBack: () => void }) {
  const { user } = useAuth();
  const { prefs, update } = useReaderPreferences();
  const [currentPage, setCurrentPage] = useState(story.currentPage || 0);
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  const pages = useMemo(() => {
    const elements = story.content.match(/<p[\s\S]*?<\/p>|<hr>/gi) || [];
    const result: string[] = [];
    for (let i = 0; i < elements.length; i += 4) {
      result.push(elements.slice(i, i + 4).join('\n'));
    }
    if (result.length === 0) result.push(story.content);
    return result;
  }, [story.content]);

  const totalPages = pages.length;

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

  const isTitlePage = currentPage === 0;
  const indicatorPct = totalPages <= 1 ? 0 : (currentPage / (totalPages - 1)) * 100;
  const year = getYear(story.createdAt);
  const pubLine = year ? `${story.source} · ${year}` : story.source;

  const bodyFontFamily =
    prefs.fontFamily === 'sans'
      ? 'system-ui, -apple-system, "Segoe UI", sans-serif'
      : "'Newsreader', Georgia, serif";

  const innerMaxWidth = MAX_WIDTH[prefs.margin];

  return (
    <div className={`sv-reader ${THEME_CLASS[prefs.theme]}`}>
      <div className="sv-reader-header">
        <button onClick={onBack} className="back" type="button">
          <ArrowLeft className="w-4 h-4" />
          Back to library
        </button>

        <div className="center-meta">
          {story.source}
          {story.wordCount !== undefined && ` · ${story.wordCount.toLocaleString()} words`}
        </div>

        <div className="right" ref={settingsRef}>
          <span className="pageno">
            page {currentPage + 1} of {totalPages}
          </span>
          <button
            onClick={() => setShowSettings((s) => !s)}
            className="aa-btn"
            type="button"
            aria-expanded={showSettings}
            title="Reading preferences"
          >
            <span className="small">A</span>
            <span className="large">a</span>
          </button>
          {showSettings && (
            <SettingsPopover
              prefs={prefs}
              onChange={update}
            />
          )}
        </div>
      </div>

      <div className="sv-reader-body">
        <div className="sv-reader-page" style={{ maxWidth: innerMaxWidth }}>
          <div
            className="running-head"
            style={!isTitlePage ? { borderBottom: '1px solid currentColor', paddingBottom: 12, marginBottom: 36, opacity: 0.4 } : undefined}
          >
            <span>{(story.author || '').toLowerCase()}</span>
            <span>{(story.title || '').toLowerCase()}</span>
          </div>

          {isTitlePage && (
            <>
              <div className="chapter-mark">— i —</div>
              <h1 className="story-title">{story.title}</h1>
              <div className="byline">by {story.author}</div>
              <div className="pub">{pubLine}</div>
              <div className="ornament-rule">· · · ·</div>
            </>
          )}

          <div
            className={`sv-reader-content${isTitlePage ? ' titlepage' : ''}`}
            style={{
              fontFamily: bodyFontFamily,
              fontSize: `${FONT_SIZE_PX[prefs.fontSize]}px`,
              lineHeight: LINE_HEIGHT[prefs.lineSpacing],
            }}
            dangerouslySetInnerHTML={{ __html: pages[currentPage] || '' }}
          />
        </div>
      </div>

      <div className="sv-reader-footer">
        <button
          type="button"
          onClick={() => handlePageChange(Math.max(0, currentPage - 1))}
          disabled={currentPage === 0}
          className="nav-btn"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>
        <div className="progress-track">
          <div className="indicator" style={{ left: `${indicatorPct}%` }} />
        </div>
        <button
          type="button"
          onClick={() => handlePageChange(Math.min(totalPages - 1, currentPage + 1))}
          disabled={currentPage === totalPages - 1}
          className="nav-btn"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
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
    <div className="sv-popover" role="dialog" aria-label="Reading preferences">
      <h4>Reading preferences</h4>
      <p className="pop-sub">set the type to your liking</p>
      <hr className="pop-rule" />

      <div className="row">
        <div className="row-label">Font size</div>
        <div className="sv-stepper">
          <button
            type="button"
            className="small"
            onClick={() => onChange({ fontSize: Math.max(0, prefs.fontSize - 1) })}
            disabled={prefs.fontSize <= 0}
            aria-label="Decrease font size"
          >
            A−
          </button>
          <span className="val">{FONT_SIZE_PX[prefs.fontSize]} px</span>
          <button
            type="button"
            className="large"
            onClick={() => onChange({ fontSize: Math.min(FONT_SIZE_PX.length - 1, prefs.fontSize + 1) })}
            disabled={prefs.fontSize >= FONT_SIZE_PX.length - 1}
            aria-label="Increase font size"
          >
            A+
          </button>
        </div>
      </div>

      <div className="row">
        <div className="row-label">Typeface</div>
        <div className="sv-seg">
          <button
            type="button"
            className={`opt${prefs.fontFamily === 'serif' ? ' active' : ''}`}
            style={{ fontFamily: "'Newsreader', Georgia, serif" }}
            onClick={() => onChange({ fontFamily: 'serif' as ReaderFontFamily })}
          >
            Serif
          </button>
          <button
            type="button"
            className={`opt${prefs.fontFamily === 'sans' ? ' active' : ''}`}
            style={{ fontFamily: 'system-ui, sans-serif' }}
            onClick={() => onChange({ fontFamily: 'sans' as ReaderFontFamily })}
          >
            Sans
          </button>
        </div>
      </div>

      <div className="row">
        <div className="row-label">Theme</div>
        <div className="sv-themes">
          {(['light', 'sepia', 'dark'] as ReaderTheme[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onChange({ theme: t })}
              className={`sv-theme-swatch ${THEME_SWATCH_CLASS[t]}${prefs.theme === t ? ' selected' : ''}`}
              aria-pressed={prefs.theme === t}
              aria-label={t === 'sepia' ? 'Parchment' : t}
            >
              Aa
            </button>
          ))}
        </div>
      </div>

      <div className="row">
        <div className="row-label">Line spacing</div>
        <div className="sv-seg">
          {(['tight', 'normal', 'loose'] as ReaderLineSpacing[]).map((v) => (
            <button
              key={v}
              type="button"
              className={`opt${prefs.lineSpacing === v ? ' active' : ''}`}
              onClick={() => onChange({ lineSpacing: v })}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="row">
        <div className="row-label">Margins</div>
        <div className="sv-seg">
          {(['narrow', 'normal', 'wide'] as ReaderMargin[]).map((v) => (
            <button
              key={v}
              type="button"
              className={`opt${prefs.margin === v ? ' active' : ''}`}
              onClick={() => onChange({ margin: v })}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
