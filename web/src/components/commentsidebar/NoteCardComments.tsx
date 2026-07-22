import { FC, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { MessageCircle, Send, Pencil, Trash2, MoreVertical } from "lucide-react"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import { CommentData, createComment, deleteComment, getComments, updateComment } from "@/api/comment"
import { getWorkspaceMembers } from "@/api/workspace"
import { useCurrentUserStore } from "@/stores/current-user"
import { useToastStore } from "@/stores/toast"
import Avatar from "@/components/avatar/Avatar"
import NoteTime from "@/components/notetime/NoteTime"
import CommentEditor from "./CommentEditor"
import { renderCommentBody } from "./commentMarkdown"

interface NoteCardCommentsProps {
  workspaceId: string
  noteId: string
  readOnly?: boolean
}

const NoteCardComments: FC<NoteCardCommentsProps> = ({ workspaceId, noteId, readOnly = false }) => {
  const { t } = useTranslation()
  const { user } = useCurrentUserStore()
  const { addToast } = useToastStore()
  const queryClient = useQueryClient()

  const [expanded, setExpanded] = useState(false)
  const [composerExpanded, setComposerExpanded] = useState(false)
  const [composerBody, setComposerBody] = useState("")
  const [expandedReplyThreads, setExpandedReplyThreads] = useState<Set<string>>(new Set())
  const [replyBodies, setReplyBodies] = useState<Record<string, string>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingBody, setEditingBody] = useState("")

  const queryKey = ["comments", workspaceId, noteId]

  const { data: comments = [] } = useQuery({
    queryKey,
    queryFn: () => getComments(workspaceId, noteId),
    enabled: !!workspaceId && !!noteId,
  })

  const { data: members = [] } = useQuery({
    queryKey: ["workspaceMembers", workspaceId],
    queryFn: () => getWorkspaceMembers(workspaceId),
    enabled: expanded && !!workspaceId && !readOnly,
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

  const createMutation = useMutation({
    mutationFn: (vars: { threadId?: string; body: string }) => createComment(workspaceId, noteId, vars),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: () => addToast({ title: t("comments.createFailed"), type: "error" }),
  })

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; body: string }) => updateComment(workspaceId, noteId, vars.id, vars.body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: () => addToast({ title: t("comments.updateFailed"), type: "error" }),
  })

  const deleteMutation = useMutation({
    mutationFn: (comment: CommentData) => deleteComment(workspaceId, noteId, comment.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: () => addToast({ title: t("comments.deleteFailed"), type: "error" }),
  })

  const handleSubmitComposer = () => {
    if (!composerBody.trim()) return
    createMutation.mutate({ body: composerBody.trim() })
    setComposerBody("")
  }

  const handleSubmitReply = (threadId: string) => {
    const body = (replyBodies[threadId] ?? "").trim()
    if (!body) return
    createMutation.mutate({ threadId, body })
    setReplyBodies(prev => ({ ...prev, [threadId]: "" }))
  }

  const openReply = (threadId: string) => {
    setExpandedReplyThreads(prev => new Set(prev).add(threadId))
  }

  const collapseReplyIfEmpty = (threadId: string) => {
    if ((replyBodies[threadId] ?? "").trim()) return
    setExpandedReplyThreads(prev => {
      if (!prev.has(threadId)) return prev
      const next = new Set(prev)
      next.delete(threadId)
      return next
    })
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

  return (
    <div className="-mx-4 -mb-4 py-3 border-t dark:border-neutral-700">
      <button
        className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-4 py-1"
        onClick={() => setExpanded(prev => !prev)}
      >
        <MessageCircle size={16} />
        {comments.length}
      </button>

      {expanded && (
        <div className="">
          {!readOnly && (
            <div className="flex gap-2 items-start px-4 mt-1">
              <Avatar name={user?.name} avatarUrl={user?.avatar_url} size={24} />
              <div className="flex-1 min-w-0">
                {composerExpanded ? (
                  <>
                    <div className="text-xs font-medium text-gray-700 dark:text-gray-200 mb-1 truncate">{user?.name}</div>
                    <div className="flex gap-2 items-end">
                      <CommentEditor
                        autoFocus
                        className="text-sm"
                        minHeight={56}
                        placeholder={t("comments.composerPlaceholder") as string}
                        value={composerBody}
                        onChange={setComposerBody}
                        onBlur={() => { if (!composerBody.trim()) setComposerExpanded(false) }}
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
                  </>
                ) : (
                  <button
                    type="button"
                    className="w-full text-left text-sm text-gray-400 dark:text-gray-500 border dark:border-neutral-600 rounded px-3 py-1.5 hover:border-gray-300 dark:hover:border-neutral-500 hover:text-gray-500 dark:hover:text-gray-400"
                    onClick={() => setComposerExpanded(true)}
                  >
                    {t("comments.composerPlaceholder")}
                  </button>
                )}
              </div>
            </div>
          )}

          {threads.length > 0 && (
            <div className="flex flex-col">
              {threads.map(thread => {
                const anchor = thread[0]
                return (
                  <div key={anchor.thread_id} className="px-4 py-2 border-t dark:border-neutral-700 first:border-t-0">
                    {anchor.quoted_text && (
                      <blockquote className="text-xs italic text-gray-500 dark:text-gray-400 border-l-2 border-primary/40 pl-2 mb-2 line-clamp-3">
                        {anchor.quoted_text}
                      </blockquote>
                    )}
                    <div className="flex flex-col gap-2">
                      {thread.map((comment, index) => (
                        <div
                          key={comment.id}
                          className={`flex gap-2 ${index > 0 ? "ml-7 pl-3 dark:border-neutral-700" : ""}`}
                        >
                          <Avatar name={comment.created_by_name} avatarUrl={comment.created_by_avatar_url} size={index > 0 ? 18 : 22} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{comment.created_by_name}</span>
                              <span className="text-xs text-gray-400"><NoteTime time={comment.created_at} /></span>
                              {comment.edited && <span className="text-xs text-gray-400">{t("comments.edited")}</span>}
                              {!readOnly && user?.id === comment.created_by && editingId !== comment.id && (
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
                                <CommentEditor
                                  autoFocus
                                  className="text-sm"
                                  minHeight={56}
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

                    {!readOnly && (
                      expandedReplyThreads.has(anchor.thread_id) ? (
                        <div className="mt-2 flex gap-2 items-start ml-7 pl-3 border-l-2 border-transparent">
                          <Avatar name={user?.name} avatarUrl={user?.avatar_url} size={22} />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-gray-700 dark:text-gray-200 mb-1 truncate">{user?.name}</div>
                            <div className="flex gap-2 items-end">
                              <CommentEditor
                                autoFocus
                                className="text-xs"
                                minHeight={48}
                                placeholder={t("comments.replyPlaceholder") as string}
                                value={replyBodies[anchor.thread_id] ?? ""}
                                onChange={value => setReplyBodies(prev => ({ ...prev, [anchor.thread_id]: value }))}
                                onBlur={() => collapseReplyIfEmpty(anchor.thread_id)}
                                members={members}
                              />
                              <button
                                className="p-1 text-primary disabled:opacity-40"
                                disabled={!(replyBodies[anchor.thread_id] ?? "").trim()}
                                onClick={() => handleSubmitReply(anchor.thread_id)}
                              >
                                <Send size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="mt-2 ml-7 pl-3 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                          onClick={() => openReply(anchor.thread_id)}
                        >
                          {t("comments.replyPlaceholder")}
                        </button>
                      )
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default NoteCardComments
