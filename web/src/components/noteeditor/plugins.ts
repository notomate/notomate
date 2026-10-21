import MarkdownIt from 'markdown-it'
import {
  createBlock,
  fragmentFromHtml,
  insertFragment,
  type EditorPlugin,
  type Fragment,
  type InlineTriggerItem,
} from '@notomate/editor'
import type { WorkspaceMember } from '@/api/workspace'

// ---------------------------------------------------------------- paste

const md = new MarkdownIt({ html: false, linkify: true, typographer: false, breaks: true }).enable('table')

const looksLikeMarkdown = (text: string): boolean =>
  [
    /^#{1,6}\s/m,
    /\*\*[^*]+\*\*/,
    /^[-*+]\s/m,
    /^\d+\.\s/m,
    /^>\s/m,
    /```[\s\S]*?```/,
    /`[^`\n]+`/,
    /\[[^\]]+\]\([^)]+\)/,
    /^\|.+\|/m,
    /^---+$/m,
  ].some((p) => p.test(text))

/** Image files on the clipboard (screenshots, copies from a file manager), without duplicates. */
function clipboardImages(data: DataTransfer): File[] {
  const seen = new Set<string>()
  const images: File[] = []
  const add = (file: File | null) => {
    if (!file || !file.type.startsWith('image/')) return
    const key = `${file.name}:${file.size}:${file.type}`
    if (!seen.has(key)) {
      seen.add(key)
      images.push(file)
    }
  }
  Array.from(data.files).forEach(add)
  Array.from(data.items).forEach((item) => {
    try {
      add(item.getAsFile())
    } catch {
      /* not a file */
    }
  })
  return images
}

/** Download an image from another site so it can be uploaded to the workspace. */
async function fetchImageAsFile(src: string): Promise<File | null> {
  try {
    const res = await fetch(src, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    if (!blob.type.startsWith('image/')) return null
    const ext = blob.type.split('/')[1]?.split('+')[0] || 'png'
    let basename = ''
    try {
      basename = new URL(src).pathname.split('/').pop() || ''
    } catch {
      basename = src.split('/').pop()?.split('?')[0] || ''
    }
    return new File([blob], basename || `image.${ext}`, { type: blob.type })
  } catch {
    return null
  }
}

/** Element that pasted HTML uses for an image being uploaded; the image block parses it. */
export const PENDING_IMAGE_TAG = 'notomate-image'

function imageBlocks(files: File[], startUpload: (file: File) => string): Fragment {
  const blocks = files.map((f) => createBlock('image', '', { name: f.name, uploadId: startUpload(f) }))
  return { blocks: Object.fromEntries(blocks.map((b) => [b.id, b])), rootIds: blocks.map((b) => b.id) }
}

/**
 * Notomate paste handling, as the TipTap editor had it:
 * 1. image files: inserted at once and uploaded, showing a local preview meanwhile;
 * 2. HTML with images (copied from a browser): the images are re-uploaded;
 * 3. Markdown text: converted to blocks.
 */
export function pastePlugin(startImageUpload: (file: File) => string): EditorPlugin {
  return {
    name: 'notomate-paste',
    onPaste(data, { blockId, plain }) {
      if (plain) return false

      const files = clipboardImages(data)
      if (files.length) {
        insertFragment(blockId, imageBlocks(files, startImageUpload))
        return true
      }

      const html = data.getData('text/html')
      if (html) {
        const parsed = new DOMParser().parseFromString(html, 'text/html')
        const images = Array.from(parsed.querySelectorAll('img'))
        if (!images.length) return false
        void (async () => {
          await Promise.all(
            images.map(async (img) => {
              const src = img.getAttribute('src')
              const file = src ? await fetchImageAsFile(src) : null
              if (!file) {
                img.remove()
                return
              }
              const pending = parsed.createElement(PENDING_IMAGE_TAG)
              pending.setAttribute('data-name', file.name)
              pending.setAttribute('data-upload-id', startImageUpload(file))
              img.replaceWith(pending)
            }),
          )
          const frag = fragmentFromHtml(parsed.body.innerHTML)
          if (frag) insertFragment(blockId, frag)
        })()
        return true
      }

      const text = data.getData('text/plain')
      if (text && looksLikeMarkdown(text)) {
        const frag = fragmentFromHtml(md.render(text))
        if (frag) {
          insertFragment(blockId, frag)
          return true
        }
      }
      return false
    },
  }
}

// ---------------------------------------------------------------- mentions

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** `@` suggestions from the workspace members (read when typing, so the list stays current). */
export function mentionPlugin(members: () => WorkspaceMember[], label?: string): EditorPlugin {
  return {
    name: 'notomate-mention',
    inlineTriggers: [
      {
        char: '@',
        label,
        items: (query): InlineTriggerItem[] => {
          const q = query.toLowerCase()
          return members()
            .filter((m) => m.user_name.toLowerCase().includes(q) || m.user_email.toLowerCase().includes(q))
            .slice(0, 8)
            .map((m) => ({
              id: m.user_id,
              label: m.user_name,
              hint: m.user_email,
              html:
                `<span data-mention="" data-id="${escapeHtml(m.user_id)}" data-label="${escapeHtml(m.user_name)}"` +
                ` data-char="@" contenteditable="false">@${escapeHtml(m.user_name)}</span>`,
            }))
        },
      },
    ],
  }
}
