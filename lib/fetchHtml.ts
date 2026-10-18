'use server';

export type FetchAttempt = { method: string; reason: string };

export type FetchArticleResult =
  | { ok: true; content: string }
  | { ok: false; message: string; attempts: FetchAttempt[] };

type AttemptResult = { ok: true; content: string } | { ok: false; reason: string };

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Anything shorter than this is an error page or a stub, not a story.
const MIN_CONTENT_CHARS = 200;
const DIRECT_FETCH_TIMEOUT_MS = 20_000;

// Fetches a story page for Gemini to extract. Tries Jina Reader first, then a
// plain server-side fetch if Jina fails.
//
// Jina (https://r.jina.ai) runs a headless browser and returns clean markdown,
// which gets past Cloudflare/bot challenges that block a plain fetch from
// datacenter IPs (e.g. Uncanny Magazine). But some sites refuse Jina itself
// (it answers 403 for them), and those often serve a plain fetch just fine,
// so a direct fetch is the fallback.
//
// Returns a result object instead of throwing so the actual error message
// survives Next.js's Server Action redaction in prod.
export async function fetchArticleContent(url: string): Promise<FetchArticleResult> {
  const viaJina = await fetchViaJina(url);
  if (viaJina.ok) return viaJina;

  const direct = await fetchDirect(url);
  if (direct.ok) return direct;

  const attempts = [
    { method: 'Reader proxy', reason: viaJina.reason },
    { method: 'Direct fetch', reason: direct.reason },
  ];
  return {
    ok: false,
    message: `Couldn't fetch ${url}. ${attempts.map((a) => `${a.method}: ${a.reason}.`).join(' ')}`,
    attempts,
  };
}

async function fetchViaJina(url: string): Promise<AttemptResult> {
  try {
    const headers: Record<string, string> = { 'User-Agent': BROWSER_UA };
    const jinaKey = process.env.JINA_AI_KEY;
    if (jinaKey) {
      headers['Authorization'] = `Bearer ${jinaKey}`;
    }

    const res = await fetch(`https://r.jina.ai/${url}`, { headers });
    if (!res.ok) {
      const detail = await readJinaError(res);
      return {
        ok: false,
        reason: `${res.status} ${res.statusText}${detail ? ` (${detail})` : ''}`,
      };
    }

    const content = await res.text();
    if (content.length < MIN_CONTENT_CHARS) {
      return { ok: false, reason: `no usable content (${content.length} chars)` };
    }
    return { ok: true, content };
  } catch (error) {
    return { ok: false, reason: errorText(error) };
  }
}

// Jina explains its errors in a JSON body ({ message, readableMessage, ... }).
// Surface that so the next failure says why, not just the status code. An HTML
// error page (the site's own 403, passed through) adds nothing to the status.
async function readJinaError(res: Response): Promise<string> {
  try {
    const body = await res.text();
    if (body.trimStart().startsWith('<')) return '';
    try {
      const json = JSON.parse(body);
      const msg = json?.readableMessage || json?.message || json?.data?.message;
      if (typeof msg === 'string') return truncate(msg);
    } catch {
      // Not JSON; fall through to the raw text.
    }
    return truncate(body.replace(/\s+/g, ' ').trim());
  } catch {
    return '';
  }
}

async function fetchDirect(url: string): Promise<AttemptResult> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(DIRECT_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      return { ok: false, reason: `${res.status} ${res.statusText}` };
    }

    const html = await res.text();
    if (isBotChallenge(html)) {
      return { ok: false, reason: 'the site served a bot check instead of the page' };
    }

    const content = slimHtml(html);
    const textLength = content.replace(/<[^>]+>/g, '').trim().length;
    if (textLength < MIN_CONTENT_CHARS) {
      return {
        ok: false,
        reason: `no usable content (${textLength} chars of text); the page may be paywalled or rendered by JavaScript`,
      };
    }
    return { ok: true, content };
  } catch (error) {
    return { ok: false, reason: errorText(error) };
  }
}

function isBotChallenge(html: string): boolean {
  return (
    /<title>\s*(Just a moment|Attention Required)/i.test(html) ||
    html.includes('challenges.cloudflare.com') ||
    html.includes('cf-chl-')
  );
}

// Raw publisher HTML is mostly scripts, styles and attributes. Strip those so
// the story text fits well inside the slice of content sent to Gemini.
function slimHtml(html: string): string {
  return html
    .replace(/<head[\s\S]*?<\/head>/i, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript|svg|iframe|template|form)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<(\/?[a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)>/g, '<$1$2>')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(text: string, max = 200): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
