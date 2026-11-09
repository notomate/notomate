import { randomUUID } from 'node:crypto'
import { marked } from 'marked'
import { htmlToInline, htmlToPlain } from '@notomate/editor/convert'

/**
 * Markdown ↔ editor blocks, the form agents read and write notes in.
 *
 * A block is { id, type, html, props, children, parentId } (see
 * packages/editor/src/editor/model/types.ts); `html` is the editor's whitelisted
 * inline HTML: b, i, s, code, a, br.
 */

/** Marks a block's id in a note rendered for editing. Stripped again on the way in. */
const BLOCK_ID_COMMENT = /<!--b:[A-Za-z0-9-]+-->[ \t]*/g

const DEFAULT_CELL_ATTRS = { colspan: 1, rowspan: 1, colwidth: null }
const SAFE_LINK = /^(https?:|mailto:)/i
const MAX_HEADING = 3

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escapeAttr = (s) => escapeHtml(s).replace(/"/g, '&quot;')
const newBlockId = () => randomUUID().replace(/-/g, '').slice(0, 16)

// ------------------------------------------------------------------ blocks → Markdown

function escapeMarkdown(text) {
  return text.replace(/[\\*`[\]~]/g, '\\$&').replace(/(?<![A-Za-z0-9])_|_(?![A-Za-z0-9])/g, '\\_')
}

function inlineNode(node) {
  if (node.type === 'hardBreak') return '  \n'
  if (node.type === 'mention') return `@${node.attrs?.label ?? node.attrs?.id ?? ''}`
  if (node.type !== 'text') return ''
  const marks = node.marks ?? []
  if (marks.some((m) => m.type === 'code')) return `\`${node.text}\``
  let out = escapeMarkdown(node.text)
  for (const mark of marks) {
    if (mark.type === 'bold') out = `**${out}**`
    else if (mark.type === 'italic') out = `*${out}*`
    else if (mark.type === 'strike') out = `~~${out}~~`
    else if (mark.type === 'link') out = `[${out}](${mark.attrs?.href ?? ''})`
  }
  return out
}

export const inlineHtmlToMarkdown = (html) => htmlToInline(html ?? '').map(inlineNode).join('')

function tableToMarkdown(rows = []) {
  if (!rows.length) return ''
  const cell = (c) => inlineHtmlToMarkdown(c.html).replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ')
  const line = (row) => `| ${row.map(cell).join(' | ')} |`
  const [head, ...body] = rows
  return [line(head), `| ${head.map(() => '---').join(' | ')} |`, ...body.map(line)].join('\n')
}

function blockToMarkdown(block, number) {
  const text = inlineHtmlToMarkdown(block.html)
  const heading = /^h([1-6])$/.exec(block.type)
  if (heading) return `${'#'.repeat(Number(heading[1]))} ${text}`
  switch (block.type) {
    case 'paragraph':
      return text
    case 'bullet':
      return `- ${text}`
    case 'numbered':
      return `${number}. ${text}`
    case 'todo':
      return `- [${block.props?.checked ? 'x' : ' '}] ${text}`
    case 'toggle':
      return `▸ ${text}`
    case 'quote':
      return `> ${text}`
    case 'callout':
      return `> ${block.props?.icon ?? ''} ${text}`.replace(/> {2}/, '> ')
    case 'code':
      return `\`\`\`${block.props?.language ?? ''}\n${htmlToPlain(block.html)}\n\`\`\``
    case 'divider':
      return '---'
    case 'table':
      return tableToMarkdown(block.props?.rows)
    case 'image':
      return block.props?.src && !String(block.props.src).startsWith('data:') ? `![](${block.props.src})` : '[image]'
    default:
      return `[embedded ${block.type} block]`
  }
}

const isListType = (type) => type === 'bullet' || type === 'numbered' || type === 'todo'

/** Render a note. With `blockIds`, each block is prefixed by the id editing tools take. */
export function docToMarkdown({ blocks, rootIds }, { blockIds = false } = {}) {
  const lines = []
  const walk = (ids, depth) => {
    let number = 0
    let previous = null
    for (const id of ids) {
      const block = blocks[id]
      if (!block) continue
      number = block.type === previous ? number + 1 : 1
      const start = typeof block.props?.start === 'number' && number === 1 ? block.props.start : number
      const indent = '  '.repeat(depth)
      const prefix = blockIds ? `<!--b:${block.id}--> ` : ''
      const body = blockToMarkdown(block, start)
      if (lines.length && !(isListType(block.type) && (isListType(previous) || depth > 0))) lines.push('')
      lines.push(indent + prefix + body.split('\n').join(`\n${indent}`))
      previous = block.type
      walk(block.children ?? [], depth + 1)
    }
  }
  walk(rootIds, 0)
  return lines.join('\n')
}

/** A note's text on one line, for search results. */
export function docToPlainText({ blocks, rootIds }) {
  const parts = []
  const walk = (ids) => {
    for (const id of ids) {
      const block = blocks[id]
      if (!block) continue
      if (block.html) parts.push(htmlToPlain(block.html))
      walk(block.children ?? [])
    }
  }
  walk(rootIds)
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

// ------------------------------------------------------------------ Markdown → blocks

function inlineTokens(tokens = []) {
  return tokens
    .map((token) => {
      switch (token.type) {
        case 'strong':
          return `<b>${inlineTokens(token.tokens)}</b>`
        case 'em':
          return `<i>${inlineTokens(token.tokens)}</i>`
        case 'del':
          return `<s>${inlineTokens(token.tokens)}</s>`
        case 'codespan':
          return `<code>${escapeHtml(token.text)}</code>`
        case 'br':
          return '<br>'
        case 'link': {
          const label = inlineTokens(token.tokens)
          return SAFE_LINK.test(token.href) ? `<a href="${escapeAttr(token.href)}">${label}</a>` : label
        }
        case 'image':
          return SAFE_LINK.test(token.href)
            ? `<a href="${escapeAttr(token.href)}">${escapeHtml(token.text || token.href)}</a>`
            : escapeHtml(token.text ?? '')
        case 'text':
          return token.tokens ? inlineTokens(token.tokens) : escapeHtml(token.text)
        default:
          // Raw inline HTML and anything else stays visible as plain text.
          return escapeHtml(token.text ?? token.raw ?? '')
      }
    })
    .join('')
}

/** Parse Markdown into detached blocks: { blocks, rootIds }, roots with parentId null. */
export function markdownToBlocks(markdown) {
  const blocks = {}

  const add = (type, html, props, parentId) => {
    const block = { id: newBlockId(), type, html, props, children: [], parentId }
    blocks[block.id] = block
    return block
  }

  /** The first text-like token becomes the block's text, the rest its children. */
  const container = (type, props, tokens, parentId) => {
    const [first, ...rest] = tokens
    const hasText = first && (first.type === 'text' || first.type === 'paragraph')
    const block = add(type, hasText ? inlineTokens(first.tokens ?? [first]) : '', props, parentId)
    block.children = walk(hasText ? rest : tokens, block.id)
    return block.id
  }

  function walk(tokens, parentId) {
    const ids = []
    for (const token of tokens) {
      switch (token.type) {
        case 'space':
          break
        case 'heading':
          ids.push(add(`h${Math.min(MAX_HEADING, token.depth)}`, inlineTokens(token.tokens), {}, parentId).id)
          break
        case 'paragraph': {
          const only = token.tokens?.length === 1 ? token.tokens[0] : null
          if (only?.type === 'image' && SAFE_LINK.test(only.href)) {
            ids.push(add('image', '', { src: only.href }, parentId).id)
          } else {
            ids.push(add('paragraph', inlineTokens(token.tokens), {}, parentId).id)
          }
          break
        }
        case 'text':
          ids.push(add('paragraph', inlineTokens(token.tokens ?? [token]), {}, parentId).id)
          break
        case 'list':
          token.items.forEach((item, index) => {
            if (item.task) {
              ids.push(container('todo', { checked: !!item.checked }, item.tokens, parentId))
            } else if (token.ordered) {
              const start = index === 0 && typeof token.start === 'number' && token.start !== 1 ? { start: token.start } : {}
              ids.push(container('numbered', start, item.tokens, parentId))
            } else {
              ids.push(container('bullet', {}, item.tokens, parentId))
            }
          })
          break
        case 'blockquote':
          ids.push(container('quote', {}, token.tokens, parentId))
          break
        case 'code':
          ids.push(add('code', escapeHtml(token.text), { language: token.lang || null }, parentId).id)
          break
        case 'hr':
          ids.push(add('divider', '', {}, parentId).id)
          break
        case 'table': {
          const row = (cells, header) =>
            cells.map((cell) => ({ html: inlineTokens(cell.tokens), header, attrs: { ...DEFAULT_CELL_ATTRS } }))
          const rows = [row(token.header, true), ...token.rows.map((r) => row(r, false))]
          ids.push(add('table', '', { rows }, parentId).id)
          break
        }
        default:
          // Block-level HTML: keep it readable instead of dropping it.
          if (token.raw?.trim()) ids.push(add('paragraph', escapeHtml(token.raw.trim()), {}, parentId).id)
      }
    }
    return ids
  }

  const source = markdown.replace(BLOCK_ID_COMMENT, '')
  return { blocks, rootIds: walk(marked.lexer(source, { gfm: true }), null) }
}
