export interface TipTapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface TipTapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  marks?: TipTapMark[];
  text?: string;
}

/** One table cell as stored in a `table` block's `props.rows`. */
export interface TableCell {
  html: string;
  header: boolean;
  /** TipTap cell attrs (colspan, rowspan, colwidth), kept verbatim. */
  attrs?: Record<string, unknown>;
}
