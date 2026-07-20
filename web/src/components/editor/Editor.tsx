import DragHandle from '@tiptap/extension-drag-handle-react'
import { TaskItem, TaskList } from "@tiptap/extension-list"
import { useEditor, EditorContext, EditorContent, findParentNode, posToDOMRect } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { Placeholder } from "@tiptap/extensions"
import { BubbleMenu } from "@tiptap/react/menus"
import { TableKit } from "@tiptap/extension-table"
import { Mention } from "@tiptap/extension-mention"
import { FC, useMemo, useRef, useEffect, useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "@tanstack/react-query"
import { GripVertical, ChevronUp, ChevronDown, Trash2, Heading1, Heading2, Heading3, Heading4, Heading5, Heading6, Image, Images, List, ListTodo, FileText, Paperclip, Quote, Table, Type, Video, Music, Youtube, CalendarDays, MapPin, Tag, Star, Map, Kanban, PenTool, Sheet, MessageSquarePlus } from 'lucide-react'
import { CommandItem, SlashCommand } from './extensions/slashcommand/SlashCommand'
import { createMentionSuggestion } from './extensions/mention/suggestion'
import { Attachment } from './extensions/attachment/Attachment'
import { ImageNode } from './extensions/imagenode/ImageNode'
import { PasteHandler } from './extensions/pastehandler/PasteHandler'
import { YoutubeEmbed } from './extensions/youtubeembed/YoutubeEmbed'
import { ThreadsEmbed } from './extensions/threadsembed/ThreadsEmbed'
import { InstagramEmbed } from './extensions/instagramembed/InstagramEmbed'
import { TiktokEmbed } from './extensions/tiktokembed/TiktokEmbed'
import { VideoNode } from './extensions/videonode/VideoNode'
import { CommentMark } from './extensions/comment/CommentMark'
import { AudioNode } from './extensions/audionode/AudioNode'
import { SubPageNode } from './extensions/subpagenode/SubPageNode'
import { ViewNode } from './extensions/viewnode/ViewNode'
import { createView, deleteView } from '@/api/view'
import { CalendarNode } from './extensions/calendarnode/CalendarNode'
import { LocationNode } from './extensions/locationnode/LocationNode'
import { TagsNode } from './extensions/tagsnode/TagsNode'
import { RatingNode } from './extensions/ratingnode/RatingNode'
import { CarouselNode } from './extensions/carouselnode/CarouselNode'
import { uploadFile, listFiles } from '@/api/file'
import useCurrentWorkspaceId from '@/hooks/use-currentworkspace-id'
import { createNote, NoteData } from '@/api/note'
import { getWorkspaceMembers, WorkspaceMember } from '@/api/workspace'
import * as Y from 'yjs'
import { DragMenuContext, type MenuAction } from './DragMenuContext'

interface Props {
  note: NoteData
  canDrag?: boolean
  onChange?: (data: any) => void
  yDoc?: Y.Doc | null
  yText?: Y.Map<any> | null
  yjsReady?: boolean
}

const DEFAULT_CONTENT = { type: 'doc', content: [{ type: 'paragraph' }] }

// Recursively remove empty text nodes that ProseMirror/TipTap disallows
const sanitizeContent = (node: any): any => {
  if (!node || typeof node !== 'object') return node;
  if (node.type === 'text') {
    return node.text ? node : null;
  }
  if (Array.isArray(node.content)) {
    return { ...node, content: node.content.map(sanitizeContent).filter(Boolean) };
  }
  return node;
}

const safeParse = (content: string) => {
  try {
    return { parsed: sanitizeContent(JSON.parse(content)) ?? DEFAULT_CONTENT, error: false }
  } catch {
    // Try to recover first valid JSON object (handles duplicated/corrupted content)
    try {
      let depth = 0
      const start = content.indexOf('{')
      if (start !== -1) {
        for (let i = start; i < content.length; i++) {
          if (content[i] === '{') depth++
          else if (content[i] === '}' && --depth === 0) {
            return { parsed: sanitizeContent(JSON.parse(content.slice(start, i + 1))) ?? DEFAULT_CONTENT, error: false }
          }
        }
      }
    } catch {}
    return { parsed: DEFAULT_CONTENT, error: true }
  }
}

const Editor: FC<Props> = ({
  note,
  onChange,
  canDrag = true,
  yDoc,
  yText,
  yjsReady
}) => {
  const currentWorkspaceId = useCurrentWorkspaceId()
  const { t } = useTranslation()
  const { data: workspaceMembers = [] } = useQuery({
    queryKey: ['workspaceMembers', currentWorkspaceId],
    queryFn: () => getWorkspaceMembers(currentWorkspaceId),
    enabled: !!currentWorkspaceId,
  })
  const workspaceMembersRef = useRef<WorkspaceMember[]>([])
  useEffect(() => {
    workspaceMembersRef.current = workspaceMembers
  }, [workspaceMembers])
  const { parsed: initialContent, error: contentError } = useMemo(() => safeParse(note.content), [note.content])
  const lastContentRef = useRef<string>(note.content)
  const isApplyingYjsUpdate = useRef(false)
  const isComposing = useRef(false)
  const pendingUpdate = useRef<{ content: string } | null>(null)
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        blockquote: {
          HTMLAttributes: {
            class: "border-l-4 pl-4 italic text-gray-600"
          }
        },
        codeBlock: {
          HTMLAttributes: {
            class: "rounded bg-gray-800 text-gray-100 p-4 font-mono text-sm"
          }
        }
      }),
      Placeholder.configure({
        placeholder: t("editor.placeholder")
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: 'list-none',
        },
      }),
      TaskItem,
      Attachment.configure({
        upload: async (f: File, onProgress?: (percent: number) => void) => {
          const res = await uploadFile(currentWorkspaceId, f, onProgress)

          return {
            src: `/api/v1/workspaces/${currentWorkspaceId}/files/${res.filename}`,
            name: res.original_name
          }
        },
        workspaceId: currentWorkspaceId,
        listFiles: listFiles
      }),
      ImageNode.configure({
        upload: async (f: File, onProgress?: (percent: number) => void) => {
          const res = await uploadFile(currentWorkspaceId, f, onProgress)

          return {
            src: `/api/v1/workspaces/${currentWorkspaceId}/files/${res.filename}`,
            name: res.original_name
          }
        },
        workspaceId: currentWorkspaceId,
        listFiles: listFiles
      }),
      YoutubeEmbed,
      ThreadsEmbed,
      InstagramEmbed,
      TiktokEmbed,
      CalendarNode,
      LocationNode,
      TagsNode,
      RatingNode,
      VideoNode.configure({
        upload: async (f: File, onProgress?: (percent: number) => void) => {
          const res = await uploadFile(currentWorkspaceId, f, onProgress)
          return {
            src: `/api/v1/workspaces/${currentWorkspaceId}/files/${res.filename}`,
            name: res.original_name
          }
        },
        workspaceId: currentWorkspaceId,
        listFiles: listFiles
      }),
      AudioNode.configure({
        upload: async (f: File, onProgress?: (percent: number) => void) => {
          const res = await uploadFile(currentWorkspaceId, f, onProgress)
          return {
            src: `/api/v1/workspaces/${currentWorkspaceId}/files/${res.filename}`,
            name: res.original_name
          }
        },
        workspaceId: currentWorkspaceId,
        listFiles: listFiles
      }),
      CarouselNode.configure({
        upload: async (f: File, onProgress?: (percent: number) => void) => {
          const res = await uploadFile(currentWorkspaceId, f, onProgress)
          return {
            src: `/api/v1/workspaces/${currentWorkspaceId}/files/${res.filename}`,
            name: res.original_name
          }
        },
        workspaceId: currentWorkspaceId,
        listFiles: listFiles
      }),
      TableKit,
      SubPageNode.configure({
        workspaceId: currentWorkspaceId,
        parentNoteId: note.id,
        createNote,
      }),
      ViewNode.configure({
        workspaceId: currentWorkspaceId,
        noteId: note.id,
        createView,
        deleteView,
      }),
      PasteHandler.configure({
        upload: async (f: File, onProgress?: (percent: number) => void) => {
          const res = await uploadFile(currentWorkspaceId, f, onProgress)
          return {
            src: `/api/v1/workspaces/${currentWorkspaceId}/files/${res.filename}`,
            name: res.original_name
          }
        },
      }),
      SlashCommand.configure({
        suggestion: {
          items: ({ query }: { query: string }): CommandItem[] => {
            return [
              // Text
              {
                icon: <Type size={14} />,
                label: t("editor.Paragraph"),
                category: 'text',
                keywords: ["text", "paragraph"],
                command: ({ editor }: any) =>
                  editor.chain().focus().setParagraph().run(),
              },
              {
                icon: <Heading1 size={16} />,
                label: t("editor.Heading 1"),
                category: 'text',
                keywords: ["h1", "title", "header", "heading"],
                command: ({ editor }: any) =>
                  editor.chain().focus().toggleHeading({ level: 1 }).run(),
              },
              {
                icon: <Heading2 size={16} />,
                label: t("editor.Heading 2"),
                category: 'text',
                keywords: ["h2", "title", "header", "heading"],
                command: ({ editor }: any) =>
                  editor.chain().focus().toggleHeading({ level: 2 }).run(),
              },
              {
                icon: <Heading3 size={16} />,
                label: t("editor.Heading 3"),
                category: 'text',
                keywords: ["h3", "title", "header", "heading"],
                command: ({ editor }: any) =>
                  editor.chain().focus().toggleHeading({ level: 3 }).run(),
              },
              {
                icon: <Heading4 size={16} />,
                label: t("editor.Heading 4"),
                category: 'text',
                keywords: ["h4", "title", "header", "heading"],
                command: ({ editor }: any) =>
                  editor.chain().focus().toggleHeading({ level: 4 }).run(),
              },
              {
                icon: <Heading5 size={16} />,
                label: t("editor.Heading 5"),
                category: 'text',
                keywords: ["h5", "title", "header", "heading"],
                command: ({ editor }: any) =>
                  editor.chain().focus().toggleHeading({ level: 5 }).run(),
              },
              {
                icon: <Heading6 size={16} />,
                label: t("editor.Heading 6"),
                category: 'text',
                keywords: ["h6", "title", "header", "heading"],
                command: ({ editor }: any) =>
                  editor.chain().focus().toggleHeading({ level: 6 }).run(),
              },
              // List
              {
                icon: <List size={16} />,
                label: t("editor.BulletList"),
                category: 'list',
                keywords: ["list", "bullet", "ul"],
                command: ({ editor }: any) =>
                  editor.chain().focus().toggleBulletList().run(),
              },
              {
                icon: <ListTodo size={16} />,
                label: t("editor.TaskList"),
                category: 'list',
                keywords: ["list", "task", "todo", "checkbox"],
                command: ({ editor }: any) =>
                  editor.chain().focus().toggleTaskList().run(),
              },
              // Block
              {
                icon: <Quote size={14} />,
                label: t("editor.Quote"),
                category: 'block',
                keywords: ["quote", "blockquote"],
                command: ({ editor }: any) =>
                  editor.chain().focus().setBlockquote().run(),
              },
              {
                icon: <Table size={16} />,
                label: t("editor.table.name"),
                category: 'block',
                keywords: ["table", "grid"],
                command: ({ editor }: any) =>
                  editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: false }).run(),
              },
              // Media
              {
                icon: <Image size={16} />,
                label: t("editor.Image"),
                category: 'media',
                keywords: ["image", "photo", "picture", "img"],
                command: ({ editor }: any) =>
                  editor?.chain().focus().setImage({ src: null, name: null }).run()
              },
              {
                icon: <Video size={16} />,
                label: t("editor.Video"),
                category: 'media',
                keywords: ["video", "upload", "media", "mp4"],
                command: ({ editor }: any) =>
                  editor?.chain().focus().setVideo({ src: null, name: null }).run()
              },
              {
                icon: <Music size={16} />,
                label: t("editor.Audio"),
                category: 'media',
                keywords: ["audio", "music", "sound", "mp3", "upload"],
                command: ({ editor }: any) =>
                  editor?.chain().focus().setAudio({ src: null, name: null }).run()
              },
              {
                icon: <Paperclip size={16} />,
                label: t("editor.Attachment"),
                category: 'media',
                keywords: ["file", "attachment", "upload"],
                command: ({ editor }: any) =>
                  editor?.chain().focus().setFile({ src: null, name: null }).run()
              },
              {
                icon: <Images size={16} />,
                label: t("editor.Carousel"),
                category: 'media',
                keywords: ["carousel", "gallery", "slideshow", "images", "media"],
                command: ({ editor }: any) =>
                  editor?.chain().focus().setCarousel({ items: [] }).run()
              },
              // Embed
              {
                icon: <Youtube size={16} />,
                label: t("editor.YoutubeEmbed"),
                category: 'embed',
                keywords: ["youtube", "video", "embed"],
                command: ({ editor }: any) =>
                  editor?.chain().focus().setYoutubeEmbed({ url: null }).run()
              },
              {
                icon: <svg height="16" width="16" viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg" className="fill-current"><path d="M141.537 88.9883C140.71 88.5919 139.87 88.2104 139.019 87.8451C137.537 60.5382 122.616 44.905 97.5619 44.745C97.4484 44.7443 97.3355 44.7443 97.222 44.7443C82.2364 44.7443 69.7731 51.1409 62.102 62.7807L75.881 72.2328C81.6116 63.5383 90.6052 61.6848 97.2286 61.6848C97.3051 61.6848 97.3819 61.6848 97.4576 61.6855C105.707 61.7381 111.932 64.1366 115.961 68.814C118.893 72.2193 120.854 76.925 121.825 82.8638C114.511 81.6207 106.601 81.2385 98.145 81.7233C74.3247 83.0954 59.0111 96.9879 60.0396 116.292C60.5615 126.084 65.4397 134.508 73.775 140.011C80.8224 144.663 89.899 146.938 99.3323 146.423C111.79 145.74 121.563 140.987 128.381 132.296C133.559 125.696 136.834 117.143 138.28 106.366C144.217 109.949 148.617 114.664 151.047 120.332C155.179 129.967 155.42 145.8 142.501 158.708C131.182 170.016 117.576 174.908 97.0135 175.059C74.2042 174.89 56.9538 167.575 45.7381 153.317C35.2355 139.966 29.8077 120.682 29.6052 96C29.8077 71.3178 35.2355 52.0336 45.7381 38.6827C56.9538 24.4249 74.2039 17.11 97.0132 16.9405C119.988 17.1113 137.539 24.4614 149.184 38.788C154.894 45.8136 159.199 54.6488 162.037 64.9503L178.184 60.6422C174.744 47.9622 169.331 37.0357 161.965 27.974C147.036 9.60668 125.202 0.195148 97.0695 0H96.9569C68.8816 0.19447 47.2921 9.6418 32.7883 28.0793C19.8819 44.4864 13.2244 67.3157 13.0007 95.9325L13 96L13.0007 96.0675C13.2244 124.684 19.8819 147.514 32.7883 163.921C47.2921 182.358 68.8816 191.806 96.9569 192H97.0695C122.03 191.827 139.624 185.292 154.118 170.811C173.081 151.866 172.51 128.119 166.26 113.541C161.776 103.087 153.227 94.5962 141.537 88.9883ZM98.4405 129.507C88.0005 130.095 77.1544 125.409 76.6196 115.372C76.2232 107.93 81.9158 99.626 99.0812 98.6368C101.047 98.5234 102.976 98.468 104.871 98.468C111.106 98.468 116.939 99.0737 122.242 100.233C120.264 124.935 108.662 128.946 98.4405 129.507Z" /></svg>,
                label: t("editor.ThreadsEmbed"),
                category: 'embed',
                keywords: ["threads", "instagram", "meta", "social", "embed"],
                command: ({ editor }: any) =>
                  editor?.chain().focus().setThreadsEmbed({ url: null }).run()
              },
              {
                icon: <svg height="16" width="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="fill-current"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>,
                label: t("editor.InstagramEmbed"),
                category: 'embed',
                keywords: ["instagram", "ig", "reel", "social", "embed"],
                command: ({ editor }: any) =>
                  editor?.chain().focus().setInstagramEmbed({ url: null }).run()
              },
              {
                icon: <svg height="16" width="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="fill-current"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.16 8.16 0 0 0 4.77 1.52V6.76a4.85 4.85 0 0 1-1-.07z"/></svg>,
                label: t("editor.TiktokEmbed"),
                category: 'embed',
                keywords: ["tiktok", "tik", "tok", "short", "video", "social", "embed"],
                command: ({ editor }: any) =>
                  editor?.chain().focus().setTiktokEmbed({ url: null }).run()
              },
              // Advanced
              {
                icon: <FileText size={16} />,
                label: t("editor.SubPage"),
                category: 'advanced',
                keywords: ["page", "sub", "child", "nested", "note"],
                command: ({ editor }: any) =>
                  editor?.chain().focus().setSubPage({ noteId: null, title: '' }).run(),
              },
              {
                icon: <CalendarDays size={16} />,
                label: t("editor.CalendarNode"),
                category: 'advanced',
                keywords: ["calendar", "date", "event", "schedule"],
                command: ({ editor }: any) =>
                  editor?.chain().focus().setCalendarNode({ date: null, title: '', description: '' }).run(),
              },
              {
                icon: <MapPin size={16} />,
                label: t("editor.LocationNode"),
                category: 'advanced',
                keywords: ["location", "map", "place", "address", "gps"],
                command: ({ editor }: any) =>
                  editor?.chain().focus().setLocationNode({ lat: null, lng: null, name: '', address: '' }).run(),
              },
              {
                icon: <Tag size={16} />,
                label: t("editor.TagsNode"),
                category: 'advanced',
                keywords: ["tag", "tags", "label", "category"],
                command: ({ editor }: any) =>
                  editor?.chain().focus().setTagsNode({ tags: [] }).run(),
              },
              {
                icon: <Star size={16} />,
                label: t("editor.RatingNode"),
                category: 'advanced',
                keywords: ["rating", "star", "score", "review"],
                command: ({ editor }: any) =>
                  editor?.chain().focus().setRatingNode({ rating: 0, maxRating: 5, label: '' }).run(),
              },
              // Views
              {
                icon: <Map size={16} />,
                label: t("editor.MapView"),
                category: 'views',
                keywords: ["map", "location", "geography", "view"],
                command: ({ editor }: any) =>
                  editor?.chain().focus().setViewNode({ viewId: null, viewType: 'map', name: '' }).run(),
              },
              {
                icon: <CalendarDays size={16} />,
                label: t("editor.CalendarView"),
                category: 'views',
                keywords: ["calendar", "schedule", "event", "view"],
                command: ({ editor }: any) =>
                  editor?.chain().focus().setViewNode({ viewId: null, viewType: 'calendar', name: '' }).run(),
              },
              {
                icon: <Kanban size={16} />,
                label: t("editor.KanbanView"),
                category: 'views',
                keywords: ["kanban", "board", "task", "view"],
                command: ({ editor }: any) =>
                  editor?.chain().focus().setViewNode({ viewId: null, viewType: 'kanban', name: '' }).run(),
              },
              {
                icon: <PenTool size={16} />,
                label: t("editor.WhiteboardView"),
                category: 'views',
                keywords: ["whiteboard", "draw", "canvas", "view"],
                command: ({ editor }: any) =>
                  editor?.chain().focus().setViewNode({ viewId: null, viewType: 'whiteboard', name: '' }).run(),
              },
              {
                icon: <Sheet size={16} />,
                label: t("editor.SpreadsheetView"),
                category: 'views',
                keywords: ["spreadsheet", "table", "sheet", "excel", "view"],
                command: ({ editor }: any) =>
                  editor?.chain().focus().setViewNode({ viewId: null, viewType: 'spreadsheet', name: '' }).run(),
              },
            ].filter((item) =>
              item.label.toLowerCase().includes(query.toLowerCase()) ||
              item.keywords?.some(k => k.toLowerCase().includes(query.toLowerCase()))
            )
          },
        }
      }),
      Mention.configure({
        HTMLAttributes: {
          class: 'text-primary bg-primary-lighter dark:bg-primary-light rounded px-1 font-medium',
        },
        suggestion: createMentionSuggestion(() => workspaceMembersRef.current),
      }),
      CommentMark,
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose-base lg:prose-lg xl:prose-2xl focus:outline-none',
      },
    },
    content: initialContent,
    onUpdate({ editor }) {
      // Avoid infinite loop when applying Y.js updates
      if (isApplyingYjsUpdate.current) return;

      // Save as JSON string (recommended by TipTap)
      const json = editor.getJSON()
      const newContent = JSON.stringify(json)

      // Only process if content actually changed
      if (newContent !== lastContentRef.current) {
        lastContentRef.current = newContent

        // If composing (IME input), store pending update and wait for composition end
        if (isComposing.current) {
          pendingUpdate.current = { content: newContent };
          return;
        }

        // Update Y.Map for CRDT collaboration (set avoids CRDT concatenation bugs)
        if (yText && yDoc) {
          yDoc.transact(() => {
            yText.set('data', newContent);
          }, 'local');
        }

        // Trigger onChange callback if provided
        if (onChange) {
          onChange({ content: newContent })
        }
      }
    },
  })

  // Update ref when note prop changes (e.g., navigating to different note)
  useEffect(() => {
    lastContentRef.current = note.content
  }, [note.content])

  // Sync Y.js content to editor when yjsReady becomes true
  // This ensures the editor shows the latest state after Y.js snapshot + updates are applied
  useEffect(() => {
    if (!editor || !yText || !yjsReady) return;

    const yjsContent = (yText.get('data') as string) || '';

    // Skip if Y.Map is empty (new note or not initialized)
    if (!yjsContent || yjsContent.length === 0) {
      return;
    }

    // Skip if content is the same
    if (yjsContent === lastContentRef.current) {
      return;
    }

    try {
      const contentJson = sanitizeContent(JSON.parse(yjsContent)) ?? DEFAULT_CONTENT;

      // Set flag to prevent infinite loop
      isApplyingYjsUpdate.current = true;

      // Update editor with Y.js content
      editor.commands.setContent(contentJson);
      lastContentRef.current = yjsContent;

      isApplyingYjsUpdate.current = false;
    } catch (error) {
      console.error('[Editor] Error parsing Y.js content on ready:', error);
    }
  }, [editor, yText, yjsReady])

  // Listen for Y.Text changes from other clients and update editor
  useEffect(() => {
    if (!editor || !yText) return;

    const observer = () => {
      const newContent = (yText.get('data') as string) || '';

      // Avoid applying if content is the same
      if (newContent === lastContentRef.current) return;

      try {
        const contentJson = sanitizeContent(JSON.parse(newContent)) ?? DEFAULT_CONTENT;

        // Set flag to prevent infinite loop
        isApplyingYjsUpdate.current = true;

        // Update editor content
        editor.commands.setContent(contentJson);
        lastContentRef.current = newContent;

        isApplyingYjsUpdate.current = false;
      } catch (error) {
        console.error('Error parsing Y.js content:', error);
      }
    };

    yText.observe(observer);

    return () => {
      yText.unobserve(observer);
    };
  }, [editor, yText])

  // Note: Content sync is now handled by Y.js CRDT updates
  // No need for periodic full content sync anymore

  // Handle composition events for IME input
  useEffect(() => {
    if (!editor || editor.isDestroyed || !editor.view) return;

    const editorElement = editor.view.dom;
    if (!editorElement) return;

    const handleCompositionStart = () => {
      isComposing.current = true;
    };

    const handleCompositionEnd = () => {
      isComposing.current = false;

      // Process any pending update after composition ends
      if (pendingUpdate.current) {
        const { content: newContent } = pendingUpdate.current;
        pendingUpdate.current = null;

        // Update Y.Map for CRDT collaboration (set avoids CRDT concatenation bugs)
        if (yText && yDoc) {
          yDoc.transact(() => {
            yText.set('data', newContent);
          }, 'local');
        }

        // Trigger onChange callback if provided
        if (onChange) {
          onChange({ content: newContent });
        }
      }
    };

    editorElement.addEventListener('compositionstart', handleCompositionStart);
    editorElement.addEventListener('compositionend', handleCompositionEnd);

    return () => {
      editorElement.removeEventListener('compositionstart', handleCompositionStart);
      editorElement.removeEventListener('compositionend', handleCompositionEnd);
    };
  }, [editor, yDoc, yText, onChange]);

  // Apply/remove comment marks in response to the comment sidebar's actions.
  // The sidebar has no direct reference to the editor instance, so it communicates
  // via DOM CustomEvents (matching the composition-event pattern above).
  useEffect(() => {
    if (!editor) return;

    const handleMarkApplied = (event: Event) => {
      const { threadId, from, to } = (event as CustomEvent).detail || {};
      if (!threadId || typeof from !== 'number' || typeof to !== 'number') return;
      editor.chain().setTextSelection({ from, to }).setComment(threadId).run();
    };

    const handleMarkRemove = (event: Event) => {
      const { threadId } = (event as CustomEvent).detail || {};
      if (!threadId) return;
      editor.chain().unsetComment(threadId).run();
    };

    document.addEventListener('note-comment-mark-applied', handleMarkApplied);
    document.addEventListener('note-comment-mark-remove', handleMarkRemove);

    return () => {
      document.removeEventListener('note-comment-mark-applied', handleMarkApplied);
      document.removeEventListener('note-comment-mark-remove', handleMarkRemove);
    };
  }, [editor]);

  // Cleanup editor on unmount
  useEffect(() => {
    return () => {
      if (editor) {
        editor.destroy()
      }
    }
  }, [editor])

  const providerValue = useMemo(() => ({ editor }), [editor])
  const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;

  const [dragMenuOpen, setDragMenuOpen] = useState(false)
  const [activePos, setActivePos] = useState(-1)
  const [activeNodeActions, setActiveNodeActions] = useState<MenuAction[]>([])
  const dragMenuRef = useRef<HTMLDivElement>(null)
  const activePosRef = useRef(-1)

  useEffect(() => {
    if (!dragMenuOpen) return
    const close = (e: MouseEvent) => {
      if (!dragMenuRef.current?.contains(e.target as Element)) setDragMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [dragMenuOpen])

  const setActiveNodeActionsCallback = useCallback((actions: MenuAction[]) => {
    setActiveNodeActions(actions)
  }, [])

  const dragMenuContextValue = useMemo(() => ({
    activePos,
    setActiveNodeActions: setActiveNodeActionsCallback,
  }), [activePos, setActiveNodeActionsCallback])

  // Built-in move/delete actions for nodes that don't register via useDragMenu
  const builtinActions = useMemo((): MenuAction[] => {
    if (activePos < 0 || !editor) return []
    const { state } = editor
    const node = state.doc.nodeAt(activePos)
    if (!node) return []
    const $pos = state.doc.resolve(activePos)
    const actions: MenuAction[] = []
    if ($pos.index() > 0 && $pos.nodeBefore) {
      actions.push({
        label: t('editor.moveUp'),
        icon: <ChevronUp size={14} />,
        onClick: () => {
          const s = editor.state
          const n = s.doc.nodeAt(activePos)
          const nb = s.doc.resolve(activePos).nodeBefore
          if (n && nb) editor.view.dispatch(s.tr.replaceWith(activePos - nb.nodeSize, activePos + n.nodeSize, [n, nb]))
        },
      })
    }
    if ($pos.index() < $pos.parent.childCount - 1) {
      const nap = activePos + node.nodeSize
      if (state.doc.resolve(nap).nodeAfter) {
        actions.push({
          label: t('editor.moveDown'),
          icon: <ChevronDown size={14} />,
          onClick: () => {
            const s = editor.state
            const n = s.doc.nodeAt(activePos)
            if (!n) return
            const napFresh = activePos + n.nodeSize
            const na = s.doc.resolve(napFresh).nodeAfter
            if (na) editor.view.dispatch(s.tr.replaceWith(activePos, napFresh + na.nodeSize, [na, n]))
          },
        })
      }
    }
    actions.push({
      label: t('actions.delete'),
      icon: <Trash2 size={14} />,
      onClick: () => {
        const s = editor.state
        const n = s.doc.nodeAt(activePos)
        if (n) editor.view.dispatch(s.tr.delete(activePos, activePos + n.nodeSize))
      },
      variant: 'danger',
    })
    return actions
  }, [activePos, editor, t])

  const displayActions = activeNodeActions.length > 0 ? activeNodeActions : builtinActions

  if (!editor) {
    return null
  }

  return (
    <DragMenuContext.Provider value={dragMenuContextValue}>
    <EditorContext.Provider value={providerValue}>
      {contentError && (
        <div className="mb-2 p-2 rounded bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
          {t('editor.contentParseError', 'Failed to load note content. The content may be corrupted.')}
        </div>
      )}
      {!isTouchDevice && canDrag && (
        <DragHandle
          editor={editor}
          className='text-gray-500'
          onNodeChange={({ pos }: { node: unknown; editor: unknown; pos: number }) => {
            if (pos === activePosRef.current) return
            activePosRef.current = pos
            setActivePos(pos)
            setActiveNodeActions([])
            setDragMenuOpen(false)
          }}
        >
          <div className="relative" ref={dragMenuRef}>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDragMenuOpen(v => !v) }}
            >
              <GripVertical size={12} />
            </button>
            {dragMenuOpen && displayActions.length > 0 && (
              <div className="absolute left-full top-0 ml-1 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded shadow-lg z-50 py-1 min-w-[150px]">
                {displayActions.map((action, i) => (
                  <button
                    key={i}
                    onClick={() => { action.onClick(); setDragMenuOpen(false) }}
                    className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm transition-colors ${
                      action.variant === 'danger'
                        ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-700'
                    }`}
                  >
                    {action.icon}
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </DragHandle>
      )}

      <BubbleMenu
        editor={editor}
        shouldShow={() => editor.isActive('table') || editor.isActive('tableCell')}
        getReferencedVirtualElement={() => {
          const parentNode = findParentNode(
            node => node.type.name === 'table' || node.type.name === 'tableCell',
          )(editor.state.selection)
          if (parentNode) {
            const domRect = posToDOMRect(editor.view, parentNode.start, parentNode.start + parentNode.node.nodeSize)
            return {
              getBoundingClientRect: () => domRect,
              getClientRects: () => [domRect],
            }
          }
          return null
        }}
        options={{ placement: 'top-start', offset: 8 }}
      >
        <div className="flex gap-1 divide-x-2 bg-slate-50 border rounded shadow">
          <button className='p-2' onClick={() => editor.chain().focus().deleteColumn().run()}>{t("editor.table.deleteColumn")}</button>
          <button className='p-2' onClick={() => editor.chain().focus().addColumnAfter().run()}>{t("editor.table.addColumn")}</button>
          <button className='p-2' onClick={() => editor.chain().focus().deleteRow().run()}>{t("editor.table.deleteRow")}</button>
          <button className='p-2' onClick={() => editor.chain().focus().addRowAfter().run()}>{t("editor.table.addRow")}</button>
          <button className='p-2' onClick={() => editor.chain().focus().deleteTable().run()}>{t('editor.table.deleteTable')}</button>
        </div>
      </BubbleMenu>

      <BubbleMenu
        editor={editor}
        shouldShow={({ state }) => !state.selection.empty && !editor.isActive('table') && !editor.isActive('tableCell')}
        options={{ placement: 'top', offset: 8 }}
      >
        <div className="flex bg-white dark:bg-neutral-800 border dark:border-neutral-700 rounded shadow">
          <button
            className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded"
            onClick={() => {
              const { from, to } = editor.state.selection
              const quotedText = editor.state.doc.textBetween(from, to, ' ')
              if (!quotedText.trim()) return
              document.dispatchEvent(new CustomEvent('note-comment-open-composer', { detail: { quotedText, from, to } }))
            }}
          >
            <MessageSquarePlus size={14} />
            {t('editor.addComment')}
          </button>
        </div>
      </BubbleMenu>
      <EditorContent editor={editor} />
    </EditorContext.Provider>
    </DragMenuContext.Provider>
  )
}

export default Editor