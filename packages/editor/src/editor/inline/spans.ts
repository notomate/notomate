/**
 * `<span>` kinds allowed in block HTML besides plain formatting. A span is kept only
 * when it carries a known marker attribute; everything else is unwrapped on paste.
 */
export interface InlineSpan {
  /** Marker attribute, e.g. `data-mention`. */
  attr: string;
  /** Validates the marker's value. Default: any value. */
  valid?: (value: string) => boolean;
  /** Further attributes to keep. */
  keep?: string[];
  /** An indivisible chip (mention): rendered non-editable, its text is not formatting-aware. */
  atomic?: boolean;
}

export const builtinSpans: readonly InlineSpan[] = [
  { attr: 'data-color', valid: (v) => /^[a-z_]+$/.test(v) },
  { attr: 'data-comment-thread-id', valid: (v) => /^[\w-]+$/.test(v) },
  { attr: 'data-mention', keep: ['data-id', 'data-label', 'data-char'], atomic: true },
];

let spans: readonly InlineSpan[] = builtinSpans;

export function setInlineSpans(extra: readonly InlineSpan[] = []) {
  spans = [...builtinSpans, ...extra];
}

export const inlineSpans = () => spans;
