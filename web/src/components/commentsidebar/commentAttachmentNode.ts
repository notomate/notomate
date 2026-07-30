import { Node, mergeAttributes } from "@tiptap/core"

// Mirrors the ![name](url) markdown produced for uploaded files (see commentDocConvert.ts /
// commentMarkdown.ts). Kept as an atomic inline node so it can sit alongside text in a message
// and round-trips losslessly when a message with an attachment is re-opened for editing.
export const CommentAttachment = Node.create({
  name: "commentAttachment",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      url: { default: null },
      name: { default: null },
      isImage: { default: false },
    }
  },

  parseHTML() {
    return [
      {
        tag: "span[data-comment-attachment]",
        getAttrs: (dom) => ({
          url: (dom as HTMLElement).getAttribute("url"),
          name: (dom as HTMLElement).getAttribute("name"),
          isImage: (dom as HTMLElement).getAttribute("isimage") === "true",
        }),
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs = mergeAttributes(HTMLAttributes, {
      "data-comment-attachment": "",
      class: "note-comment-attachment-chip",
      contenteditable: "false",
    })
    if (node.attrs.isImage) {
      return ["span", attrs, ["img", { src: node.attrs.url, alt: node.attrs.name }]]
    }
    return ["span", attrs, ["span", {}, node.attrs.name || node.attrs.url]]
  },
})
