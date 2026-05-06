'use server';

export type FetchArticleResult =
  | { ok: true; content: string }
  | { ok: false; message: string };

// Routes through Jina Reader (https://r.jina.ai), which runs a headless browser
// and returns clean markdown. This bypasses Cloudflare/bot challenges that block
// plain server-side fetch from datacenter IPs (e.g. Uncanny Magazine, most
// publishers behind Cloudflare). Returns a result object instead of throwing
// so the actual error message survives Next.js's Server Action redaction in prod.
export async function fetchArticleContent(url: string): Promise<FetchArticleResult> {
  const proxied = `https://r.jina.ai/${url}`;
  try {
    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    const jinaKey = process.env.JINA_AI_KEY;
    if (jinaKey) {
      headers['Authorization'] = `Bearer ${jinaKey}`;
    }

    const res = await fetch(proxied, { headers });

    if (!res.ok) {
      return {
        ok: false,
        message: `Reader proxy returned ${res.status} ${res.statusText} for ${url}.`,
      };
    }

    const content = await res.text();
    if (!content || content.length < 200) {
      return {
        ok: false,
        message: `Reader proxy returned no usable content (${content.length} chars). The source may be paywalled, gated, or blocking automated access.`,
      };
    }

    return { ok: true, content };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
