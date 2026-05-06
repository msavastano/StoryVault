'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/auth-provider';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { fetchArticleContent } from '@/lib/fetchHtml';
import { GoogleGenAI, Type } from '@google/genai';
import { Reader } from '@/components/reader';
import { LogOut, Plus, Trash2, ExternalLink } from 'lucide-react';
import { Wordmark } from '@/components/wordmark';

export interface Story {
  id: string;
  title: string;
  author: string;
  source: string;
  sourceUrl?: string;
  content: string;
  wordCount?: number;
  totalPages?: number;
  currentPage?: number;
  createdAt: any;
}

const LOADING_QUIPS = [
  'Bribing the web scraper...',
  'Explaining literature to the AI...',
  'Removing annoying ads...',
  'Negotiating with CSS classes...',
  'Teaching the models how to read...',
  'Counting words, one by one...',
  'Translating metaphors...',
  'Converting <div>s to <p>s with a hammer...',
];

type FilterKey = 'recent' | 'in-progress' | 'finished' | 'by-author';

const NUMBER_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five',
  'six', 'seven', 'eight', 'nine', 'ten',
];

function titleCount(n: number): string {
  if (n === 0) return 'no titles';
  const word = n <= 10 ? NUMBER_WORDS[n] : String(n);
  return `— ${word} ${n === 1 ? 'title' : 'titles'}`;
}

function progressPct(current: number, total: number): number {
  if (total <= 1) return current === 0 ? 0 : 100;
  return Math.round((current / (total - 1)) * 100);
}

export default function AppMain() {
  const { user, logOut } = useAuth();
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [stories, setStories] = useState<Story[]>([]);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('recent');

  useEffect(() => {
    if (!loading) {
      setLoadingStep(0);
      return;
    }
    const interval = setInterval(() => {
      setLoadingStep(s => (s + 1) % LOADING_QUIPS.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, `users/${user.uid}/stories`),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedStories: Story[] = [];
        snapshot.forEach((doc) => {
          fetchedStories.push({ id: doc.id, ...doc.data() } as Story);
        });
        setStories(fetchedStories);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}/stories`);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleAddStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim() || !user) return;

    setLoading(true);
    setErrorMsg(null);
    try {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('Missing Gemini API Key in the environment. Please configure it.');
      }

      const fetchResult = await fetchArticleContent(urlInput);
      if (!fetchResult.ok) {
        throw new Error(fetchResult.message);
      }
      const articleContent = fetchResult.content;

      const ai = new GoogleGenAI({ apiKey });

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-preview',
        contents: [
          {
            text: `You are an expert text extractor. I will provide article content (typically markdown, sometimes HTML) from a short story magazine. Extract the title, author, source magazine, and the main story content. Format the story content as clean, normalized HTML using ONLY <p>, <em>, <strong>, and <hr> tags. Strip any author bio, comments, navigation, or non-story content. Return a raw JSON object with the exact keys: title, author, source, and content.\n\nSOURCE CONTENT:\n${articleContent.substring(0, 200000)}`,
          },
        ],
        config: {
          responseMimeType: 'application/json',
          maxOutputTokens: 32768,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              author: { type: Type.STRING },
              source: { type: Type.STRING },
              content: { type: Type.STRING },
            },
            required: ['title', 'author', 'source', 'content'],
          },
        },
      });

      const finishReason = response.candidates?.[0]?.finishReason;
      if (finishReason && finishReason !== 'STOP') {
        throw new Error(
          finishReason === 'MAX_TOKENS'
            ? 'The story was too long for the AI to extract in one pass. Try a shorter story, or contact the developer to raise the output cap.'
            : `AI extraction stopped unexpectedly (finishReason: ${finishReason}).`,
        );
      }

      const jsonStr = response.text?.trim();
      if (!jsonStr) throw new Error('Failed to parse content with AI');

      const extracted = JSON.parse(jsonStr) as {
        title: string;
        author: string;
        source: string;
        content: string;
      };

      const elements = extracted.content.match(/<p[\s\S]*?<\/p>|<hr>/gi) || [];
      const totalPages = Math.ceil((elements.length === 0 ? 1 : elements.length) / 4);
      const wordCount = extracted.content.replace(/<[^>]*>?/gm, ' ').split(/\s+/).filter(w => w.length > 0).length;

      const payload = {
        title: extracted.title,
        author: extracted.author,
        source: extracted.source,
        sourceUrl: urlInput.trim(),
        content: extracted.content,
        wordCount,
        totalPages,
        currentPage: 0,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, `users/${user.uid}/stories`), payload);
      setUrlInput('');
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : 'Failed to extract story. See console for details.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, storyId: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/stories`, storyId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/stories/${storyId}`);
    }
  };

  const visibleStories = useMemo(() => {
    const list = [...stories];
    if (filter === 'in-progress') {
      return list.filter((s) => {
        const total = s.totalPages || 1;
        const current = s.currentPage || 0;
        if (total <= 1) return false;
        return current > 0 && current < total - 1;
      });
    }
    if (filter === 'finished') {
      return list.filter((s) => {
        const total = s.totalPages || 1;
        const current = s.currentPage || 0;
        if (total <= 1) return false;
        return current >= total - 1;
      });
    }
    if (filter === 'by-author') {
      return list.sort((a, b) => (a.author || '').localeCompare(b.author || ''));
    }
    return list;
  }, [stories, filter]);

  if (selectedStory) {
    return <Reader story={selectedStory} onBack={() => setSelectedStory(null)} />;
  }

  const filters: { key: FilterKey; label: string }[] = [
    { key: 'recent', label: 'Recent' },
    { key: 'in-progress', label: 'In progress' },
    { key: 'finished', label: 'Finished' },
    { key: 'by-author', label: 'By author' },
  ];

  return (
    <div className="sv-lib">
      <div className="sv-lib-header">
        <div className="left">
          <Wordmark size={22} />
          <span className="vol">a private reading room</span>
        </div>
        <div className="right">
          <span className="email">{user?.email}</span>
          <button onClick={logOut} className="icon-btn" title="Sign out" aria-label="Sign out">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="sv-lib-body">
        <div className="sv-intake">
          <div className="intake-head">
            <h2>Add a story to your library</h2>
            <span className="intake-meta">accession · automatic</span>
          </div>
          <form onSubmit={handleAddStory}>
            <div className="input-wrap">
              <span className="prefix">URL</span>
              <input
                type="url"
                required
                placeholder="https://lightspeedmagazine.com/fiction/…"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                disabled={loading}
              />
            </div>
            <button type="submit" className="add-btn" disabled={loading}>
              {loading ? (
                <>
                  <span className="spin" />
                  {LOADING_QUIPS[loadingStep]}
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Catalogue
                </>
              )}
            </button>
          </form>
          {errorMsg && <div className="err">{errorMsg}</div>}
        </div>

        <div className="sv-lib-section-head">
          <h2>
            Your library
            <span className="num">{titleCount(visibleStories.length)}</span>
          </h2>
          <div className="filters">
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                className={`item${filter === f.key ? ' active' : ''}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {visibleStories.length === 0 ? (
          <div className="sv-empty">
            <p className="line1">Your shelf is empty.</p>
            <p className="line2">Paste a URL to begin your library.</p>
          </div>
        ) : (
          <div className="sv-grid">
            {visibleStories.map((story, i) => {
              const total = story.totalPages || 1;
              const current = story.currentPage || 0;
              const pct = progressPct(current, total);
              const pctText =
                pct === 100
                  ? 'finished'
                  : pct === 0
                  ? 'unread'
                  : `${pct}% · p. ${current + 1} of ${total}`;
              return (
                <div
                  key={story.id}
                  role="button"
                  tabIndex={0}
                  className="sv-card"
                  onClick={() => setSelectedStory(story)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedStory(story);
                    }
                  }}
                >
                  <span className="corner-num">№ {String(i + 1).padStart(2, '0')}</span>
                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, story.id)}
                    className="delete-btn"
                    title="Delete story"
                    aria-label="Delete story"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <div className="source-overline">
                    <span>{story.source}</span>
                    {story.sourceUrl && (
                      <a
                        href={story.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="Open original article"
                      >
                        <ExternalLink style={{ width: 11, height: 11 }} />
                      </a>
                    )}
                  </div>
                  <h3 className="title">{story.title}</h3>
                  <div className="author">{story.author}</div>
                  <div className="meta-foot">
                    <div className="progress">
                      <div className="bar" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="meta-row">
                      <span className="pct">{pctText}</span>
                      {story.wordCount !== undefined && (
                        <span className="words">{story.wordCount.toLocaleString()} words</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
