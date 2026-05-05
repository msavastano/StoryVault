'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { useAuth } from '@/components/auth-provider';

export type ReaderTheme = 'light' | 'sepia' | 'dark';
export type ReaderFontFamily = 'serif' | 'sans';
export type ReaderLineSpacing = 'tight' | 'normal' | 'loose';
export type ReaderMargin = 'narrow' | 'normal' | 'wide';

export interface ReaderPreferences {
  fontSize: number;
  fontFamily: ReaderFontFamily;
  theme: ReaderTheme;
  lineSpacing: ReaderLineSpacing;
  margin: ReaderMargin;
}

export const FONT_SIZE_PX = [16, 18, 20, 22, 24, 28] as const;
export const LINE_HEIGHT: Record<ReaderLineSpacing, number> = {
  tight: 1.5,
  normal: 1.75,
  loose: 2.0,
};
export const MAX_WIDTH: Record<ReaderMargin, string> = {
  narrow: '52rem',
  normal: '42rem',
  wide: '34rem',
};

export const DEFAULT_PREFERENCES: ReaderPreferences = {
  fontSize: 2,
  fontFamily: 'serif',
  theme: 'light',
  lineSpacing: 'normal',
  margin: 'normal',
};

export function useReaderPreferences() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<ReaderPreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    // One-shot read on mount. Prefs only change from this UI, so a live listener
    // adds no value and previously triggered Firestore SDK assertion failures
    // (ID: ca9) when its first response was permission-denied during HMR remounts.
    (async () => {
      try {
        const snapshot = await getDoc(doc(db, `users/${user.uid}/preferences/reader`));
        if (cancelled || !snapshot.exists()) return;
        const data = snapshot.data() as Partial<ReaderPreferences>;
        setPrefs({ ...DEFAULT_PREFERENCES, ...data });
      } catch (error) {
        console.warn(
          'Reader preferences read failed; using defaults.',
          error instanceof Error ? error.message : error,
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const update = async (patch: Partial<ReaderPreferences>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    if (!user) return;
    try {
      await setDoc(doc(db, `users/${user.uid}/preferences/reader`), {
        ...next,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/preferences/reader`);
    }
  };

  return { prefs, update };
}
