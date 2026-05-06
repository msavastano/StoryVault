# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start Next.js dev server (http://localhost:3000)
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — ESLint via `eslint-config-next`
- `npm run clean` — `next clean`

There is no test runner configured. `next.config.ts` sets `eslint.ignoreDuringBuilds: true`, so lint must be run manually; TypeScript errors *do* fail the build.

## Environment

- `NEXT_PUBLIC_GEMINI_API_KEY` — required at runtime; consumed client-side in `components/library.tsx` to call `@google/genai`. Without it, adding a story throws "Missing Gemini API Key".
- `JINA_AI_KEY` — optional; passed as `Bearer` token to the Jina Reader proxy in `lib/fetchHtml.ts` (Server Action, never exposed to the browser). Without it, requests use Jina's free tier (rate-limited). **Do NOT prefix with `NEXT_PUBLIC_`** — this is a secret key used only server-side.
- `DISABLE_HMR=true` — set by AI Studio to freeze webpack file-watching (prevents flicker during agent edits). Don't change this branch in `next.config.ts`.
- `.env.example` documents the AI Studio variables (`GEMINI_API_KEY`, `APP_URL`); for local dev use `.env.local` with `NEXT_PUBLIC_GEMINI_API_KEY`.

## Architecture

Next.js 15 App Router + React 19 client app. Single-user-scoped reading library backed by Firebase. There is no custom backend — the only server-side code is one Server Action.

**Add-story flow** (`components/library.tsx#handleAddStory`):
1. User pastes URL → calls `fetchRawHtml(url)` from `lib/fetchHtml.ts` (a `'use server'` Server Action that bypasses browser CORS by fetching with a desktop UA).
2. Raw HTML (truncated to 50,000 chars) is sent to Gemini (`gemini-3.1-flash-lite-preview`) with a JSON `responseSchema` that forces `{title, author, source, content}`. Gemini is instructed to return cleaned HTML using only `<p>`, `<em>`, `<strong>`, `<hr>`.
3. Client computes `wordCount` and `totalPages` (see Pagination), then `addDoc` to `users/{uid}/stories`.

**Reading flow** (`components/reader.tsx`): pages are recomputed in the browser from `story.content`. Page advancement persists `currentPage` via `updateDoc`.

**Auth** (`components/auth-provider.tsx`): single Google popup provider via Firebase Auth, exposed through `useAuth()`. `app/page.tsx` gates on `user`.

### Pagination invariant

`library.tsx` (when saving) and `reader.tsx` (when displaying) **must** chunk identically. Both use the regex `/<p[\s\S]*?<\/p>|<hr>/gi` and group **4 elements per page**. If you change the chunking in one place, change it in the other, otherwise saved `totalPages` will diverge from the rendered page count and the `currentPage` clamp in `reader.tsx` will fire.

### Firestore data model & rules

- `users/{userId}/stories/{storyId}` — story is a `Story` (see `components/library.tsx`).
- `users/{userId}/preferences/reader` — single fixed-id doc holding `ReaderPreferences` (see `hooks/use-reader-preferences.ts`). The rule pins `prefId == 'reader'`.
- `firestore.rules` is strict and load-bearing:
  - Global `match /{document=**} { allow read, write: if false; }` — only the explicitly-listed paths open access.
  - **Stories**: updates restricted to **only the `currentPage` field** (`affectedKeys().hasOnly(['currentPage'])`). Adding any other mutable field requires both extending the rule and `isValidStory`.
  - **Preferences**: writes require the full doc (validated by `isValidReaderPreferences` + `hasOnly`/`hasAll` over the 6 fields). Adding a preference field requires updating the rule and the hook together.
  - `isValidStory` caps `content` at 900,000 chars; the Gemini prompt's 50K input cap keeps output well under this.
  - `createdAt` (stories) and `updatedAt` (preferences) are required and must equal `request.time` on the relevant write — always use `serverTimestamp()`.
- After editing `firestore.rules`, redeploy via Firebase Console → Firestore → Rules, or `npx firebase deploy --only firestore:rules` (CLI auth required). Until rules are redeployed, writes from the live app will be silently rejected.
- `firebase-blueprint.json` is a documentation/schema artifact for AI Studio; it does not enforce anything at runtime.

### Firebase initialization

`lib/firebase.ts` reads `firebase-applet-config.json` (AI Studio–managed). The line `getFirestore(app, firebaseConfig.firestoreDatabaseId)` passes a **named database ID** — this app uses a non-default Firestore database. The inline comment "CRITICAL: The app will break without this line" is accurate; do not simplify to `getFirestore(app)`.

`handleFirestoreError` rethrows a stringified JSON blob containing `authInfo` and the offending path/operation — useful when debugging rule rejections. Callers expect this to throw.

### Path alias

`@/*` resolves to the repo root (see `tsconfig.json`). Imports look like `@/components/...`, `@/lib/...`.

## Deployment off AI Studio

`skills/local-vercel-deployment/SKILL.md` is the playbook for migrating off AI Studio's managed Firebase to a user-owned Firebase project + Vercel. Key migration steps: replace `firebase-applet-config.json` with `NEXT_PUBLIC_FIREBASE_*` env vars in `lib/firebase.ts`, deploy `firestore.rules` to the new project, and add the Vercel domain to Firebase Auth → Authorized Domains (otherwise Google sign-in fails in production).
