'use client';

import { useAuth } from '@/components/auth-provider';
import AppMain from '@/components/library';
import { Wordmark } from '@/components/wordmark';

export default function Home() {
  const { user, loading, signIn } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-background)' }}>
        <div
          className="w-8 h-8 rounded-full"
          style={{
            border: '3px solid rgba(102, 95, 81, 0.25)',
            borderTopColor: 'var(--color-primary)',
            animation: 'sv-spin 0.8s linear infinite',
          }}
        />
      </div>
    );
  }

  if (user) {
    return <AppMain />;
  }

  return (
    <div className="sv-signin">
      <div className="corner-mark">
        <Wordmark size={18} />
      </div>
      <div className="signature">est. mmxxv · a private library</div>

      <div className="center">
        <div className="frontispiece">
          <div className="roman">Vol. I · No. 1</div>
        </div>
        <h1 className="title">
          The <em>Story</em>
          <br />
          Vault
        </h1>
        <div className="ornament">· · ·</div>
        <p className="subtitle">
          A quiet place to keep the short fiction you mean to read. Paste a link; we set the type.
        </p>

        <button onClick={signIn} className="signin-btn" type="button">
          <span className="g">G</span>
          Sign in with Google
        </button>

        <div className="footnote">
          Your library is private. Stories are paginated, not paywalled.<sup> †</sup>
        </div>
      </div>

      <div className="marginalia">
        <em>marginalia —</em>
        <br />
        A reader&apos;s library should feel like a desk, not a feed.
      </div>
      <div className="page-no">— i —</div>
    </div>
  );
}
