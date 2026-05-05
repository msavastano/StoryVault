'use client';

import { useState, useMemo, useEffect } from 'react';
import { Story } from './library';
import { ArrowLeft, ChevronLeft, ChevronRight, Moon, Sun, Coffee } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/components/auth-provider';

type Theme = 'light' | 'sepia' | 'dark';

export function Reader({ story, onBack }: { story: Story; onBack: () => void }) {
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState(story.currentPage || 0);
  const [theme, setTheme] = useState<Theme>('light');

  const pages = useMemo(() => {
    const elements = story.content.match(/<p[\s\S]*?<\/p>|<hr>/gi) || [];
    const result = [];
    for (let i = 0; i < elements.length; i += 4) { // 4 paragraphs per page
      result.push(elements.slice(i, i + 4).join('\n'));
    }
    if (result.length === 0) result.push(story.content);
    return result;
  }, [story.content]);

  // Ensure initial page isn't out of bounds if chunking changes
  useEffect(() => {
    if (currentPage >= pages.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentPage(Math.max(0, pages.length - 1));
    }
  }, [pages.length, currentPage]);

  const handlePageChange = async (newPage: number) => {
    setCurrentPage(newPage);
    if (!user) return;
    
    try {
      const storyRef = doc(db, `users/${user.uid}/stories/${story.id}`);
      await updateDoc(storyRef, {
        currentPage: newPage
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/stories/${story.id}`);
    }
  };

  const themeClasses = {
    light: 'bg-[#fcfcfc] text-[#1a1a1a]',
    sepia: 'bg-[#f4ecd8] text-[#5b4636]',
    dark: 'bg-[#121212] text-[#e0e0e0]',
  };

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 ${themeClasses[theme]}`}>
      {/* Top Bar */}
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
          <div className="flex items-center gap-2 bg-current/5 p-1 rounded-full">
            <button
              onClick={() => setTheme('light')}
              className={`p-1.5 rounded-full ${theme === 'light' ? 'bg-current/10' : 'opacity-50 hover:opacity-100'}`}
              title="Light theme"
            >
              <Sun className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTheme('sepia')}
              className={`p-1.5 rounded-full ${theme === 'sepia' ? 'bg-current/10' : 'opacity-50 hover:opacity-100'}`}
              title="Sepia theme"
            >
              <Coffee className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`p-1.5 rounded-full ${theme === 'dark' ? 'bg-current/10' : 'opacity-50 hover:opacity-100'}`}
              title="Dark theme"
            >
              <Moon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Reader Content */}
      <main className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-6 py-12 md:py-24 font-serif">
        <div className="mb-12 md:mb-16 text-center">
          <h1 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight leading-tight">{story.title}</h1>
          <p className="text-lg opacity-80 italic">{story.author}</p>
        </div>

        <div 
          className="prose prose-lg md:prose-xl max-w-none text-current prose-p:leading-relaxed prose-p:mb-8"
          dangerouslySetInnerHTML={{ __html: pages[currentPage] || '' }} 
        />
        
      </main>

      {/* Bottom Pagination Bar */}
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
