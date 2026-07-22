import type { JSONContent } from "@tiptap/core"
import Token from "markdown-it/lib/token.mjs"
import { md, mentionToken } from "./commentMarkdown"

// Converts between the flat markdown string comments are stored/rendered as (see
// commentMarkdown.ts) and the ProseMirror doc shape the comment editor operates on.
// Only the subset of markdown that editor actually supports is round-tripped:
// bold/italic/strike/code, bullet/ordered/task lists, blockquotes, fenced code, mentions.

interface Frame {
  type: string
  content: JSONContent[]
  attrs?: Record<string, unknown>
}

function parseInline(children: Token[], taskAttrsTarget: Frame | undefined): JSONContent[] {
  const nodes: JSONContent[] = []
  const activeMarks: string[] = []

  children.forEach((child, i) => {
    switch (child.type) {
      case "text":
        if (child.content) {
          nodes.push({ type: "text", text: child.content, marks: activeMarks.length ? activeMarks.map(m => ({ type: m })) : undefined })
        }
        break
      case "softbreak":
      case "hardbreak":
        nodes.push({ type: "hardBreak" })
        break
      case "code_inline":
        nodes.push({ type: "text", text: child.content, marks: [...activeMarks.map(m => ({ type: m })), { type: "code" }] })
        break
      case "mention":
        nodes.push({ type: "mention", attrs: { id: child.meta?.userId ?? null, label: child.meta?.label ?? null } })
        break
      case "html_inline":
        // Checkbox marker inserted by the task-list plugin; consume it into the parent
        // taskItem's `checked` attr instead of rendering it as text.
        if (i === 0 && taskAttrsTarget && /type="checkbox"/.test(child.content)) {
          taskAttrsTarget.attrs = { checked: /\bchecked\b/.test(child.content) }
        }
        break
      case "strong_open": activeMarks.push("bold"); break
      case "strong_close": activeMarks.pop(); break
      case "em_open": activeMarks.push("italic"); break
      case "em_close": activeMarks.pop(); break
      case "s_open": activeMarks.push("strike"); break
      case "s_close": activeMarks.pop(); break
      default:
        // link_open/link_close and anything else fall through: their inner text tokens
        // still get processed, we just don't model the mark (auto-linkified on render).
        break
    }
  })

  return nodes
}

function groupListRuns(items: JSONContent[]): JSONContent[] {
  const lists: JSONContent[] = []
  for (const item of items) {
    const wrapperType = item.type === "taskItem" ? "taskList" : "bulletList"
    const last = lists[lists.length - 1]
    if (last && last.type === wrapperType) {
      last.content!.push(item)
    } else {
      lists.push({ type: wrapperType, content: [item] })
    }
  }
  return lists
}

export function markdownToDoc(body: string): JSONContent {
  const tokens = md.parse(body || "", {})
  const root: JSONContent[] = []
  const stack: Frame[] = []

  const pushNode = (node: JSONContent) => {
    if (stack.length) stack[stack.length - 1].content.push(node)
    else root.push(node)
  }

  tokens.forEach(tok => {
    switch (tok.type) {
      case "paragraph_open":
      case "heading_open":
        stack.push({ type: "paragraph", content: [] })
        break
      case "paragraph_close":
      case "heading_close": {
        const frame = stack.pop()!
        pushNode({ type: "paragraph", content: frame.content.length ? frame.content : undefined })
        break
      }
      case "bullet_list_open":
        stack.push({ type: "bulletList", content: [] })
        break
      case "bullet_list_close": {
        const frame = stack.pop()!
        // CommonMark merges adjacent "-"-marked lists into one, so a taskList written right
        // after a bulletList (or vice versa, e.g. from markdown predating the "*" task marker)
        // can arrive here as a single list mixing listItem/taskItem children, which the
        // bulletList/taskList node schemas don't allow. Split back into runs of same-type items.
        groupListRuns(frame.content).forEach(pushNode)
        break
      }
      case "ordered_list_open":
        stack.push({ type: "orderedList", content: [] })
        break
      case "ordered_list_close": {
        const frame = stack.pop()!
        pushNode({ type: "orderedList", content: frame.content })
        break
      }
      case "list_item_open": {
        const isTask = /\bnote-comment-task-item\b/.test(tok.attrGet("class") || "")
        stack.push({ type: isTask ? "taskItem" : "listItem", content: [], attrs: isTask ? { checked: false } : undefined })
        break
      }
      case "list_item_close": {
        const frame = stack.pop()!
        pushNode({ type: frame.type, attrs: frame.attrs, content: frame.content.length ? frame.content : [{ type: "paragraph" }] })
        break
      }
      case "blockquote_open":
        stack.push({ type: "blockquote", content: [] })
        break
      case "blockquote_close": {
        const frame = stack.pop()!
        pushNode({ type: "blockquote", content: frame.content.length ? frame.content : [{ type: "paragraph" }] })
        break
      }
      case "fence":
      case "code_block": {
        const lang = tok.info?.trim()
        const text = tok.content.replace(/\n$/, "")
        pushNode({
          type: "codeBlock",
          attrs: lang ? { language: lang } : undefined,
          content: text ? [{ type: "text", text }] : undefined,
        })
        break
      }
      case "inline": {
        const paragraphFrame = stack[stack.length - 1]
        const parentFrame = stack[stack.length - 2]
        const isFirstBlockOfTaskItem = parentFrame?.type === "taskItem" && parentFrame.content.length === 0
        const nodes = parseInline(tok.children || [], isFirstBlockOfTaskItem ? parentFrame : undefined)
        if (paragraphFrame) paragraphFrame.content.push(...nodes)
        break
      }
      default:
        break
    }
  })

  return { type: "doc", content: root.length ? root : [{ type: "paragraph" }] }
}

function escapeMarkdown(text: string): string {
  return text.replace(/[\\`*_~[\]]/g, m => `\\${m}`)
}

function serializeInlineCode(text: string): string {
  const longestRun = (text.match(/`+/g) || []).reduce((max, run) => Math.max(max, run.length), 0)
  const fence = "`".repeat(longestRun + 1)
  const pad = longestRun > 0 ? " " : ""
  return `${fence}${pad}${text}${pad}${fence}`
}

function serializeText(text: string, marks: { type: string }[] = []): string {
  const hasMark = (name: string) => marks.some(m => m.type === name)
  if (hasMark("code")) return serializeInlineCode(text)
  let result = escapeMarkdown(text)
  if (hasMark("bold")) result = `**${result}**`
  if (hasMark("italic")) result = `*${result}*`
  if (hasMark("strike")) result = `~~${result}~~`
  return result
}

function serializeInline(nodes: JSONContent[] = []): string {
  return nodes.map(node => {
    switch (node.type) {
      case "text":
        return serializeText(node.text ?? "", node.marks)
      case "hardBreak":
        return "\n"
      case "mention":
        return mentionToken((node.attrs?.label as string) ?? (node.attrs?.id as string) ?? "", (node.attrs?.id as string) ?? "")
      default:
        return ""
    }
  }).join("")
}

function indentLines(text: string, prefix: string): string {
  const pad = " ".repeat(prefix.length)
  return text.split("\n").map((line, i) => {
    if (i === 0) return prefix + line
    return line ? pad + line : ""
  }).join("\n")
}

function serializeListItem(item: JSONContent, marker: string): string {
  return indentLines(serializeBlocks(item.content), `${marker} `)
}

function serializeBlock(node: JSONContent): string {
  switch (node.type) {
    case "paragraph":
      return serializeInline(node.content)
    case "codeBlock": {
      const lang = (node.attrs?.language as string) || ""
      const code = (node.content || []).map(c => c.text ?? "").join("")
      return "```" + lang + "\n" + code + "\n```"
    }
    case "blockquote":
      return serializeBlocks(node.content).split("\n").map(line => (line ? `> ${line}` : ">")).join("\n")
    case "bulletList":
      return (node.content || []).map(item => serializeListItem(item, "-")).join("\n")
    case "orderedList": {
      const start = (node.attrs?.start as number) || 1
      return (node.content || []).map((item, i) => serializeListItem(item, `${start + i}.`)).join("\n")
    }
    case "taskList":
      // Distinct bullet char from bulletList's "-": CommonMark merges adjacent lists that
      // share a marker into one list, which would swallow a taskList right after a bulletList.
      return (node.content || []).map(item => serializeListItem(item, item.attrs?.checked ? "* [x]" : "* [ ]")).join("\n")
    default:
      return ""
  }
}

function serializeBlocks(nodes: JSONContent[] = []): string {
  return nodes.map(serializeBlock).filter(s => s.length > 0).join("\n\n")
}

export function docToMarkdown(doc: JSONContent): string {
  return serializeBlocks(doc.content).trim()
}
