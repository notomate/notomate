import { FC, useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Hash, Send, Pencil, Trash2, MoreVertical, ChevronDown } from "lucide-react"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import { ChannelData } from "@/api/channel"
import { MessageData, deleteMessage, getMessages, updateMessage } from "@/api/message"
import { WorkspaceMember } from "@/api/workspace"
import { useCurrentUserStore } from "@/stores/current-user"
import { useToastStore } from "@/stores/toast"
import { useChannelSocket } from "@/hooks/use-channel-socket"
import Avatar from "@/components/avatar/Avatar"
import CommentEditor from "@/components/commentsidebar/CommentEditor"
import { renderCommentBody } from "@/components/commentsidebar/commentMarkdown"
import { cn } from "@/lib/utils"

interface ChannelViewProps {
  workspaceId: string
  channel: ChannelData
  members: WorkspaceMember[]
  canManageChannel: boolean
  onRenameChannel: () => void
  onDeleteChannel: () => void
  onOpenChannelList?: () => void
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

const ChannelView: FC<ChannelViewProps> = ({ workspaceId, channel, members, canManageChannel, onRenameChannel, onDeleteChannel, onOpenChannelList }) => {
  const { t } = useTranslation()
  const { user } = useCurrentUserStore()
  const { addToast } = useToastStore()
  const queryClient = useQueryClient()

  const [composerBody, setComposerBody] = useState("")
  const [composerKey, setComposerKey] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingBody, setEditingBody] = useState("")
  const [presenceNotices, setPresenceNotices] = useState<{ id: string; userId: string; type: "join" | "leave"; at: number }[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  const queryKey = ["messages", workspaceId, channel.id]

  const { data: messages = [] } = useQuery({
    queryKey,
    queryFn: () => getMessages(workspaceId, channel.id),
    enabled: !!workspaceId && !!channel.id,
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" })
  }, [channel.id, messages.length])

  useEffect(() => {
    setPresenceNotices([])
  }, [channel.id])

  const upsertMessage = (message: MessageData) => {
    queryClient.setQueryData<MessageData[]>(queryKey, (prev = []) => {
      const idx = prev.findIndex(m => m.id === message.id)
      if (idx === -1) return [...prev, message]
      const next = prev.slice()
      next[idx] = message
      return next
    })
  }

  const removeMessage = (message: MessageData) => {
    queryClient.setQueryData<MessageData[]>(queryKey, (prev = []) => prev.filter(m => m.id !== message.id))
  }

  const { isConnected, onlineUserIds, sendMessage } = useChannelSocket({
    channelId: channel.id,
    workspaceId,
    enabled: !!workspaceId && !!channel.id,
    onMessageNew: upsertMessage,
    onMessageUpdated: upsertMessage,
    onMessageDeleted: removeMessage,
    onResync: () => queryClient.invalidateQueries({ queryKey }),
    onUserJoined: (userId) => {
      if (userId === user?.id) return
      setPresenceNotices(prev => [...prev.slice(-49), { id: `${userId}-join-${Date.now()}`, userId, type: "join", at: Date.now() }])
    },
    onUserLeft: (userId) => {
      if (userId === user?.id) return
      setPresenceNotices(prev => [...prev.slice(-49), { id: `${userId}-leave-${Date.now()}`, userId, type: "leave", at: Date.now() }])
    },
  })

  const onlineMembers = members.filter(m => onlineUserIds.includes(m.user_id))

  type TimelineItem =
    | { kind: "message"; ts: number; message: MessageData }
    | { kind: "notice"; ts: number; notice: { id: string; userId: string; type: "join" | "leave" } }

  const timeline: TimelineItem[] = [
    ...messages.map((message): TimelineItem => ({ kind: "message", ts: new Date(message.created_at ?? "").getTime(), message })),
    ...presenceNotices.map((notice): TimelineItem => ({ kind: "notice", ts: notice.at, notice })),
  ].sort((a, b) => a.ts - b.ts)

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; body: string }) => updateMessage(workspaceId, channel.id, vars.id, vars.body),
    onSuccess: (updated) => upsertMessage(updated),
    onError: () => addToast({ title: t("messaging.updateMessageFailed"), type: "error" }),
  })

  const deleteMutation = useMutation({
    mutationFn: (message: MessageData) => deleteMessage(workspaceId, channel.id, message.id),
    onSuccess: (_data, message) => removeMessage(message),
    onError: () => addToast({ title: t("messaging.deleteMessageFailed"), type: "error" }),
  })

  const handleSubmitComposer = () => {
    if (!composerBody.trim()) return
    sendMessage(composerBody.trim(), () => addToast({ title: t("messaging.createMessageFailed"), type: "error" }))
    setComposerBody("")
    setComposerKey(k => k + 1)
  }

  const handleStartEdit = (message: MessageData) => {
    setEditingId(message.id)
    setEditingBody(message.body)
  }

  const handleSubmitEdit = () => {
    if (!editingId || !editingBody.trim()) return
    updateMutation.mutate({ id: editingId, body: editingBody.trim() })
    setEditingId(null)
    setEditingBody("")
  }

  const handleDelete = (message: MessageData) => {
    if (!confirm(t("messaging.confirmDeleteMessage"))) return
    deleteMutation.mutate(message)
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full">
      <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b dark:border-neutral-700">
        <div className="flex items-center gap-1.5 min-w-0">
          {onOpenChannelList ? (
            <button
              aria-label={t("messaging.channels") as string}
              className="flex items-center gap-1.5 min-w-0 lg:pointer-events-none"
              onClick={onOpenChannelList}
            >
              <Hash size={16} className="text-gray-400 shrink-0" />
              <span className="font-medium text-sm text-gray-800 dark:text-gray-100 truncate">{channel.name}</span>
              <ChevronDown size={14} className="text-gray-400 shrink-0 lg:hidden" />
            </button>
          ) : (
            <>
              <Hash size={16} className="text-gray-400 shrink-0" />
              <span className="font-medium text-sm text-gray-800 dark:text-gray-100 truncate">{channel.name}</span>
            </>
          )}
          {channel.description && (
            <span className="text-xs text-gray-400 truncate hidden sm:inline">— {channel.description}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onlineMembers.length > 0 && (
            <div className="flex items-center -space-x-2" title={onlineMembers.map(m => m.user_name).join(", ")}>
              {onlineMembers.slice(0, 5).map(member => (
                <Avatar
                  key={member.user_id}
                  name={member.user_name}
                  avatarUrl={member.user_avatar_url}
                  size={24}
                  className="ring-2 ring-white dark:ring-neutral-900"
                />
              ))}
              {onlineMembers.length > 5 && (
                <div
                  style={{ width: 24, height: 24, fontSize: 10 }}
                  className="rounded-full bg-gray-200 dark:bg-neutral-700 text-gray-600 dark:text-gray-300 font-medium flex items-center justify-center shrink-0 ring-2 ring-white dark:ring-neutral-900"
                >
                  +{onlineMembers.length - 5}
                </div>
              )}
            </div>
          )}
          {canManageChannel && (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0">
                  <MoreVertical size={16} />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={4}
                  className="min-w-[160px] bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border dark:border-neutral-700 rounded-lg shadow-lg p-1 z-50"
                >
                  <DropdownMenu.Item
                    className="flex items-center gap-2 px-2 py-1.5 text-xs rounded cursor-pointer outline-none hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    onSelect={onRenameChannel}
                  >
                    <Pencil size={12} />
                    {t("messaging.renameChannel")}
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    className="flex items-center gap-2 px-2 py-1.5 text-xs rounded cursor-pointer outline-none text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                    onSelect={onDeleteChannel}
                  >
                    <Trash2 size={12} />
                    {t("messaging.deleteChannel")}
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 bg-gray-100 dark:bg-neutral-950">
        {messages.length === 0 && (
          <div className="text-center text-sm text-gray-400 py-8">{t("messaging.noMessages")}</div>
        )}
        <div className="flex flex-col gap-4">
          {timeline.map(item => {
            if (item.kind === "notice") {
              const memberName = members.find(m => m.user_id === item.notice.userId)?.user_name ?? item.notice.userId
              return (
                <div key={item.notice.id} className="text-center text-xs text-gray-400">
                  {t(item.notice.type === "join" ? "messaging.userJoinedChannel" : "messaging.userLeftChannel", { name: memberName })}
                </div>
              )
            }
            const message = item.message
            const isOwn = user?.id === message.created_by
            return (
            <div key={message.id} className={cn("flex gap-2", isOwn && "flex-row-reverse")}>
              {!isOwn && <Avatar name={message.created_by_name} avatarUrl={message.created_by_avatar_url} size={28} />}
              <div className={cn("flex-1 min-w-0 flex flex-col", isOwn ? "items-end" : "items-start")}>
                {!isOwn && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{message.created_by_name}</span>
                  </div>
                )}

                {editingId === message.id ? (
                  <div className="mt-1 w-full">
                    <CommentEditor
                      autoFocus
                      className="text-sm"
                      minHeight={64}
                      value={editingBody}
                      onChange={setEditingBody}
                      members={members}
                      workspaceId={workspaceId}
                      focusRing={false}
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
                  <div className={cn("flex items-end gap-1.5 mt-1", isOwn && "flex-row-reverse")}>
                    <div
                      className={cn(
                        "note-comment-body text-sm break-words px-3 py-2 rounded-2xl max-w-[75vw] sm:max-w-md bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-300 shadow-sm",
                        isOwn ? "rounded-tr-sm" : "rounded-tl-sm",
                      )}
                      dangerouslySetInnerHTML={{ __html: renderCommentBody(message.body) }}
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs text-gray-400 whitespace-nowrap">{formatRelativeTime(t, message.created_at)}</span>
                      {message.edited && <span className="text-xs text-gray-400 whitespace-nowrap">{t("messaging.edited")}</span>}
                      {isOwn && (
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger asChild>
                            <button className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0">
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
                                onSelect={() => handleStartEdit(message)}
                              >
                                <Pencil size={12} />
                                {t("actions.edit")}
                              </DropdownMenu.Item>
                              <DropdownMenu.Item
                                className="flex items-center gap-2 px-2 py-1.5 text-xs rounded cursor-pointer outline-none text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                onSelect={() => handleDelete(message)}
                              >
                                <Trash2 size={12} />
                                {t("actions.delete")}
                              </DropdownMenu.Item>
                            </DropdownMenu.Content>
                          </DropdownMenu.Portal>
                        </DropdownMenu.Root>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="shrink-0 border-t dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800/50">
        <div className="flex items-stretch">
          <CommentEditor
            key={composerKey}
            className="text-sm"
            minHeight={44}
            placeholder={t("messaging.composerPlaceholder", { name: channel.name }) as string}
            value={composerBody}
            onChange={setComposerBody}
            members={members}
            workspaceId={workspaceId}
            focusRing={false}
          />
          <button
            className="flex items-center justify-center w-14 shrink-0 bg-primary text-white disabled:opacity-40"
            disabled={!composerBody.trim() || !isConnected}
            onClick={handleSubmitComposer}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default ChannelView
