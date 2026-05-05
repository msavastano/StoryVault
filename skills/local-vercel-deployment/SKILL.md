---
name: local-vercel-deployment
description: Instructions for helping the user export, set up, and deploy this project locally and onto Vercel.
---
# Local Development & Vercel Deployment Guide

This skill provides step-by-step instructions for taking this built AI Studio application (Next.js + Firebase + Gemini) and setting it up for local development, as well as deploying it to Vercel.

## 1. Prerequisites
- Node.js (v18+) installed locally.
- A GitHub account.
- A Vercel account.
- A personal Google account to create a new Firebase project (to own your own data outside of AI Studio).

## 2. Exporting the Applet
- Instruct the user to click the **Export** button in the AI Studio interface (usually found in the settings menu or top right corner) and select either **GitHub** or **ZIP**.

## 3. Firebase Migration (Critical)
Because AI Studio provisions a managed Firebase instance for preview contexts, moving outside of AI Studio requires the user to set up their own Firebase project:
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Create a new project.
3. Enable **Firestore Database** in test mode, or production mode (you will apply the rules later).
4. Enable **Authentication** and activate the **Google** sign-in provider.
5. Register a Web App in the project settings to get the Firebase configuration block.

**Instructions for AI:** If the user is proceeding with this step, enthusiastically offer to update `lib/firebase.ts` to use `.env.local` variables instead of the hardcoded `firebase-applet-config.json`. You should suggest replacing the config loader with standard `process.env.NEXT_PUBLIC_FIREBASE_API_KEY`, etc.

6. **Deploy Security Rules:** Have the user copy the contents of `firestore.rules` into their Firebase Console -> Firestore -> Rules tab, and publish them.

## 4. Local Environment Variables
Create an `.env.local` file in the root of the project:
```env
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key

# If migrated to ENV vars:
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

## 5. Running Locally
```bash
npm install
npm run dev
```
The app will be available at `http://localhost:3000`.

## 6. Deploying to Vercel
1. Push the code to a GitHub repository.
2. Log into Vercel and **Add New Project**.
3. Import the GitHub repository.
4. **Environment Variables:** During the import/setup step, add all the variables from `.env.local` into the Vercel environment variables section.
5. Click **Deploy**.
6. **Post-Deployment Vercel Step:** Once Vercel generates a public URL (e.g., `https://my-app.vercel.app`), the user **MUST** go back to the Firebase Console -> Authentication -> Settings -> Authorized Domains, and add the Vercel domain. Otherwise, Google Sign-in will fail in production.

## Agent Directives
When the user indicates they want to "bring this local" or "deploy to Vercel", read this skill and guide them through this process clearly. Break it down so it is not overwhelming, offering to adjust their codebase (like rewriting `lib/firebase.ts` to support `.env.local` instead of the AI Studio config) to make it ready for GitHub.
