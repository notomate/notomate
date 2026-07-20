import { FC, useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { X, Send, Pencil, Trash2, MoreVertical } from "lucide-react"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import { CommentData, createComment, deleteComment, getComments, updateComment } from "@/api/comment"
import { getWorkspaceMembers } from "@/api/workspace"
import { COMMENT_CLICK_EVENT } from "@/components/editor/extensions/comment/CommentMark"
import { useCurrentUserStore } from "@/stores/current-user"
import { useToastStore } from "@/stores/toast"
import Avatar from "@/components/avatar/Avatar"
import MentionTextarea from "./MentionTextarea"
import { renderCommentBody } from "./commentMarkdown"

interface CommentSidebarProps {
  workspaceId: string
  noteId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface PendingComposer {
  quotedText: string
  from?: number
  to?: number
}

function formatRelativeTime(t: (key: string, opts?: any) => string, dateString?: string) {
  const date = new Date(dateString ?? "")
  const now = new Date()
  const diff = (now.getTime() - date.getTime()) / 1000
  if (diff < 60) return t("time.just_now")
  if (diff < 3600) return t("time.minutes_ago", { count: Math.floor(diff / 60) })
  if (diff < 86400) return t("time.hours_ago", { count: Math.floor(diff / 3600) })
  const y = date.getFullYear()
  const m = (date.getMonth() + 1).toString().padStart(2, "0")
  const d = date.getDate().toString().padStart(2, "0")
  return y === now.getFullYear() ? t("time.date_md", { month: m, day: d }) : t("time.date_ymd", { year: y, month: m, day: d })
}

const CommentSidebar: FC<CommentSidebarProps> = ({ workspaceId, noteId, open, onOpenChange }) => {
  const { t } = useTranslation()
  const { user } = useCurrentUserStore()
  const { addToast } = useToastStore()
  const queryClient = useQueryClient()

  const [composer, setComposer] = useState<PendingComposer>({ quotedText: "" })
  const [composerFocusKey, setComposerFocusKey] = useState(0)
  const [composerBody, setComposerBody] = useState("")
  const [replyBodies, setReplyBodies] = useState<Record<string, string>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingBody, setEditingBody] = useState("")
  const [highlightedThreadId, setHighlightedThreadId] = useState<string | null>(null)
  const [orphanedThreadIds, setOrphanedThreadIds] = useState<Set<string>>(new Set())
  const threadRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Mobile bottom-sheet state (below lg, the sidebar becomes a draggable bottom sheet).
  const [shouldHideOnMobile, setShouldHideOnMobile] = useState(!open)
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const startYRef = useRef(0)
  const bodyRef = useRef<HTMLDivElement>(null)

  const queryKey = ["comments", workspaceId, noteId]

  const { data: comments = [] } = useQuery({
    queryKey,
    queryFn: () => getComments(workspaceId, noteId),
    enabled: !!workspaceId && !!noteId,
  })

  const { data: members = [] } = useQuery({
    queryKey: ["workspaceMembers", workspaceId],
    queryFn: () => getWorkspaceMembers(workspaceId),
    enabled: !!workspaceId,
  })

  const threads = useMemo(() => {
    const grouped = new Map<string, CommentData[]>()
    for (const comment of comments) {
      const list = grouped.get(comment.thread_id) ?? []
      list.push(comment)
      grouped.set(comment.thread_id, list)
    }
    return Array.from(grouped.values()).sort((a, b) => b[0].created_at.localeCompare(a[0].created_at))
  }, [comments])

  // Recompute which threads' anchor marks are no longer present in the editor DOM.
  // General comments (no quoted text) have no mark to begin with, so they're never orphaned.
  // The editor's content loads asynchronously (REST snapshot first, then swapped for the
  // synced Y.js doc once collaboration is ready), so the marked span may not exist in the
  // DOM yet the moment `threads` first resolves. A MutationObserver keeps this in sync with
  // however/whenever the editor's content actually settles, instead of computing it once.
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null
    const recompute = () => {
      const orphaned = new Set<string>()
      threads.forEach(thread => {
        const anchor = thread[0]
        if (!anchor.quoted_text) return
        if (!document.querySelector(`[data-comment-thread-id="${anchor.thread_id}"]`)) {
          orphaned.add(anchor.thread_id)
        }
      })
      setOrphanedThreadIds(orphaned)
    }

    recompute()

    const observer = new MutationObserver(() => {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(recompute, 150)
    })
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-comment-thread-id'],
    })

    return () => {
      if (timeout) clearTimeout(timeout)
      observer.disconnect()
    }
  }, [threads])

  // "Add comment" bubble-menu button in the editor asks us to open a composer for a fresh selection.
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as PendingComposer
      if (!detail) return
      setComposer(detail)
      setComposerBody("")
      setComposerFocusKey(k => k + 1)
      onOpenChange(true)
    }
    document.addEventListener("note-comment-open-composer", handler)
    return () => document.removeEventListener("note-comment-open-composer", handler)
  }, [onOpenChange])

  // Clicking a highlighted comment span in the editor scrolls/highlights the matching thread.
  useEffect(() => {
    const handler = (event: Event) => {
      const { threadId } = (event as CustomEvent).detail || {}
      if (!threadId) return
      onOpenChange(true)
      setHighlightedThreadId(threadId)
      requestAnimationFrame(() => {
        threadRefs.current[threadId]?.scrollIntoView({ behavior: "smooth", block: "center" })
      })
      window.setTimeout(() => setHighlightedThreadId(current => (current === threadId ? null : current)), 2000)
    }
    document.addEventListener(COMMENT_CLICK_EVENT, handler)
    return () => document.removeEventListener(COMMENT_CLICK_EVENT, handler)
  }, [onOpenChange])

  // Keep the sheet mounted briefly after close so the mobile slide-down transition can play.
  useEffect(() => {
    if (open) {
      setShouldHideOnMobile(false)
    } else {
      const timer = setTimeout(() => setShouldHideOnMobile(true), 300)
      return () => clearTimeout(timer)
    }
  }, [open])

  // Prevent background scroll while the mobile bottom sheet is open.
  useEffect(() => {
    if (open && window.innerWidth < 1024) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = "hidden"
      return () => { document.body.style.overflow = originalOverflow }
    }
  }, [open])

  useEffect(() => {
    return () => {
      if (window.innerWidth < 1024 && document.body.style.overflow === "hidden") {
        document.body.style.overflow = ""
      }
    }
  }, [])

  const handleDragStart = (clientY: number) => {
    if (window.innerWidth >= 1024) return
    if (!open) return
    if (bodyRef.current && bodyRef.current.scrollTop > 0) return
    setIsDragging(true)
    startYRef.current = clientY
  }

  const handleDragMove = (clientY: number) => {
    if (!isDragging) return
    const deltaY = clientY - startYRef.current
    if (deltaY > 0) setDragOffset(deltaY)
  }

  const handleDragEnd = () => {
    if (!isDragging) return
    setIsDragging(false)
    if (dragOffset > 100) onOpenChange(false)
    setDragOffset(0)
  }

  const handleTouchStart = (e: React.TouchEvent) => handleDragStart(e.touches[0].clientY)
  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging) {
      e.preventDefault()
      handleDragMove(e.touches[0].clientY)
    }
  }
  const handleTouchEnd = () => handleDragEnd()
  const handleMouseDown = (e: React.MouseEvent) => handleDragStart(e.clientY)

  useEffect(() => {
    if (!isDragging) return
    const handleMouseMove = (e: MouseEvent) => handleDragMove(e.clientY)
    const handleMouseUp = () => handleDragEnd()
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging, dragOffset])

  const createMutation = useMutation({
    mutationFn: (vars: { threadId?: string; quotedText?: string; body: string; from?: number; to?: number }) =>
      createComment(workspaceId, noteId, vars),
    onSuccess: (created, vars) => {
      queryClient.invalidateQueries({ queryKey })
      // Only anchor a mark in the editor when the comment was created against a text selection.
      if (!vars.threadId && vars.from !== undefined && vars.to !== undefined) {
        document.dispatchEvent(new CustomEvent("note-comment-mark-applied", {
          detail: { threadId: created.id, from: vars.from, to: vars.to },
        }))
      }
    },
    onError: () => addToast({ title: t("comments.createFailed"), type: "error" }),
  })

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; body: string }) => updateComment(workspaceId, noteId, vars.id, vars.body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: () => addToast({ title: t("comments.updateFailed"), type: "error" }),
  })

  const deleteMutation = useMutation({
    mutationFn: (comment: CommentData) => deleteComment(workspaceId, noteId, comment.id),
    onSuccess: (_data, comment) => {
      const remaining = comments.filter(c => c.id !== comment.id && c.thread_id === comment.thread_id)
      queryClient.invalidateQueries({ queryKey })
      if (remaining.length === 0) {
        document.dispatchEvent(new CustomEvent("note-comment-mark-remove", { detail: { threadId: comment.thread_id } }))
      }
    },
    onError: () => addToast({ title: t("comments.deleteFailed"), type: "error" }),
  })

  const handleSubmitComposer = () => {
    if (!composerBody.trim()) return
    createMutation.mutate({ quotedText: composer.quotedText, body: composerBody.trim(), from: composer.from, to: composer.to })
    setComposer({ quotedText: "" })
    setComposerBody("")
  }

  const handleSubmitReply = (threadId: string) => {
    const body = (replyBodies[threadId] ?? "").trim()
    if (!body) return
    createMutation.mutate({ threadId, body })
    setReplyBodies(prev => ({ ...prev, [threadId]: "" }))
  }

  const handleStartEdit = (comment: CommentData) => {
    setEditingId(comment.id)
    setEditingBody(comment.body)
  }

  const handleSubmitEdit = () => {
    if (!editingId || !editingBody.trim()) return
    updateMutation.mutate({ id: editingId, body: editingBody.trim() })
    setEditingId(null)
    setEditingBody("")
  }

  const handleDelete = (comment: CommentData) => {
    if (!confirm(t("comments.confirmDelete"))) return
    deleteMutation.mutate(comment)
  }

  if (!open && shouldHideOnMobile) {
    return null
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => onOpenChange(false)} />
      )}
      <aside
        className={`fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] rounded-t-2xl
        ${open ? "translate-y-0" : "translate-y-full lg:translate-y-0"}
        ${open ? "" : "lg:hidden"}
        ${isDragging ? "" : "transition-transform duration-300 ease-out"}
        lg:static lg:translate-y-0 lg:max-h-none lg:rounded-none lg:h-full lg:w-80 lg:shrink-0
        flex flex-col border-l dark:border-neutral-700 bg-white dark:bg-neutral-900 overflow-hidden`}
        style={{ transform: isDragging ? `translateY(${dragOffset}px)` : undefined }}
      >
        <div
          className="shrink-0 flex items-center justify-center py-2 cursor-grab active:cursor-grabbing lg:hidden touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
        >
          <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>

        <div className="hidden lg:flex items-center justify-between px-4 py-3 border-b dark:border-neutral-700 shrink-0">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-200">{t("comments.title")}</h2>
          <button className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" onClick={() => onOpenChange(false)}>
            <X size={16} />
          </button>
        </div>

        <div className="p-3 border-b dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800/50 shrink-0">
          {composer.quotedText && (
            <blockquote className="text-xs italic text-gray-500 dark:text-gray-400 border-l-2 pl-2 mb-2 line-clamp-3 flex items-start gap-1">
              <span className="flex-1">{composer.quotedText}</span>
              <button
                className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0"
                title={t("actions.cancel") as string}
                onClick={() => setComposer({ quotedText: "" })}
              >
                <X size={12} />
              </button>
            </blockquote>
          )}
          <div className="flex gap-2 items-start">
            <Avatar name={user?.name} avatarUrl={user?.avatar_url} size={24} />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-gray-700 dark:text-gray-200 mb-1 truncate">{user?.name}</div>
              <div className="flex gap-2 items-center">
                <MentionTextarea
                  key={composerFocusKey}
                  autoFocus={composerFocusKey > 0}
                  className="w-full text-sm border dark:border-neutral-600 rounded p-2 bg-white dark:bg-neutral-900 dark:text-gray-100 resize-none"
                  rows={composer.quotedText ? 2 : 1}
                  placeholder={t("comments.composerPlaceholder") as string}
                  value={composerBody}
                  onChange={setComposerBody}
                  members={members}
                />
                <button
                  className="p-1.5 text-primary disabled:opacity-40 shrink-0"
                  disabled={!composerBody.trim()}
                  onClick={handleSubmitComposer}
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div ref={bodyRef} className="flex-1 overflow-y-auto">
        {threads.map(thread => {
          const anchor = thread[0]
          const isOrphaned = orphanedThreadIds.has(anchor.thread_id)
          return (
            <div
              key={anchor.thread_id}
              ref={el => { threadRefs.current[anchor.thread_id] = el }}
              className={`p-4 border-b dark:border-neutral-700 transition-colors ${highlightedThreadId === anchor.thread_id ? "bg-primary-lighter dark:bg-primary-light/20" : ""}`}
            >
              {anchor.quoted_text && (
                <blockquote className={`text-xs italic border-l-2 pl-2 mb-3 line-clamp-3 ${isOrphaned ? "text-gray-400 border-gray-300 dark:text-gray-500 dark:border-neutral-600" : "text-gray-500 dark:text-gray-400 border-primary/40"}`}>
                  {anchor.quoted_text}
                  {isOrphaned && <span className="block not-italic mt-1 text-xs text-gray-400">{t("comments.orphaned")}</span>}
                </blockquote>
              )}

              <div className="flex flex-col gap-3">
                {thread.map(comment => (
                  <div key={comment.id} className="flex gap-2">
                    <Avatar name={comment.created_by_name} avatarUrl={comment.created_by_avatar_url} size={24} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{comment.created_by_name}</span>
                        <span className="text-xs text-gray-400">{formatRelativeTime(t, comment.created_at)}</span>
                        {comment.edited && <span className="text-xs text-gray-400">{t("comments.edited")}</span>}
                        {user?.id === comment.created_by && editingId !== comment.id && (
                          <DropdownMenu.Root>
                            <DropdownMenu.Trigger asChild>
                              <button className="ml-auto p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0">
                                <MoreVertical size={14} />
                              </button>
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Portal>
                              <DropdownMenu.Content
                                align="end"
                                sideOffset={4}
                                className="min-w-[140px] bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border dark:border-neutral-700 rounded-lg shadow-lg p-1 z-50"
                              >
                                <DropdownMenu.Item
                                  className="flex items-center gap-2 px-2 py-1.5 text-xs rounded cursor-pointer outline-none hover:bg-neutral-100 dark:hover:bg-neutral-800"
                                  onSelect={() => handleStartEdit(comment)}
                                >
                                  <Pencil size={12} />
                                  {t("actions.edit")}
                                </DropdownMenu.Item>
                                <DropdownMenu.Item
                                  className="flex items-center gap-2 px-2 py-1.5 text-xs rounded cursor-pointer outline-none text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                  onSelect={() => handleDelete(comment)}
                                >
                                  <Trash2 size={12} />
                                  {t("actions.delete")}
                                </DropdownMenu.Item>
                              </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                          </DropdownMenu.Root>
                        )}
                      </div>

                      {editingId === comment.id ? (
                        <div className="mt-1">
                          <MentionTextarea
                            autoFocus
                            className="w-full text-sm border dark:border-neutral-600 rounded p-2 bg-white dark:bg-neutral-900 dark:text-gray-100 resize-none"
                            rows={2}
                            value={editingBody}
                            onChange={setEditingBody}
                            members={members}
                          />
                          <div className="flex justify-end gap-2 mt-1">
                            <button className="text-xs px-2 py-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" onClick={() => setEditingId(null)}>
                              {t("actions.cancel")}
                            </button>
                            <button className="text-xs px-3 py-1 bg-primary text-white rounded disabled:opacity-50" disabled={!editingBody.trim()} onClick={handleSubmitEdit}>
                              {t("actions.save")}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="note-comment-body text-sm text-gray-700 dark:text-gray-300 break-words"
                          dangerouslySetInnerHTML={{ __html: renderCommentBody(comment.body) }}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex gap-2 items-start">
                <Avatar name={user?.name} avatarUrl={user?.avatar_url} size={24} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-200 mb-1 truncate">{user?.name}</div>
                  <div className="flex gap-2 items-center">
                    <MentionTextarea
                      className="w-full text-sm border dark:border-neutral-600 rounded p-1.5 bg-white dark:bg-neutral-900 dark:text-gray-100 resize-none"
                      rows={1}
                      placeholder={t("comments.replyPlaceholder") as string}
                      value={replyBodies[anchor.thread_id] ?? ""}
                      onChange={value => setReplyBodies(prev => ({ ...prev, [anchor.thread_id]: value }))}
                      members={members}
                    />
                    <button
                      className="p-1.5 text-primary disabled:opacity-40"
                      disabled={!(replyBodies[anchor.thread_id] ?? "").trim()}
                      onClick={() => handleSubmitReply(anchor.thread_id)}
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        </div>
      </aside>
    </>
  )
}

export default CommentSidebar
