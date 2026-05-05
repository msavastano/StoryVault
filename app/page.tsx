'use client';

import { useAuth } from '@/components/auth-provider';
import AppMain from '@/components/library';
import { BookOpen } from 'lucide-react';

export default function Home() {
  const { user, loading, signIn } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (user) {
    return <AppMain />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-indigo-50 to-white text-center">
      <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-indigo-200">
        <BookOpen className="w-8 h-8 text-white" />
      </div>
      <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-gray-900 mb-4 font-sans">
        StoryVault
      </h1>
      <p className="text-lg md:text-xl text-gray-600 max-w-xl mb-10">
        Your distraction-free reading library for short stories. Extract clean text from any URL and read it comfortably.
      </p>
      <button
        onClick={signIn}
        className="px-8 py-3 bg-indigo-600 text-white rounded-full font-medium text-lg hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg flex items-center gap-3"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current border border-transparent">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        Sign in with Google
      </button>
    </div>
  );
}
