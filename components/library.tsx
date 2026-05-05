'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth-provider';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { fetchRawHtml } from '@/lib/fetchHtml';
import { GoogleGenAI, Type } from '@google/genai';
import { Reader } from '@/components/reader';
import { BookOpen, LogOut, Plus, Trash2, Library, Book } from 'lucide-react';

export interface Story {
  id: string;
  title: string;
  author: string;
  source: string;
  content: string;
  wordCount?: number;
  totalPages?: number;
  currentPage?: number;
  createdAt: any;
}

const LOADING_QUIPS = [
  "Bribing the web scraper...",
  "Explaining literature to the AI...",
  "Removing annoying ads...",
  "Negotiating with CSS classes...",
  "Teaching the models how to read...",
  "Counting words, one by one...",
  "Translating metaphors...",
  "Converting <div>s to <p>s with a hammer...",
];

export default function AppMain() {
  const { user, logOut } = useAuth();
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [stories, setStories] = useState<Story[]>([]);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

      // Fetch HTML via Server Action to bypass CORS
      const rawHtml = await fetchRawHtml(urlInput);

      const ai = new GoogleGenAI({
        apiKey: apiKey,
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-preview',
        contents: [
          {
            text: `You are an expert web scraper. I will provide raw HTML from a short story magazine. Extract the title, author, source magazine, and the main story content. Format the story content as clean, normalized HTML using ONLY <p>, <em>, <strong>, and <hr> tags. Remove all images, links, ads, and CSS classes. Return a raw JSON object with the exact keys: title, author, source, and content.\n\nRAW HTML:\n${rawHtml.substring(0, 50000)}`,
          },
        ],
        config: {
          responseMimeType: 'application/json',
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

  if (selectedStory) {
    return (
      <Reader story={selectedStory} onBack={() => setSelectedStory(null)} />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center space-x-2">
          <Library className="w-6 h-6 text-indigo-600" />
          <h1 className="text-xl font-bold tracking-tight text-gray-900">StoryVault</h1>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-600 hidden sm:block">{user?.email}</div>
          <button
            onClick={logOut}
            className="p-2 text-gray-500 hover:text-gray-900 transition-colors rounded-full hover:bg-gray-100"
            title="Log out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <section className="mb-12 bg-white rounded-2xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-900">Add a New Story</h2>
          <form onSubmit={handleAddStory} className="flex flex-col sm:flex-row gap-3">
            <input
              type="url"
              required
              placeholder="Paste the URL of a short story..."
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 focus:bg-white transition-colors"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-75 disabled:cursor-not-allowed flex items-center justify-center min-w-[220px] font-medium tracking-wide"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {LOADING_QUIPS[loadingStep]}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Add to Library
                </span>
              )}
            </button>
          </form>
          {errorMsg && (
            <div className="mt-4 p-3 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm">
              {errorMsg}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-6 text-gray-900">Your Library</h2>
          {stories.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 border-2 border-dashed rounded-xl text-gray-500">
              <BookOpen className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <p>Your library is empty.</p>
              <p className="text-sm">Paste a URL above to start reading.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {stories.map((story) => {
                const total = story.totalPages || 1;
                const current = story.currentPage || 0;
                const progressPercentage = Math.round(((current + 1) / total) * 100);
                
                return (
                  <div
                    key={story.id}
                    onClick={() => setSelectedStory(story)}
                    className="bg-white rounded-xl border p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col h-full relative"
                  >
                    <button
                      onClick={(e) => handleDelete(e, story.id)}
                      className="absolute top-4 right-4 p-2 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 rounded-full"
                      title="Delete story"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-gray-900 leading-tight mb-2 pr-8">{story.title}</h3>
                      <p className="text-sm font-medium text-indigo-600 mb-1">{story.author}</p>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">{story.source}</p>
                    </div>
                    {/* Progress Bar & Meta footer */}
                    <div className="mt-4 pt-4 border-t flex flex-col gap-2">
                       <div className="w-full bg-gray-200 rounded-full h-1.5">
                         <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: `${progressPercentage}%` }}></div>
                       </div>
                       <div className="flex items-center justify-between text-xs text-gray-500">
                         <span>{progressPercentage}% read</span>
                         {story.wordCount && <span>{story.wordCount.toLocaleString()} words</span>}
                       </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
