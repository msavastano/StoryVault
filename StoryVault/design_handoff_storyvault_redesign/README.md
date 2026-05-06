# Handoff: StoryVault Redesign — Academic Minimalism

## Overview

A complete visual redesign of **StoryVault**, a personal short-fiction reading library (Next.js 15 / React 19 / Firebase). The product lets a signed-in user paste a URL, has Gemini extract the story, and stores it in a Firestore-backed library. The reader paginates the story client-side and persists `currentPage` as the user advances.

This redesign reskins the existing app — same flows, same data model, same Firestore rules — under a new design language called **Academic Minimalism**: parchment palette, Newsreader serif throughout, scholarly tone (a private library, not a feed). It does **not** change product behavior, schema, or chunking logic.

## About the Design Files

The files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior, not production code to copy directly. The task is to **recreate these designs inside the existing StoryVault Next.js codebase** (`app/`, `components/`, `hooks/`), using its established patterns: client components, Tailwind, lucide-react icons, the existing `useReaderPreferences()` hook, the existing Firestore add/update/delete code paths.

Do not introduce a new framework, new state libraries, or new persistence layers. Replace the look and feel of `components/library.tsx`, `components/reader.tsx`, and `app/page.tsx` (the sign-in gate). Leave `lib/firebase.ts`, `firestore.rules`, `lib/fetchHtml.ts`, and the Gemini call shape untouched.

## Fidelity

**High-fidelity.** Final colors, typography, spacing, and component states are specified. Recreate pixel-perfect, but defer to the existing codebase's stack: Tailwind classes (extend `tailwind.config` if needed) over hand-rolled CSS, lucide-react over inline SVGs, the existing preference hook over new local state.

## Source files in this bundle

- `StoryVault.html` — the design prototype. Open it to see all four screens side-by-side on a design canvas. Each screen is one `<DCArtboard>` and you can fullscreen any of them.
- `colors_and_type.css` — the full token set (colors, type scale, spacing, radii, shadows, transitions). **This is the source of truth for tokens.** Lift the `:root` custom properties into the codebase as Tailwind theme extensions (or import the file directly into `app/globals.css`).
- `design-canvas.jsx` — the canvas component used to present the artboards. **Do not port this** — it is a presentation tool, not part of the product.

---

## Screens

There are four artboards in `StoryVault.html`. Each maps to a state of the existing app.

### 1. Sign in (`signin` artboard)

**Maps to:** `app/page.tsx` when `!user`.

**Purpose:** Unauthenticated landing — single Google sign-in CTA.

**Layout (1280 × 820):**
- Full-bleed parchment background (`#d9d1c0`) with a soft radial highlight (`#fcf9f6`, ellipse 600×320 at 50% 18%) behind the title.
- Top-left corner: **Wordmark** (mark + "Story*Vault*"), 18px size.
- Top-right corner: italic micro-copy `est. mmxxv · a private library`, 13px, color `--color-text-subtle`.
- Center column, max-width 580px, vertically centered:
  1. Frontispiece block — italic uppercase `Vol. I · No. 1`, 14px, letter-spacing `0.18em`, framed by 1px top + bottom rules in `--color-outline`. 22px vertical padding, 28px horizontal. 36px margin below.
  2. Title `The Story\nVault` — 84px, weight 400, line-height 0.95, letter-spacing `-0.04em`. The word "Story" is `<em>` italic in `--color-primary` (`#665f51`). Two lines, with `<br/>` between "The Story" and "Vault".
  3. Ornament `· · ·` — 18px, color `--color-outline`, letter-spacing `0.6em`. Top margin 16px, bottom 28px.
  4. Subtitle (italic, 22px, line-height 1.45, max-width 460px, color `--color-text-muted`): *"A quiet place to keep the short fiction you mean to read. Paste a link; we set the type."* — 44px margin below.
  5. Sign-in button (see Components → Sign-in button below).
  6. Footnote, 56px above: italic 13px, color `--color-text-subtle` — *"Your library is private. Stories are paginated, not paywalled.†"*
- Bottom-left: **marginalia** — 200px max-width, 12px italic body with a 1px left rule in `--color-outline-variant`, 14px left padding. Content: *"marginalia — A reader's library should feel like a desk, not a feed."*
- Bottom-right: italic page number `— i —`, 12px, letter-spacing `0.12em`, color `--color-text-subtle`.

**Sign-in button:**
- Background `--color-primary` (`#665f51`), text white, border 1px solid same color.
- Padding 14px 26px, radius `--radius` (8px), shadow `--shadow-sm`.
- Font: Newsreader 500, 17px.
- Inner Google "G" badge: 22px circle, white background, color `#4285f4`, system-sans bold "G", 14px.
- Hover: background `#4d4840`.

---

### 2. Library (`library` artboard)

**Maps to:** `components/library.tsx` (the main view when `selectedStory === null`).

**Purpose:** Browse, add, and open stories.

**Layout (1280 × 900):**

**Header** (`.lib-header`, 22px 56px 18px padding, parchment background):
- Bottom border 1px `--color-outline`, with a second 1px `--color-outline-variant` line 4px below it (a double-rule, very subtle).
- Left: wordmark (size 22) + italic "a private reading room" (13px, `--color-text-subtle`, letter-spacing 0.06em), 18px gap.
- Right: italic email `millhouse5000@gmail.com` (14px, `--color-text-muted`) + sign-out icon button (32×32 square, lucide `LogOut`, hover background `--color-surface-container` with 1px outline-variant border).

**Body** (`.lib-body`, padding `40px 56px 56px`, scrollable):

**Intake card** (`.intake`, marks the "Add a New Story" form):
- Background `--color-surface` (`#fcf9f6`), 1px solid `--color-outline`, radius 8px, padding 28px 32px, shadow `--shadow-sm`.
- **Inner hairline frame** — a 1px `--color-outline-variant` border inset 10px on all sides, non-interactive (decorative; gives the "intake card" feel).
- Header row: `<h2>Add a story to your library</h2>` (22px, weight 600, letter-spacing -0.01em) + italic right-aligned meta `accession · automatic` (13px, `--color-text-subtle`).
- Form: flex row, 12px gap.
  - **Input wrap:** flex 1, background `--color-surface-container-low`, 1px `--color-outline-variant`, 8px radius, 16px horizontal padding. Inside: a monospace prefix label `URL` (12px, `--color-text-subtle`, letter-spacing 0.05em) with a 1px right divider, 12px right padding. Then the actual `<input>` (transparent bg, no border, Newsreader 17px, `--color-text`, 14px vertical padding). Placeholder: italic, `--color-text-subtle`, e.g. *"https://lightspeedmagazine.com/fiction/…"*. Focus-within border switches to `--color-primary`.
  - **Button** ("Catalogue", replacing "Add to Library"): primary brown `--color-primary`, white text, 8px radius, 16px Newsreader 500, padding `0 26px`. Inner lucide `Plus` icon + "Catalogue". Hover `#4d4840`.
- Below form, 16px above: error state — 12px padding, 8px radius, background `#f4e6e6`, border 1px `#e0c8c8`, text `--color-destructive` (`#7a3f3f`), 14px.
- Loading state: replace button label with `<Spinner/> + LOADING_QUIPS[step]` (use the existing rotating quips from library.tsx). Spinner: 16px circle, 2px border, white/30 base, white top, `animate-spin`.
- 56px margin below to next section.

**Section head** (`.lib-section-head`):
- Double-rule bottom (same pattern as header).
- Left: `<h2>Your library<span class="num">— six titles</span></h2>` — title is 36px weight 600 letter-spacing -0.02em, the count is italic 24px weight 400 in `--color-text-subtle`, 14px left margin. The count text shows the actual library length, lowercased ("one title", "two titles", … or just `— ${n} titles`).
- Right: filter row (4 items, 22px gap, 14px Newsreader, `--color-text-muted`): **Recent · In progress · Finished · By author**. Active item: weight 500, `--color-text`, 1px solid `--color-primary` bottom border (4px below text). Hover: text → `--color-text`.

**Cards grid** (`.grid`): 3 columns, 24px gap.

**Story card** (`.card`):
- 240px min-height, flex column, padding `24px 26px 22px`.
- Background `--color-surface`, 1px `--color-outline`, 8px radius.
- Hover: shadow `--shadow-md`, `translateY(-2px)`, 200ms `ease-out`.
- Top-right absolute: `№ 01`, italic 12px `--color-text-subtle`, letter-spacing 0.06em. (Use the index in the sorted list, zero-padded.)
- **Source overline** (10px, weight 500, letter-spacing 0.18em, uppercase, `--color-text-subtle`, 14px bottom margin): the magazine name + 11px lucide `ExternalLink` icon (also acts as the original-article link, `e.stopPropagation()` to not open the reader).
- **Title** (`<h3>`): 24px weight 600 line-height 1.15 letter-spacing -0.015em, `--color-text`, `text-wrap: balance`, 10px bottom margin. Up to two lines, then ellipsis (line-clamp 2 if you want).
- **Author**: italic 16px Newsreader, `--color-text-muted`, prefixed by a small `by ` in normal style 13px `--color-text-subtle`.
- **Meta footer** — 22px top margin, 14px top padding, 1px `--color-outline-variant` top border:
  - 2px progress track. Background `--color-surface-container-high`. Bar: `--color-primary`, width = `currentPage / (totalPages - 1) * 100%` (matches existing math in library.tsx — keep it).
  - Below, 12px Newsreader meta row (`--color-text-subtle`):
    - Left, italic: `unread` if 0%, `finished` if 100%, otherwise `${pct}% · p. ${currentPage+1} of ${totalPages}`.
    - Right, tabular: `{wordCount.toLocaleString()} words`.
- Delete: keep the existing hover-revealed icon. Replace it with a 14px lucide `Trash2`, color `--color-text-subtle`, top-right (offset down ~22px from corner-num so they don't collide; or render corner-num only when not hovered). Hover color `--color-destructive`.
- Empty state (no stories): 64px vertical padding, dashed 1px `--color-outline-variant` border, 8px radius, centered. Italic `--color-text-subtle` 16px: *"Your shelf is empty."* + 13px below: *"Paste a URL to begin your library."*

---

### 3. Reader (`reader` artboard)

**Maps to:** `components/reader.tsx`.

**Purpose:** Read one paginated story.

**Layout (1280 × 900):**

**Header** (`.reader-header`, 18px 56px padding, 1px `--color-outline-variant` bottom border):
- Left: back button — lucide `ArrowLeft` 16px + "Back to library", Newsreader 14px `--color-text-muted`. Hover `--color-text`.
- Center: italic 13px `--color-text-subtle`, letter-spacing 0.04em — `${story.source} · ${story.wordCount.toLocaleString()} words`.
- Right: italic 13px `--color-text-subtle` "page 2 of 51" (24px gap before Aa button) + the **Aa button**.

**Aa button**: 1px `--color-outline-variant` border, 8px radius, padding `6px 12px`. Inner: 12px "A" + 17px weight 600 "a", Newsreader. Click toggles the popover (see screen 4).

**Body** (`.reader-body`, flex 1, centered, `64px 56px 32px` padding, parchment-toned `--color-surface` background):
- Inner column max-width **640px**.
- **Running head** — flex row, 64px below: left = author name lowercase italic, right = story title lowercase italic; 12px Newsreader, color `--color-text-subtle`, letter-spacing 0.08em. Show only on the title page (page 0); on subsequent pages, both halves get a hairline rule below them too.
- **Chapter mark** — italic 13px uppercase `— i —`, letter-spacing 0.24em, `--color-text-subtle`, 28px bottom margin. (For the title page only; later pages omit this.)
- **Story title** — `<h1>`, 48px weight 600 line-height 1.05 letter-spacing -0.025em, centered, `text-wrap: balance`, 14px bottom margin.
- **Byline** — italic 18px Newsreader, centered, `--color-text-muted`, 8px bottom margin. *"by Vanessa Fogg"*.
- **Publication line** — 11px weight 500 letter-spacing 0.18em uppercase, `--color-text-subtle`, 40px bottom margin. *"Lightspeed Magazine · 2024"* (synthesize: `${source} · ${createdAt year}`, or omit year if ambiguous).
- **Ornament rule** — `· · · ·`, centered, `--color-outline`, letter-spacing 0.6em, 36px bottom margin.
- **Body paragraphs** — 19px Newsreader, line-height 1.7, `--color-text`, 1em bottom margin between paragraphs.
- **Drop cap** on the very first paragraph of page 0: 64px weight 700 `--color-primary`, line-height 0.9, padding `4px 8px 0 0`, `float: left`. Add CSS `.dropcap::first-letter`.
- **Small caps on first line** of the first paragraph: `font-variant: small-caps; letter-spacing: 0.06em`.
- All other pages render `pages[currentPage]` exactly as the existing reader does (chunked by the `<p|hr>` regex, four elements per page — **do not change the chunking**) but inside this typographic shell.

**Footer** (`.reader-footer`, padding `20px 56px 28px`, 1px top border, parchment-toned background, sticky):
- Centered row, 8px gap.
- **Previous** button: Newsreader 15px `--color-text-muted`, transparent bg, padding `10px 18px`, 8px radius. Lucide `ChevronLeft` 16px + "Previous". Disabled when `currentPage === 0`. Hover background `--color-surface-container-low`.
- **Hairline progress track**: 280px max width, 24px horizontal margin, 1px line `--color-outline-variant`. Indicator dot: 7px `--color-primary` circle, vertically centered (top: -3px), `left = currentPage / (totalPages - 1) * 100%`.
- **Next** button: mirrors Previous (label first, ChevronRight after). Disabled when on last page.

Apply the user's `useReaderPreferences()` overrides to body type:
- `prefs.fontSize` → `font-size` of body paragraphs (steps remain the existing `FONT_SIZE_PX` array).
- `prefs.fontFamily === 'sans'` → swap body to `system-ui, sans-serif`. Title block stays Newsreader.
- `prefs.lineSpacing` → drives line-height (use existing `LINE_HEIGHT` map).
- `prefs.margin` → drives the inner column max-width (use existing `MAX_WIDTH` map; 640px is "normal").
- `prefs.theme` (see settings).

---

### 4. Reader · preferences (`settings` artboard)

**Maps to:** `components/reader.tsx`'s `<SettingsPopover/>` opened from the Aa button.

Same reader layout, but with a popover anchored under the Aa button and a faint scrim over the page.

**Scrim**: full-bleed `rgba(40,34,24,0.06)`, behind the popover.

**Popover**:
- 340px width, anchored top-right (top 70px, right 56px from the artboard edge — i.e., directly under the Aa button).
- Background `--color-surface-container-lowest` (`#ffffff`), 1px `--color-outline`, 12px radius, shadow `--shadow-lg`.
- 22px padding (20px bottom).
- 12px arrow: 12×12 square, half-rotated, anchored to the popover's top edge under the Aa button (right: 70px). Top + left borders match popover; rotated 45°.
- **Header**: `<h4>Reading preferences</h4>` — 17px weight 600, letter-spacing -0.01em — and below it italic 13px `--color-text-subtle` *"set the type to your liking"* (4px gap, 18px below). Hairline rule under (`--color-outline-variant`).
- **Rows** — 18px gap between rows.

Each row has a **row label**: 10px weight 500 letter-spacing 0.16em uppercase `--color-text-subtle`, 8px below.

1. **Font size** — stepper. Track `--color-surface-container`, 4px radius, 3px padding. Two buttons (36×32, transparent, hover background `--color-surface-container-lowest`): "A−" small (12px) and "A+" large (18px). Center value: tabular `${px} px`, 14px Newsreader.
2. **Typeface** — segmented, two options "Serif" / "Sans". Active gets background `--color-surface-container-lowest`, `--shadow-xs`, weight 500, color `--color-text`. Inactive: `--color-text-muted`. Each option uses its own font-family (so "Serif" is set in Newsreader, "Sans" in `system-ui`).
3. **Theme** — three swatches in a row, 10px gap, 56px height, 8px radius, 1.5px `--color-outline-variant` border.
   - **Light**: background `#fcf9f6`, foreground `#2a2620`, label "Aa" 18px weight 600.
   - **Parchment** (the new option, replaces "sepia"): background `#e7dcc4`, foreground `#4a3f2a`. Use the same code path as `sepia` in `THEME_CLASSES` but rename to `parchment` (or keep `sepia` internally and just relabel — see Migration notes).
   - **Dark**: background `#2a2620`, foreground `#f0ebe2`.
   - Selected swatch: border `--color-primary`, plus a 1.5px outer ring (`box-shadow: 0 0 0 2px var(--color-surface-container-lowest), 0 0 0 3.5px var(--color-primary)`).
4. **Line spacing** — segmented, three options "Tight / Normal / Loose" (existing `lineSpacing` enum values).
5. **Margins** — segmented, three options "Narrow / Normal / Wide" (existing `margin` enum values).

The popover uses the same outside-click dismissal (`mousedown` listener with `settingsRef`) as today.

---

## Theme variants for the reader

The existing `THEME_CLASSES` map should be updated to:

| Theme | Background | Text |
|---|---|---|
| `light` | `#fcf9f6` | `#2a2620` |
| `parchment` (was `sepia`) | `#e7dcc4` | `#4a3f2a` |
| `dark` | `#2a2620` | `#f0ebe2` |

If renaming the enum value is risky for the `firestore.rules` validation of `ReaderPreferences` (it pins exact string values), keep the stored value as `sepia` and only relabel the UI to "Parchment" + swap its swatch colors. **Do not change `firestore.rules` without the corresponding hook + rule deploy** (see CLAUDE.md in the repo).

---

## Interactions & behavior (unchanged from today)

- **Sign-in:** click → existing Google popup via Firebase Auth (`useAuth().signIn`).
- **Add story:** unchanged Server Action + Gemini flow. The pagination invariant in CLAUDE.md (regex `/<p[\s\S]*?<\/p>|<hr>/gi`, 4 elements/page) is **load-bearing** — keep it identical between library.tsx and reader.tsx.
- **Open story:** click card → `setSelectedStory(story)`.
- **Delete story:** hover-reveal trash icon → `deleteDoc`. Stop propagation.
- **Page advance in reader:** updates local state then `updateDoc({ currentPage })`. Smooth-scroll to top.
- **Outside-click dismiss** for the popover (existing).
- All transitions: 150ms `ease-out` (`--transition-fast`) for hovers, 200ms `ease-out` (`--transition-base`) for card lift, 300ms (`--transition-slow`) reserved for theme swaps.

## State management

No new state. Reuse:
- `components/auth-provider.tsx` → `useAuth()` for `user`, `signIn`, `logOut`.
- `components/library.tsx` → existing `urlInput`, `loading`, `loadingStep`, `stories`, `selectedStory`, `errorMsg`, `LOADING_QUIPS`.
- `hooks/use-reader-preferences.ts` → `prefs`, `update`, `FONT_SIZE_PX`, `LINE_HEIGHT`, `MAX_WIDTH`, and the enums.
- Story Firestore writes are restricted to `currentPage` only; do not introduce new fields without updating `firestore.rules`.

## Design tokens

All values come from `colors_and_type.css` in this bundle. Drop-in summary:

**Colors**
- Background: `#d9d1c0`
- Surface: `#fcf9f6`
- Surface containers: lowest `#ffffff`, low `#f6f3f1`, base `#f1edea`, high `#ebe7e4`, highest `#e5e2df`
- Primary: `#665f51` (on-primary `#ffffff`)
- Secondary: `#605d57`
- Outline: `#7b7771`, outline-variant: `#c9c5c1`
- Text: `#2a2620`, text-muted: `#665f51`, text-subtle: `#7b7771`
- Link: `#665f51`, link-hover: `#3d3830`
- Destructive: `#7a3f3f`, success: `#3d5c3e`, warning: `#7a6030`

**Spacing** — 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 / 80 / 96 px

**Radii** — sm 4px, base 8px, md 12px, lg 16px, full 9999px

**Shadows** — see the `--shadow-xs/sm/md/lg` definitions in the CSS file.

**Typography**
- Family: `Newsreader` (Google Fonts, weights 300/400/500/600/700, italics 300/400/700) for everything; system mono for `<code>`. There is **no separate sans face** — the "Sans" reader option drops to `system-ui, sans-serif`.
- Scale: 12 / 14 / 16 / 18 / 20 / 24 / 30 / 36 / 48 / 60 px.
- Line heights: tight 1.25, snug 1.375, normal 1.5, relaxed 1.625, loose 1.75.
- Tracking: tight `-0.025em`, normal `0`, wide `0.025em`, wider `0.05em`, widest `0.1em`.

**Transitions** — fast 150ms, base 200ms, slow 300ms; all `ease-out`.

## Assets

- **Wordmark**: typographic only — no logo file. Construction is in `StoryVault.html` (`Wordmark` component): four vertical bars (heights 55%/85%/100%/70% of size; widths max(2px, 13% of size); first three `--color-primary`, fourth `--color-outline`) followed by "Story*Vault*" with "Vault" italicized in `--color-text-muted`. Reproduce as a small React component.
- **Icons**: lucide-react (already a dependency). Used: `ArrowLeft`, `ChevronLeft`, `ChevronRight`, `ExternalLink`, `LogOut`, `Plus`, `Trash2`, `Type`. The `Aa` button uses no icon — it's typographic.
- **No imagery**, no photography, no illustrations.

## Files to change in the codebase

- `app/page.tsx` — sign-in screen styling.
- `app/globals.css` — import / inline the tokens from `colors_and_type.css`.
- `tailwind.config.ts` (if present) — extend `theme.colors`, `theme.fontFamily`, `theme.spacing`, `theme.borderRadius`, `theme.boxShadow` to expose the tokens as utility classes.
- `components/library.tsx` — header, intake card, section head + filters, story-card grid. Behavior unchanged.
- `components/reader.tsx` — header, body typography (drop-cap, small-caps, ornaments), footer with hairline track, popover redesign.
- `hooks/use-reader-preferences.ts` — only if you decide to rename `sepia` → `parchment` (then update `firestore.rules` `isValidReaderPreferences` and redeploy rules).

## Files NOT to change

- `lib/firebase.ts` — keep `getFirestore(app, firebaseConfig.firestoreDatabaseId)`. The inline comment is correct.
- `lib/fetchHtml.ts` — Server Action, unchanged.
- The Gemini prompt and schema in `library.tsx#handleAddStory` — unchanged.
- The pagination regex / 4-elements-per-page invariant.
- `firestore.rules` — unless you rename `sepia` to `parchment`, in which case update `isValidReaderPreferences` and redeploy with `npx firebase deploy --only firestore:rules`.
