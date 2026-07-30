import MarkdownIt from 'markdown-it'
import Token from 'markdown-it/lib/token.mjs'

// Mentions are stored inline in the comment body as @[Display Name](userId),
// e.g. "thanks @[Jane Doe](2f6a...) can you take a look?"
const MENTION_RE = /^@\[([^\]]+)\]\(([\w-]+)\)/

function mentionPlugin(md: MarkdownIt) {
  md.inline.ruler.before('link', 'mention', (state, silent) => {
    const match = MENTION_RE.exec(state.src.slice(state.pos))
    if (!match) return false

    if (!silent) {
      const token = state.push('mention', '', 0)
      token.meta = { label: match[1], userId: match[2] }
    }

    state.pos += match[0].length
    return true
  })

  md.renderer.rules.mention = (tokens, idx) => {
    const { label, userId } = tokens[idx].meta
    return `<span class="note-comment-mention" data-user-id="${md.utils.escapeHtml(userId)}">@${md.utils.escapeHtml(label)}</span>`
  }
}

// GFM task list items: "- [ ] todo" / "- [x] done" at the start of a list item.
const TASK_RE = /^\[([ xX])\]\s+/

function taskListPlugin(md: MarkdownIt) {
  md.core.ruler.after('inline', 'comment-task-list', state => {
    const { tokens } = state
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== 'list_item_open') continue

      let inline: Token | null = null
      for (let j = i + 1; j < tokens.length && tokens[j].type !== 'list_item_close'; j++) {
        if (tokens[j].type === 'inline') {
          inline = tokens[j]
          break
        }
      }
      if (!inline) continue

      const match = TASK_RE.exec(inline.content)
      if (!match) continue

      inline.content = inline.content.slice(match[0].length)
      const textChild = inline.children?.[0]
      if (textChild?.type === 'text') {
        textChild.content = textChild.content.slice(match[0].length)
      }

      const checked = match[1].toLowerCase() === 'x'
      const checkbox = new Token('html_inline', '', 0)
      checkbox.content = `<input type="checkbox" disabled${checked ? ' checked' : ''} class="note-comment-task-checkbox" />`
      inline.children?.unshift(checkbox)

      tokens[i].attrJoin('class', 'note-comment-task-item')
    }
  })
}

// Uploaded files are embedded as standard markdown images (![name](url), see
// commentDocConvert.ts). Whether they render as an inline thumbnail or a downloadable
// file chip depends on the URL's extension.
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i

export function isImageAttachmentUrl(url: string): boolean {
  return IMAGE_EXT_RE.test(url.split('?')[0].split('#')[0])
}

function attachmentPlugin(md: MarkdownIt) {
  md.renderer.rules.image = (tokens, idx, _options, _env, self) => {
    const token = tokens[idx]
    const url = token.attrGet('src') || ''
    const name = self.renderInlineAsText(token.children || [], _options, _env) || url
    const safeUrl = md.utils.escapeHtml(url)
    const safeName = md.utils.escapeHtml(name)

    if (isImageAttachmentUrl(url)) {
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="note-comment-attachment-image"><img src="${safeUrl}" alt="${safeName}" loading="lazy" /></a>`
    }
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="note-comment-attachment-file"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg><span>${safeName}</span></a>`
  }
}

export const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: false,
}).use(mentionPlugin).use(taskListPlugin).use(attachmentPlugin)

export function mentionToken(label: string, userId: string): string {
  return `@[${label}](${userId})`
}

export function renderCommentBody(body: string): string {
  return md.render(body || '')
}
