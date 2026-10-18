// Splits a story's cleaned HTML into reader pages by word count.
//
// Both the library (when saving `totalPages` and showing progress) and the
// reader (when rendering) call `paginateStory`, so they always agree on the
// page count. Change pagination here only.

/** Words a page aims for. Paragraphs are never split, so pages land near this. */
export const TARGET_WORDS_PER_PAGE = 300;

/** The title page also shows the title, byline and ornament, so it holds less text. */
const TITLE_PAGE_SHARE = 0.6;

/** A final page shorter than this share of the target is folded into the page before it. */
const MIN_LAST_PAGE_SHARE = 0.25;

// `<p>…</p>` blocks and scene breaks, including `<hr/>` and `<hr />`.
const BLOCK_RE = /<p\b[\s\S]*?<\/p>|<hr\b[^>]*>/gi;

export function countWords(html: string): number {
  return html
    .replace(/<[^>]*>?/gm, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

type Page = { blocks: string[]; words: number };

export function paginateStory(content: string): string[] {
  const blocks = content.match(BLOCK_RE) || [];
  if (blocks.length === 0) return [content];

  const pages: Page[] = [];
  let current: Page = { blocks: [], words: 0 };

  for (const block of blocks) {
    const words = countWords(block);
    const target =
      pages.length === 0 ? TARGET_WORDS_PER_PAGE * TITLE_PAGE_SHARE : TARGET_WORDS_PER_PAGE;

    // Start a new page when adding this paragraph would land further from the
    // target than stopping here. Scene breaks have no words, so they always
    // stay with the text before them.
    const withBlock = current.words + words;
    if (words > 0 && current.words > 0 && withBlock > target && withBlock - target > target - current.words) {
      pages.push(current);
      current = { blocks: [], words: 0 };
    }

    current.blocks.push(block);
    current.words += words;
  }
  if (current.blocks.length > 0) pages.push(current);

  // Fold a short last page (or a lone trailing scene break) into the one before.
  if (pages.length > 1) {
    const last = pages[pages.length - 1];
    if (last.words < TARGET_WORDS_PER_PAGE * MIN_LAST_PAGE_SHARE) {
      const prev = pages[pages.length - 2];
      prev.blocks.push(...last.blocks);
      prev.words += last.words;
      pages.pop();
    }
  }

  return pages.map((p) => p.blocks.join('\n'));
}

/**
 * The page a saved bookmark points to under the current pagination.
 *
 * Stories saved under older pagination rules store a `totalPages` that no
 * longer matches. Their bookmark is moved to the same relative spot, keeping
 * unread stories unread, finished stories finished, and started ones in progress.
 */
export function savedPage(
  story: { currentPage?: number; totalPages?: number },
  totalPages: number,
): number {
  const last = Math.max(0, totalPages - 1);
  const current = story.currentPage || 0;
  const stored = story.totalPages;
  if (!stored || stored === totalPages) return Math.min(Math.max(0, current), last);

  const storedLast = stored - 1;
  if (current <= 0 || storedLast <= 0) return 0;
  if (current >= storedLast) return last;
  const mapped = Math.round((current / storedLast) * last);
  return Math.min(Math.max(mapped, 1), Math.max(1, last - 1), last);
}
