import { useNavigate } from "react-router-dom"
import useCurrentWorkspaceId from "@/hooks/use-currentworkspace-id"
import { useTranslation } from "react-i18next"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useWorkspaceStore } from "@/stores/workspace"
import { deleteWorkspace, updateWorkspace, getWorkspaceMembers, inviteMember, updateMemberRole, removeMember } from "@/api/workspace"
import { useEffect, useState } from "react"
import { Loader, RotateCcw, Trash2, UserPlus, X } from "lucide-react"
import OneColumn from "@/components/onecolumn/OneColumn"
import { useCurrentUserStore } from "@/stores/current-user"
import { toast } from "@/stores/toast"
import RunnersSection from "./RunnersSection"

const Settings = () => {
    const currentWorkspaceId = useCurrentWorkspaceId()
    const { isFetched, resetWorkspaces, getWorkspaceById } = useWorkspaceStore()
    const [workspaceName, setWorkspaceName] = useState("")
    const [isRenaming, SetIsRenaming] = useState(false)
    const { t } = useTranslation()
    const navigate = useNavigate()
    const { user: currentUser } = useCurrentUserStore()

    // Member management state
    const [inviteEmail, setInviteEmail] = useState("")
    const [inviteRole, setInviteRole] = useState<"admin" | "user">("user")
    const [showInviteForm, setShowInviteForm] = useState(false)

    useEffect(() => {
        if (!isFetched) return;

        const workspace = getWorkspaceById(currentWorkspaceId)

        if (!workspace) {
            throw new Error("No workspace found");
        }

        setWorkspaceName(workspace.name)

    }, [currentWorkspaceId])

    // Fetch workspace members
    const { data: members = [], refetch: refetchMembers } = useQuery({
        queryKey: ['workspaceMembers', currentWorkspaceId],
        queryFn: () => getWorkspaceMembers(currentWorkspaceId),
        enabled: !!currentWorkspaceId
    })

    const currentMember = members.find(m => m.user_id === currentUser?.id)
    const isOwner = currentMember?.role === 'owner'
    const isOwnerOrAdmin = currentMember?.role === 'owner' || currentMember?.role === 'admin'

    const renameWorkspaceNameMutation = useMutation({
        mutationFn: () => updateWorkspace(currentWorkspaceId, {
            name: workspaceName
        }),
        onSuccess: () => {
            resetWorkspaces()
            setTimeout(() => {
                SetIsRenaming(false)
            }, 200)
        }
    })

    const deleteWorkspaceMutation = useMutation({
        mutationFn: () => deleteWorkspace(currentWorkspaceId),
        onSuccess: () => {
            resetWorkspaces()
            navigate("/")
        }
    })

    const inviteMemberMutation = useMutation({
        mutationFn: () => inviteMember(currentWorkspaceId, { email: inviteEmail, role: inviteRole }),
        onSuccess: () => {
            toast.success(t("pages.settings.memberInvited"))
            setInviteEmail("")
            setInviteRole("user")
            setShowInviteForm(false)
            refetchMembers()
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || error?.message || "Failed to invite member")
        }
    })

    const updateRoleMutation = useMutation({
        mutationFn: ({ userId, role }: { userId: string, role: "admin" | "user" }) =>
            updateMemberRole(currentWorkspaceId, userId, { role }),
        onSuccess: () => {
            toast.success(t("pages.settings.memberRoleUpdated"))
            refetchMembers()
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || error?.message || "Failed to update role")
        }
    })

    const removeMemberMutation = useMutation({
        mutationFn: (userId: string) => removeMember(currentWorkspaceId, userId),
        onSuccess: (_, userId) => {
            if (userId === currentUser?.id) {
                toast.success(t("pages.settings.leftWorkspace"))
                resetWorkspaces()
                navigate("/")
            } else {
                toast.success(t("pages.settings.memberRemoved"))
                refetchMembers()
            }
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || error?.message || "Failed to remove member")
        }
    })

    const handleDeleteClick = () => {
        if (confirm(t("pages.settings.deleteThisWorkspaceMessage"))) {
            deleteWorkspaceMutation.mutate()
        }
    }

    const handleRenameClick = () => {
        SetIsRenaming(true)
        renameWorkspaceNameMutation.mutate()
    }

    const handleInviteMember = () => {
        if (!inviteEmail) return
        inviteMemberMutation.mutate()
    }

    const handleUpdateRole = (userId: string, newRole: "admin" | "user") => {
        updateRoleMutation.mutate({ userId, role: newRole })
    }

    const handleRemoveMember = (userId: string, isSelf: boolean) => {
        const confirmMessage = isSelf
            ? t("pages.settings.confirmLeaveWorkspace")
            : t("pages.settings.confirmRemoveMember")

        if (confirm(confirmMessage)) {
            removeMemberMutation.mutate(userId)
        }
    }

    return <OneColumn>

        <div
            className="w-full px-4 xl:px-4"
        >
            <div className="flex flex-col min-h-screen">
                <div className="py-2.5 flex items-center justify-between ">
                    <div className="flex gap-3 items-center sm:text-xl font-semibold h-10">
                        {t("menu.workspaceSettings")}
                    </div>
                </div>
                <div className="grow flex justify-start">
                    <div className="flex-1">
                        <div className="w-full">
                            <div className="bg-white dark:bg-neutral-800 rounded shadow-sm w-full p-5 max-w-3xl">
                                <div className="flex flex-col gap-6">
                                    {isOwner && (
                                        <div className="flex flex-col gap-2 ">
                                            <div className="text-lg font-semibold">
                                                {t("pages.settings.workspaceName")}
                                            </div>
                                            <div className="flex gap-3 flex-wrap">
                                                <input
                                                    className="flex-1 px-3 py-2 border dark:border-none rounded-lg dark:bg-neutral-700"
                                                    value={workspaceName}
                                                    onChange={e => setWorkspaceName(e.target.value)}
                                                    title="rename workspace"
                                                />
                                                <button
                                                    onClick={handleRenameClick}
                                                    className="px-3 py-2 flex gap-2 items-center text-neutral-600 dark:text-neutral-300"
                                                >

                                                    {isRenaming
                                                    ? <Loader size={16} className="animate-spin" />
                                                    : <>
                                                        <RotateCcw size={16} />
                                                        {t("actions.rename")}
                                                    </>
                                                    }
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Members Section */}
                                    <div className="flex flex-col gap-4">
                                        <div className="flex items-center justify-between">
                                            <div className="text-lg font-semibold">
                                                {t("pages.settings.members")}
                                            </div>
                                            {isOwnerOrAdmin && (
                                                <button
                                                    onClick={() => setShowInviteForm(!showInviteForm)}
                                                    className="px-3 py-2 flex gap-2 items-center text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded"
                                                >
                                                    {showInviteForm ? <X size={16} /> : <UserPlus size={16} />}
                                                    {t("pages.settings.inviteMember")}
                                                </button>
                                            )}
                                        </div>

                                        {/* Invite Form */}
                                        {showInviteForm && isOwnerOrAdmin && (
                                            <div className="flex flex-col gap-3 p-4 bg-neutral-50 dark:bg-neutral-700 rounded">
                                                <input
                                                    type="email"
                                                    className="flex-1 px-3 py-2 border dark:border-none rounded-lg dark:bg-neutral-600"
                                                    placeholder={t("pages.settings.inviteMemberPlaceholder")}
                                                    value={inviteEmail}
                                                    onChange={(e) => setInviteEmail(e.target.value)}
                                                />
                                                <div className="flex gap-3 items-center">
                                                    <select
                                                        className="px-3 py-2 border dark:border-none rounded-lg dark:bg-neutral-600"
                                                        value={inviteRole}
                                                        onChange={(e) => setInviteRole(e.target.value as "admin" | "user")}
                                                    >
                                                        <option value="user">{t("pages.settings.user")}</option>
                                                        <option value="admin">{t("pages.settings.admin")}</option>
                                                    </select>
                                                    <button
                                                        onClick={handleInviteMember}
                                                        disabled={inviteMemberMutation.isPending || !inviteEmail}
                                                        className="px-4 py-2 bg-blue-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600"
                                                    >
                                                        {inviteMemberMutation.isPending ? (
                                                            <Loader size={16} className="animate-spin" />
                                                        ) : (
                                                            t("pages.settings.inviteMember")
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Members List */}
                                        <div className="flex flex-col gap-2">
                                            {members.map((member) => {
                                                const isSelf = member.user_id === currentUser?.id
                                                const canChangeRole = isOwnerOrAdmin && member.role !== 'owner' && !isSelf
                                                const canRemove = (isOwnerOrAdmin || isSelf) && member.role !== 'owner'

                                                return (
                                                    <div
                                                        key={member.user_id}
                                                        className="flex items-center justify-between p-3 border dark:border-neutral-700 rounded-lg"
                                                    >
                                                        <div className="flex flex-col">
                                                            <div className="font-medium">
                                                                {member.user_name}
                                                                {isSelf && <span className="ml-2 text-sm text-neutral-500">(You)</span>}
                                                            </div>
                                                            <div className="text-sm text-neutral-500 dark:text-neutral-400">
                                                                {member.user_email}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            {canChangeRole ? (
                                                                <select
                                                                    className="px-2 py-1 border dark:border-none rounded dark:bg-neutral-700 text-sm"
                                                                    value={member.role}
                                                                    onChange={(e) => handleUpdateRole(member.user_id, e.target.value as "admin" | "user")}
                                                                    disabled={updateRoleMutation.isPending}
                                                                >
                                                                    <option value="user">{t("pages.settings.user")}</option>
                                                                    <option value="admin">{t("pages.settings.admin")}</option>
                                                                </select>
                                                            ) : (
                                                                <span className="px-2 py-1 text-sm font-medium text-neutral-600 dark:text-neutral-300">
                                                                    {t(`pages.settings.${member.role}`)}
                                                                </span>
                                                            )}
                                                            {canRemove && (
                                                                <button
                                                                    onClick={() => handleRemoveMember(member.user_id, isSelf)}
                                                                    disabled={removeMemberMutation.isPending}
                                                                    className="px-3 py-1 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded disabled:opacity-50"
                                                                >
                                                                    {isSelf ? t("pages.settings.leaveWorkspace") : t("pages.settings.removeMember")}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    {/* Instance-level runner management */}
                                    {(currentUser?.role === 'owner' || currentUser?.role === 'admin') && (
                                        <RunnersSection />
                                    )}

                                    {isOwner && (
                                        <div className="flex gap-2 items-center justify-between">
                                            <div className="flex flex-col">
                                                <div className=" text-lg font-semibold">
                                                    {t("pages.settings.deleteThisWorkspace")}
                                                </div>
                                            </div>
                                            <div>
                                                <button
                                                    onClick={handleDeleteClick}
                                                    className="p-3 text-red-500 flex items-center gap-2"
                                                    aria-label="delete"
                                                >
                                                    <Trash2 size={16} />
                                                    {t("actions.delete")}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </OneColumn>
}

export default Settings