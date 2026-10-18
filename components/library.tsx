'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/auth-provider';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { fetchArticleContent, type FetchAttempt } from '@/lib/fetchHtml';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { Reader } from '@/components/reader';
import { LogOut, Plus, Trash2, ExternalLink, KeyRound, Check, X, PenLine } from 'lucide-react';
import { Wordmark } from '@/components/wordmark';
import { useGeminiKey } from '@/hooks/use-gemini-key';
import { countWords, paginateStory, savedPage } from '@/lib/paginate';
import { plainTextToStoryHtml } from '@/lib/manual-story';
import { ManualStoryForm, type ManualStoryValues } from '@/components/manual-story-form';

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

// The story comes back out as output, so the output cap is what limits story
// length, not the 1M-token input window. 65,536 is Gemini 3.1 Flash-Lite's
// maximum, and thinking tokens count against it, so thinking stays at MINIMAL
// (Google's recommended level for extraction). That fits roughly 40,000 words.
const MAX_OUTPUT_TOKENS = 65536;
// About 50,000 words of source markdown, sized so a story that fits the output
// cap isn't silently cut off on the way in.
const MAX_SOURCE_CHARS = 300_000;

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

// Matches the `content` cap in firestore.rules (isValidStory).
const MAX_CONTENT_CHARS = 900_000;

// An add-story failure. `offerManual` is set when the story was never saved
// because fetching or AI extraction failed, so pasting the text in by hand
// gets around it. It stays off when saving itself failed.
interface AddError {
  message: string;
  attempts?: FetchAttempt[];
  offerManual: boolean;
  url?: string;
}

class AddStoryError extends Error {
  constructor(message: string, readonly attempts?: FetchAttempt[]) {
    super(message);
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

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
  const { apiKey, hasKey, setApiKey, clearApiKey } = useGeminiKey();
  const [keyInput, setKeyInput] = useState('');
  const [editingKey, setEditingKey] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [stories, setStories] = useState<Story[]>([]);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [addError, setAddError] = useState<AddError | null>(null);
  // The URL the manual form is adding a story for; null while it is closed.
  const [manualUrl, setManualUrl] = useState<string | null>(null);
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

  const saveStory = async (
    story: { title: string; author: string; source: string; content: string },
    sourceUrl: string,
  ) => {
    if (!user) throw new Error('Sign in to save stories.');
    await addDoc(collection(db, `users/${user.uid}/stories`), {
      title: story.title,
      author: story.author,
      source: story.source,
      sourceUrl,
      content: story.content,
      wordCount: countWords(story.content),
      totalPages: paginateStory(story.content).length,
      currentPage: 0,
      createdAt: serverTimestamp(),
    });
  };

  const handleAddStory = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = urlInput.trim();
    if (!url || !user) return;

    if (!apiKey) {
      setAddError({ message: 'Add your Gemini API key above before cataloguing a story.', offerManual: false });
      return;
    }

    setLoading(true);
    setAddError(null);
    setManualUrl(null);
    let saving = false;
    try {
      const fetchResult = await fetchArticleContent(url);
      if (!fetchResult.ok) {
        throw new AddStoryError(`Couldn't fetch the story from ${hostOf(url)}.`, fetchResult.attempts);
      }
      const articleContent = fetchResult.content;

      const ai = new GoogleGenAI({ apiKey });

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: [
          {
            text: `You are an expert text extractor. I will provide article content (typically markdown, sometimes HTML) from a short story magazine. Extract the title, author, source magazine, and the main story content.

To find the author: many magazines print a byline immediately after the title in the form "_by_[Author Name](url)" and repeat it in a copyright line like "© 2025 by Author Name." When these are present, use them and copy the author name exactly as written, preserving any accents or diacritics. If they are not present, infer the author from whatever byline, header, or attribution the source provides. Never guess or invent an author who is not in the source; only use "Unknown" if the source contains no author attribution at all.

Format the story content as clean, normalized HTML using ONLY <p>, <em>, <strong>, and <hr> tags. Strip any author bio, comments, navigation, or non-story content. Return a raw JSON object with the exact keys: title, author, source, and content.\n\nSOURCE CONTENT:\n${articleContent.substring(0, MAX_SOURCE_CHARS)}`,
          },
        ],
        config: {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.MINIMAL,
          },
          responseMimeType: 'application/json',
          maxOutputTokens: MAX_OUTPUT_TOKENS,
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
            ? 'This story is too long for the AI to extract in one pass (the limit is roughly 40,000 words).'
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

      saving = true;
      await saveStory(extracted, url);
      setUrlInput('');
    } catch (err) {
      console.error(err);
      setAddError({
        message: err instanceof Error ? err.message : 'Failed to extract story. See console for details.',
        attempts: err instanceof AddStoryError ? err.attempts : undefined,
        offerManual: !saving,
        url,
      });
    } finally {
      setLoading(false);
    }
  };

  const openManualForm = (url: string) => {
    setManualUrl(url);
    setAddError(null);
  };

  const handleManualSave = async (values: ManualStoryValues) => {
    const url = manualUrl ?? '';
    const content = plainTextToStoryHtml(values.text);
    if (!content) throw new Error('Paste the story text first.');
    if (content.length > MAX_CONTENT_CHARS) {
      throw new Error('This story is too long to save (the limit is roughly 150,000 words).');
    }
    await saveStory(
      {
        title: values.title.trim(),
        author: values.author.trim() || 'Unknown',
        source: values.source.trim() || hostOf(url),
        content,
      },
      url,
    );
    setManualUrl(null);
    setUrlInput('');
  };

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim()) return;
    setApiKey(keyInput);
    setKeyInput('');
    setEditingKey(false);
    setAddError(null);
  };

  const handleForgetKey = () => {
    clearApiKey();
    setKeyInput('');
    setEditingKey(false);
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

  // Page counts come from the content, not the stored `totalPages`, so stories
  // saved under older pagination rules still show the right progress.
  const pageCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of stories) counts.set(s.id, paginateStory(s.content || '').length);
    return counts;
  }, [stories]);

  const visibleStories = useMemo(() => {
    const list = [...stories];
    if (filter === 'in-progress') {
      return list.filter((s) => {
        const total = pageCounts.get(s.id) || 1;
        const current = savedPage(s, total);
        if (total <= 1) return false;
        return current > 0 && current < total - 1;
      });
    }
    if (filter === 'finished') {
      return list.filter((s) => {
        const total = pageCounts.get(s.id) || 1;
        const current = savedPage(s, total);
        if (total <= 1) return false;
        return current >= total - 1;
      });
    }
    if (filter === 'by-author') {
      return list.sort((a, b) => (a.author || '').localeCompare(b.author || ''));
    }
    return list;
  }, [stories, filter, pageCounts]);

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
        <div className="sv-keypanel">
          {hasKey && !editingKey ? (
            <div className="key-active">
              <div className="key-status">
                <span className="dot" />
                <KeyRound className="w-4 h-4" />
                <span>
                  Gemini API key active for this session
                  <span className="key-hint"> · cleared when you sign out or close the browser</span>
                </span>
              </div>
              <div className="key-actions">
                <button type="button" className="link-btn" onClick={() => { setEditingKey(true); setKeyInput(''); }}>
                  Replace
                </button>
                <button type="button" className="link-btn danger" onClick={handleForgetKey}>
                  Forget
                </button>
              </div>
            </div>
          ) : (
            <div className="key-setup">
              <div className="intake-head">
                <h2>Connect your Gemini API key</h2>
                <span className="intake-meta">required · your key</span>
              </div>
              <p className="key-explainer">
                StoryVault uses Google&rsquo;s Gemini AI to read each article and pull out the clean
                story text. To do that it needs <strong>your own free Gemini API key</strong>. The key
                stays in this browser tab only &mdash; it is never sent to our servers and is wiped the
                moment you sign out or close the browser. Any usage is billed to your own Google account
                (Gemini has a free tier that is plenty for casual reading).
              </p>
              <ol className="key-steps">
                <li>
                  Open{' '}
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">
                    Google AI Studio &rarr; API keys
                    <ExternalLink style={{ width: 11, height: 11, marginLeft: 4, display: 'inline' }} />
                  </a>{' '}
                  and sign in with your Google account.
                </li>
                <li>Click <strong>Create API key</strong> and copy the value it gives you.</li>
                <li>Paste it below and select <strong>Save key</strong>.</li>
              </ol>
              <form onSubmit={handleSaveKey}>
                <div className="input-wrap">
                  <span className="prefix">KEY</span>
                  <input
                    type="password"
                    required
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="AIza…"
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                  />
                </div>
                <button type="submit" className="add-btn" disabled={!keyInput.trim()}>
                  <Check className="w-4 h-4" />
                  Save key
                </button>
                {editingKey && hasKey && (
                  <button type="button" className="add-btn ghost" onClick={() => { setEditingKey(false); setKeyInput(''); }}>
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                )}
              </form>
            </div>
          )}
        </div>

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
                disabled={loading || !hasKey}
              />
            </div>
            <button type="submit" className="add-btn" disabled={loading || !hasKey}>
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
          {addError && (
            <div className="err" role="alert">
              <p className="err-msg">{addError.message}</p>
              {addError.attempts && (
                <ul className="err-attempts">
                  {addError.attempts.map((a) => (
                    <li key={a.method}>
                      <span className="err-method">{a.method}</span>
                      <span>{a.reason}</span>
                    </li>
                  ))}
                </ul>
              )}
              {addError.offerManual && addError.url && (
                <button type="button" className="err-action" onClick={() => openManualForm(addError.url!)}>
                  <PenLine className="w-4 h-4" />
                  Add it manually
                </button>
              )}
            </div>
          )}
          {manualUrl !== null && (
            <ManualStoryForm onSave={handleManualSave} onCancel={() => setManualUrl(null)} />
          )}
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
              const total = pageCounts.get(story.id) || 1;
              const current = savedPage(story, total);
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
