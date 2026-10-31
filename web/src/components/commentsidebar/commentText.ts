import { mentionToken } from "./commentMarkdown"

// The comment editor is a plain textarea over the stored markdown (see commentMarkdown.ts).
// Mentions are shown as "@Name" while editing and stored as @[Name](userId); these helpers
// convert between the two and implement the toolbar's markdown edits.

export interface MentionRef {
  label: string
  id: string
}

const MENTION_TOKEN_RE = /@\[([^\]]+)\]\(([\w-]+)\)/g

/** Stored markdown → textarea text, plus the mentions it contained. */
export function markdownToText(markdown: string): { text: string; mentions: MentionRef[] } {
  const mentions: MentionRef[] = []
  const text = (markdown || "").replace(MENTION_TOKEN_RE, (_, label: string, id: string) => {
    mentions.push({ label, id })
    return `@${label}`
  })
  return { text, mentions }
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** Textarea text → stored markdown. Every "@Name" matching a known mention becomes a token. */
export function textToMarkdown(text: string, mentions: Map<string, string>): string {
  const labels = [...mentions.keys()].filter(Boolean).sort((a, b) => b.length - a.length)
  if (!labels.length) return text
  // Longest labels first so "@Ann Lee" wins over "@Ann"; the label must stand alone.
  const re = new RegExp(`(?<![\\p{L}\\p{N}_])@(${labels.map(escapeRegExp).join("|")})(?![\\p{L}\\p{N}_])`, "gu")
  return text.replace(re, (_, label: string) => mentionToken(label, mentions.get(label)!))
}

/** An edit to apply to the textarea: replace [start, end) with `insert`, then select [selStart, selEnd). */
export interface TextEdit {
  start: number
  end: number
  insert: string
  selStart: number
  selEnd: number
}

/** Wraps the selection in an inline marker such as "**", or inserts an empty pair at the caret. */
export function wrapSelection(text: string, start: number, end: number, marker: string): TextEdit {
  const selected = text.slice(start, end)
  return {
    start,
    end,
    insert: `${marker}${selected}${marker}`,
    selStart: start + marker.length,
    selEnd: end + marker.length,
  }
}

function lineRange(text: string, start: number, end: number) {
  const lineStart = text.lastIndexOf("\n", start - 1) + 1
  const nextBreak = text.indexOf("\n", end)
  return { lineStart, lineEnd: nextBreak === -1 ? text.length : nextBreak }
}

/** Prefixes every line touched by the selection, e.g. "- " or "> ". */
export function prefixLines(text: string, start: number, end: number, prefix: (index: number) => string): TextEdit {
  const { lineStart, lineEnd } = lineRange(text, start, end)
  const insert = text.slice(lineStart, lineEnd).split("\n").map((line, i) => prefix(i) + line).join("\n")
  return { start: lineStart, end: lineEnd, insert, selStart: lineStart + insert.length, selEnd: lineStart + insert.length }
}

/** Fences the lines touched by the selection as a code block. */
export function fenceLines(text: string, start: number, end: number): TextEdit {
  const { lineStart, lineEnd } = lineRange(text, start, end)
  const body = text.slice(lineStart, lineEnd)
  const insert = "```\n" + body + "\n```"
  const caret = lineStart + 4 + body.length
  return { start: lineStart, end: lineEnd, insert, selStart: caret, selEnd: caret }
}

/** The "@query" being typed right before the caret, if any. */
export function activeMention(text: string, caret: number): { from: number; query: string } | null {
  const match = /(?:^|\s)@([^\s@]{0,30})$/.exec(text.slice(0, caret))
  if (!match) return null
  return { from: caret - match[1].length - 1, query: match[1] }
}
