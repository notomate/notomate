import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import MarkdownIt from 'markdown-it'
import i18n from '@/i18n'
import { toast } from '@/stores/toast'

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false,
  breaks: true,
}).enable('table')

const looksLikeMarkdown = (text: string): boolean => {
  const patterns = [
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
  ]
  return patterns.some(p => p.test(text))
}

// Collect image files directly from clipboard (for screenshots / file system copy)
const getClipboardImageFiles = (clipboardData: DataTransfer): File[] => {
  const seen = new Set<string>()
  const images: File[] = []

  const tryAdd = (file: File | null) => {
    if (!file || !file.type.startsWith('image/')) return
    const key = `${file.name}:${file.size}:${file.type}`
    if (!seen.has(key)) { seen.add(key); images.push(file) }
  }

  Array.from(clipboardData.files).forEach(tryAdd)
  Array.from(clipboardData.items).forEach(item => {
    try { tryAdd(item.getAsFile()) } catch {}
  })

  return images
}

// Fetch an external image URL and return as a File
const fetchImageAsFile = async (src: string): Promise<File | null> => {
  try {
    const res = await fetch(src, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    if (!blob.type.startsWith('image/')) return null
    const ext = blob.type.split('/')[1]?.split('+')[0] || 'png'
    // Use URL constructor to strip query params/fragments before extracting filename
    let basename = ''
    try { basename = new URL(src).pathname.split('/').pop() || '' } catch { basename = src.split('/').pop()?.split('?')[0] || '' }
    const filename = basename || `image.${ext}`
    return new File([blob], filename, { type: blob.type })
  } catch {
    return null
  }
}

interface PasteHandlerOptions {
  upload: (file: File, onProgress?: (percent: number) => void) => Promise<{ src: string; name: string }>
}

export const PasteHandler = Extension.create<PasteHandlerOptions>({
  name: 'pasteHandler',

  addOptions() {
    return {
      upload: async (file: File) => ({
        src: URL.createObjectURL(file),
        name: file.name,
      }),
    }
  },

  addProseMirrorPlugins() {
    const { upload } = this.options
    const editor = this.editor

    return [
      new Plugin({
        key: new PluginKey('pasteHandler'),
        props: {
          handleDOMEvents: {
            paste: (_view, event) => {
              const clipboardData = (event as ClipboardEvent).clipboardData
              if (!clipboardData) return false

              // 1. Image file in clipboard (screenshot / copy from file manager)
              const imageFiles = getClipboardImageFiles(clipboardData)
              if (imageFiles.length > 0) {
                event.preventDefault()
                event.stopPropagation()
                imageFiles.forEach(file => {
                  upload(file).then(({ src, name }) => {
                    editor.commands.insertContent({ type: 'image', attrs: { src, name } })
                  }).catch(() => {
                    toast.error(i18n.t('files.upload_error'))
                  })
                })
                return true
              }

              // 2. HTML with <img> tags (copy from browser)
              const hasHTML = clipboardData.types.includes('text/html')
              if (hasHTML) {
                const rawHtml = clipboardData.getData('text/html')
                const parsed = new DOMParser().parseFromString(rawHtml, 'text/html')
                const imgEls = Array.from(parsed.querySelectorAll('img'))

                if (imgEls.length > 0) {
                  event.preventDefault()
                  event.stopPropagation()
                  ;(async () => {
                    await Promise.all(
                      imgEls.map(async (img) => {
                        const src = img.getAttribute('src')
                        if (!src) { img.remove(); return }
                        const file = await fetchImageAsFile(src)
                        if (!file) { img.remove(); return }
                        let uploaded: { src: string; name: string }
                        try {
                          uploaded = await upload(file)
                        } catch {
                          toast.error(i18n.t('files.upload_error'))
                          img.remove()
                          return
                        }
                        const { src: uploadedSrc, name } = uploaded
                        // Replace <img> with our custom image-node tag so TipTap picks it up
                        const node = parsed.createElement('image-node')
                        node.setAttribute('src', uploadedSrc)
                        node.setAttribute('name', name)
                        img.replaceWith(node)
                      })
                    )
                    editor.commands.insertContent(parsed.body.innerHTML)
                  })()
                  return true
                }
              }

              // 3. Markdown text (no HTML in clipboard)
              if (!hasHTML) {
                const text = clipboardData.getData('text/plain')
                if (text && looksLikeMarkdown(text)) {
                  event.preventDefault()
                  event.stopPropagation()
                  editor.commands.insertContent(md.render(text))
                  return true
                }
              }

              return false
            },
          },
        },
      }),
    ]
  },
})
