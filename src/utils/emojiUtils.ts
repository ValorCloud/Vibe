/**
 * Converts a Unicode emoji string into its local Twemoji SVG URL.
 *
 * Uses locally-bundled SVGs in `/twemoji/` so flag rendering is reliable even
 * when external CDNs are blocked by ad-blockers or corporate firewalls.
 *
 * Only variation selector U+FE0F is stripped — it never appears in Twemoji
 * filenames. U+200D (ZWJ) is intentionally preserved because it is part of
 * subdivision flag sequences (e.g. 🏴󠁧󠁢󠁥󠁮󠁧󠁿) and composite emoji filenames.
 *
 * NOTE: No module-level cache is used. A cache seeded during an early render
 * (e.g. from a stale fallback emoji) would persist for the entire session and
 * map the wrong SVG path to a correct emoji key. The codepoint computation is
 * O(n) on ≤8 chars — negligible compared to an <img> paint.
 */

function emojiToCodepoints(emoji: string): string {
  return [...emoji]
    .map(char => char.codePointAt(0)!)
    .filter(cp => cp !== 0xfe0f) // strip variation selector only
    .map(cp => cp.toString(16))
    .join('-');
}

export function emojiToTwemojiUrl(emoji: string): string {
  return `/twemoji/${emojiToCodepoints(emoji)}.svg`;
}

/**
 * Returns a pinned jsDelivr-hosted Twemoji CDN URL for the given emoji.
 *
 * Pinned to jdecked/twemoji@17.0.2 — same source as the local bundle
 * produced by copy-twemoji.mjs. Both stages must reference the same upstream
 * so SVG filenames, codepoints and rendering are consistent.
 *
 * Used as stage-2 fallback in EmojiSign when the local /twemoji/ bundle
 * is missing the SVG for a given emoji (e.g. first run before prebuild).
 */
export function emojiToTwemojiCdnUrl(emoji: string): string {
  return `https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0.2/assets/svg/${emojiToCodepoints(emoji)}.svg`;
}

/**
 * Returns true when every character in the string is a basic ASCII letter or
 * digit — i.e. NOT a Unicode emoji.  Used to guard against passing plain
 * country-code text (e.g. "EN") to emojiToTwemojiUrl, which only works with
 * actual emoji code-points.
 */
export function isPlainAscii(text: string): boolean {
  return /^[\x20-\x7E]*$/.test(text);
}
