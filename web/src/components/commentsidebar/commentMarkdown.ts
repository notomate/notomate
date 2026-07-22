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

export const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: false,
}).use(mentionPlugin).use(taskListPlugin)

export function mentionToken(label: string, userId: string): string {
  return `@[${label}](${userId})`
}

export function renderCommentBody(body: string): string {
  return md.render(body || '')
}
