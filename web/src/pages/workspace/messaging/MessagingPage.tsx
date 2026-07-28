import { FC, useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Link, Navigate, useNavigate, useParams } from "react-router-dom"
import { Hash, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { ChannelData, createChannel, deleteChannel, getChannels, updateChannel } from "@/api/channel"
import { getWorkspaceMembers } from "@/api/workspace"
import { useCurrentUserStore } from "@/stores/current-user"
import { useToastStore } from "@/stores/toast"
import { Modal } from "@/components/ui/modal"
import useCurrentWorkspaceId from "@/hooks/use-currentworkspace-id"
import ChannelView from "./ChannelView"

const MessagingPage: FC = () => {
  const { t } = useTranslation()
  const currentWorkspaceId = useCurrentWorkspaceId()
  const { channelId } = useParams<{ channelId?: string }>()
  const navigate = useNavigate()
  const { user: currentUser } = useCurrentUserStore()
  const { addToast } = useToastStore()
  const queryClient = useQueryClient()

  const [dialogMode, setDialogMode] = useState<"create" | "rename" | null>(null)
  const [formName, setFormName] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [isChannelSheetOpen, setIsChannelSheetOpen] = useState(false)

  const channelsQueryKey = ["channels", currentWorkspaceId]

  const { data: channels = [], isLoading: isLoadingChannels } = useQuery({
    queryKey: channelsQueryKey,
    queryFn: () => getChannels(currentWorkspaceId),
    enabled: !!currentWorkspaceId,
  })

  const { data: members = [] } = useQuery({
    queryKey: ["workspaceMembers", currentWorkspaceId],
    queryFn: () => getWorkspaceMembers(currentWorkspaceId),
    enabled: !!currentWorkspaceId,
  })

  const currentMember = members.find(m => m.user_id === currentUser?.id)
  const isOwnerOrAdmin = currentMember?.role === "owner" || currentMember?.role === "admin"

  const activeChannel = channels.find(c => c.id === channelId)
  const base = `/workspaces/${currentWorkspaceId}/messaging`

  useEffect(() => {
    if (dialogMode !== "rename" || !activeChannel) return
    setFormName(activeChannel.name)
    setFormDescription(activeChannel.description)
  }, [dialogMode, activeChannel])

  const createMutation = useMutation({
    mutationFn: () => createChannel(currentWorkspaceId, { name: formName.trim(), description: formDescription.trim() }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: channelsQueryKey })
      closeDialog()
      navigate(`${base}/${created.id}`)
    },
    onError: () => addToast({ title: t("messaging.createChannelFailed"), type: "error" }),
  })

  const renameMutation = useMutation({
    mutationFn: () => updateChannel(currentWorkspaceId, activeChannel!.id, { name: formName.trim(), description: formDescription.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: channelsQueryKey })
      closeDialog()
    },
    onError: () => addToast({ title: t("messaging.updateChannelFailed"), type: "error" }),
  })

  const deleteMutation = useMutation({
    mutationFn: (channel: ChannelData) => deleteChannel(currentWorkspaceId, channel.id),
    onSuccess: (_data, channel) => {
      queryClient.invalidateQueries({ queryKey: channelsQueryKey })
      if (channel.id === channelId) navigate(base)
    },
    onError: () => addToast({ title: t("messaging.deleteChannelFailed"), type: "error" }),
  })

  const closeDialog = () => {
    setDialogMode(null)
    setFormName("")
    setFormDescription("")
  }

  const handleSubmitDialog = () => {
    if (!formName.trim()) return
    if (dialogMode === "create") createMutation.mutate()
    else if (dialogMode === "rename") renameMutation.mutate()
  }

  const handleDeleteChannel = () => {
    if (!activeChannel) return
    if (!confirm(t("messaging.confirmDeleteChannel"))) return
    deleteMutation.mutate(activeChannel)
  }

  if (!isLoadingChannels && channels.length > 0 && !channelId) {
    return <Navigate to={`${base}/${channels[0].id}`} replace />
  }

  const channelListContent = (
    <>
      <div className="shrink-0 flex items-center justify-between px-3 py-3">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t("messaging.channels")}</span>
        <button
          aria-label={t("messaging.newChannel") as string}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          onClick={() => setDialogMode("create")}
        >
          <Plus size={16} />
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        {channels.map(channel => (
          <Link
            key={channel.id}
            to={`${base}/${channel.id}`}
            onClick={() => setIsChannelSheetOpen(false)}
            className={[
              "flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm truncate",
              channel.id === channelId
                ? "bg-neutral-200 dark:bg-neutral-800 text-gray-900 dark:text-gray-100 font-medium"
                : "text-gray-500 dark:text-gray-400 hover:bg-neutral-100 dark:hover:bg-neutral-800/60",
            ].join(" ")}
          >
            <Hash size={14} className="shrink-0 opacity-60" />
            <span className="truncate">{channel.name}</span>
          </Link>
        ))}
      </nav>
    </>
  )

  return (
    <div className="flex h-full min-h-0">
      <div className="hidden lg:flex w-56 shrink-0 border-r dark:border-neutral-700 flex-col overflow-hidden">
        {channelListContent}
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {activeChannel ? (
          <ChannelView
            workspaceId={currentWorkspaceId}
            channel={activeChannel}
            members={members}
            canManageChannel={isOwnerOrAdmin}
            onRenameChannel={() => setDialogMode("rename")}
            onDeleteChannel={handleDeleteChannel}
            onOpenChannelList={() => setIsChannelSheetOpen(true)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-sm text-gray-400 text-center px-4">
            <span>{channels.length === 0 ? t("messaging.noChannels") : t("messaging.selectChannel")}</span>
            {channels.length > 0 && (
              <button
                className="lg:hidden text-xs px-3 py-1.5 border dark:border-neutral-600 rounded-md text-gray-600 dark:text-gray-300"
                onClick={() => setIsChannelSheetOpen(true)}
              >
                {t("messaging.channels")}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Mobile channel list bottom sheet */}
      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden",
          isChannelSheetOpen ? "" : "pointer-events-none",
        )}
      >
        <div
          className={cn(
            "absolute inset-0 bg-black/50 transition-opacity duration-200",
            isChannelSheetOpen ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setIsChannelSheetOpen(false)}
        />
        <div
          className={cn(
            "absolute bottom-0 left-0 right-0 max-h-[70vh] rounded-t-2xl bg-white dark:bg-neutral-900 shadow-xl flex flex-col overflow-hidden transition-transform duration-200 ease-out",
            isChannelSheetOpen ? "translate-y-0" : "translate-y-full",
          )}
        >
          <div className="shrink-0 flex items-center justify-center py-2">
            <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-neutral-600" />
          </div>
          {channelListContent}
        </div>
      </div>

      <Modal
        open={dialogMode !== null}
        onOpenChange={(open) => { if (!open) closeDialog() }}
        title={dialogMode === "rename" ? t("messaging.renameChannel") : t("messaging.newChannel")}
        showClose
      >
        <div className="flex flex-col gap-3">
          <input
            autoFocus
            type="text"
            value={formName}
            onChange={e => setFormName(e.target.value)}
            placeholder={t("messaging.channelName") as string}
            className="w-full px-3 py-2 text-sm border dark:border-neutral-600 rounded bg-white dark:bg-neutral-900"
            onKeyDown={e => { if (e.key === "Enter") handleSubmitDialog() }}
          />
          <input
            type="text"
            value={formDescription}
            onChange={e => setFormDescription(e.target.value)}
            placeholder={t("messaging.channelDescription") as string}
            className="w-full px-3 py-2 text-sm border dark:border-neutral-600 rounded bg-white dark:bg-neutral-900"
            onKeyDown={e => { if (e.key === "Enter") handleSubmitDialog() }}
          />
          <div className="flex justify-end gap-2 mt-1">
            <button className="text-xs px-3 py-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" onClick={closeDialog}>
              {t("actions.cancel")}
            </button>
            <button
              className="text-xs px-3 py-1.5 bg-primary text-white rounded disabled:opacity-50"
              disabled={!formName.trim()}
              onClick={handleSubmitDialog}
            >
              {dialogMode === "rename" ? t("actions.save") : t("messaging.createChannel")}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default MessagingPage
