// Turns story text a reader pasted in by hand into the same HTML the AI
// extraction produces (<p> paragraphs and <hr> scene breaks), so pagination,
// word counts and the reader treat both the same way.

// A line made only of these marks (e.g. "* * *", "#", "~~~") is a scene break.
const SCENE_BREAK_RE = /^[\s*#~•·◆◇§_=—–-]+$/;

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function plainTextToStoryHtml(text: string): string {
  const normalized = text.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return '';

  // Text copied from a web page usually separates paragraphs with a blank
  // line, and may wrap lines inside a paragraph. Without any blank lines, each
  // line is its own paragraph.
  const hasBlankLines = /\n[ \t]*\n/.test(normalized);
  const chunks = hasBlankLines ? normalized.split(/\n[ \t]*\n\s*/) : normalized.split('\n');

  return chunks
    .map((chunk) => chunk.replace(/\s*\n\s*/g, ' ').trim())
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => (SCENE_BREAK_RE.test(chunk) ? '<hr>' : `<p>${escapeHtml(chunk)}</p>`))
    .join('\n');
}
