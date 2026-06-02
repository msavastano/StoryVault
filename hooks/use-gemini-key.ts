'use client';

import { useEffect, useState, useCallback } from 'react';

// The user's Gemini API key is held in sessionStorage only: it survives page
// reloads within the same tab but is wiped when the tab/browser session ends.
// It is never written to Firestore, env vars, or any server. logOut() in
// auth-provider also clears it explicitly.
const STORAGE_KEY = 'sv:gemini-api-key';
// sessionStorage does not fire the `storage` event in the same document, so we
// broadcast our own event to keep every mounted consumer in sync.
const CHANGE_EVENT = 'sv:gemini-api-key-changed';

function readKey(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function clearGeminiKey() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useGeminiKey() {
  const [apiKey, setApiKeyState] = useState('');

  useEffect(() => {
    setApiKeyState(readKey());
    const sync = () => setApiKeyState(readKey());
    window.addEventListener(CHANGE_EVENT, sync);
    return () => window.removeEventListener(CHANGE_EVENT, sync);
  }, []);

  const setApiKey = useCallback((key: string) => {
    const trimmed = key.trim();
    try {
      if (trimmed) {
        window.sessionStorage.setItem(STORAGE_KEY, trimmed);
      } else {
        window.sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const clearApiKey = useCallback(() => clearGeminiKey(), []);

  return { apiKey, hasKey: apiKey.length > 0, setApiKey, clearApiKey };
}
