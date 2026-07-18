import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { useMutation } from "@tanstack/react-query"
import { useTheme, Theme } from "@/providers/Theme"
import { useCurrentUserStore } from "@/stores/current-user"
import { useWorkspaceStore } from "@/stores/workspace"
import { signOut } from "@/api/auth"
import { toast } from "@/stores/toast"
import { useState, useEffect, useRef } from "react"
import { updatePreferences, uploadAvatar, removeAvatar, updateEmail, changePassword } from "@/api/user"
import { listAPIKeys, createAPIKey, deleteAPIKey, APIKey, CreateAPIKeyRequest } from "@/api/apikey"
import { listUsers, createUser, deleteUser, updateUserPassword, disableUser, enableUser, AdminUser, CreateUserRequest, UpdateUserPasswordRequest } from "@/api/admin"
import RunnersSection from "@/pages/workspace/settings/RunnersSection"
import Select from "@/components/select/Select"
import Avatar from "@/components/avatar/Avatar"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { Trash2, Plus, Copy, AlertTriangle, Edit, UserX, UserCheck, Check, LogOut, Camera, X } from "lucide-react"

interface UserSettingsModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

const UserSettingsModal = ({ open, onOpenChange }: UserSettingsModalProps) => {
    const { user, fetchUser, resetCurrentUser } = useCurrentUserStore()
    const { resetWorkspaces } = useWorkspaceStore()
    const { t, i18n } = useTranslation()
    const navigate = useNavigate()
    const { theme, setTheme, primaryColor, setPrimaryColor } = useTheme()!
    const avatarInputRef = useRef<HTMLInputElement>(null)
    const [avatarUploading, setAvatarUploading] = useState(false)
    const [avatarRemoving, setAvatarRemoving] = useState(false)
    const [editingEmail, setEditingEmail] = useState(false)
    const [emailValue, setEmailValue] = useState("")
    const [emailSaving, setEmailSaving] = useState(false)
    const [showOwnPasswordDialog, setShowOwnPasswordDialog] = useState(false)
    const [ownPasswordFormData, setOwnPasswordFormData] = useState({ newPassword: "", confirmPassword: "" })
    const [ownPasswordSaving, setOwnPasswordSaving] = useState(false)

    // Tab state
    const [activeTab, setActiveTab] = useState<'account' | 'preferences' | 'apiKeys' | 'users' | 'system'>('account')
    const isOwner = user?.role === 'owner'

    // Preferences state
    const themes: Theme[] = ["light", "dark"]
    const supportedLanguages = i18n.options.supportedLngs && i18n.options.supportedLngs?.filter(l => l !== "cimode") || []

    // Language native names mapping
    const languageNativeNames: Record<string, string> = {
        'en': 'English',
        'zh-TW': '繁體中文',
        'zh-CN': '简体中文',
        'es': 'Español',
        'fr': 'Français',
        'ar': 'العربية',
        'pt-BR': 'Português (Brasil)',
        'de': 'Deutsch',
        'ja': '日本語',
        'ko': '한국어',
        'ru': 'Русский',
        'it': 'Italiano'
    }

    const PRESET_COLORS = [
        { name: 'Orange', value: '#f97316' },
        { name: 'Blue', value: '#3b82f6' },
        { name: 'Green', value: '#22c55e' },
        { name: 'Purple', value: '#a855f7' },
        { name: 'Pink', value: '#ec4899' },
        { name: 'Red', value: '#ef4444' },
        { name: 'Indigo', value: '#6366f1' },
        { name: 'Teal', value: '#14b8a6' },
    ]

    // API Keys state
    const [apiKeys, setApiKeys] = useState<APIKey[]>([])
    const [loading, setLoading] = useState(false)
    const [showCreationDialog, setShowCreationDialog] = useState(false)
    const [newKeyName, setNewKeyName] = useState("")
    const [newKeyExpiresAt, setNewKeyExpiresAt] = useState("")
    const [createdKey, setCreatedKey] = useState<string | null>(null)

    // User Management state
    const [users, setUsers] = useState<AdminUser[]>([])
    const [usersLoading, setUsersLoading] = useState(false)
    const [showUserDialog, setShowUserDialog] = useState(false)
    const [userFormData, setUserFormData] = useState({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
        role: "user"
    })
    const [showPasswordDialog, setShowPasswordDialog] = useState(false)
    const [passwordFormData, setPasswordFormData] = useState({
        userId: "",
        newPassword: "",
        confirmPassword: ""
    })

    // Preferences handlers
    const handleSelectedLangChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        i18n.changeLanguage(e.target.value)
    }

    const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newTheme = e.target.value as Theme
        setTheme(newTheme)
    }

    const savePreferences = async () => {
        if (!user) return

        const updatedUser = {
            ...user,
            preferences: {
                lang: i18n.language,
                theme: theme,
                primaryColor: primaryColor
            }
        }

        try {
            await updatePreferences(updatedUser)
        } catch (err) {
            toast.error(t("messages.settingsUpdateFailed"))
        }
    }

    // API Keys handlers
    const loadAPIKeys = async () => {
        if (!user) return

        setLoading(true)
        try {
            const keys = await listAPIKeys(user.id)
            setApiKeys(keys)
        } catch (err) {
            toast.error(t("messages.apiKeyLoadFailed"))
        } finally {
            setLoading(false)
        }
    }

    const handleCreateAPIKey = async () => {
        if (!user || !newKeyName.trim()) {
            toast.error(t("messages.apiKeyNameRequired"))
            return
        }

        try {
            const request: CreateAPIKeyRequest = {
                name: newKeyName.trim(),
            }

            if (newKeyExpiresAt) {
                request.expires_at = new Date(newKeyExpiresAt).toISOString()
            }

            const response = await createAPIKey(user.id, request)
            setCreatedKey(response.full_key)
            setNewKeyName("")
            setNewKeyExpiresAt("")
            await loadAPIKeys()
            toast.success(t("messages.apiKeyCreated"))
        } catch (err) {
            toast.error(t("messages.apiKeyCreateFailed"))
        }
    }

    const handleDeleteAPIKey = async (keyId: string) => {
        if (!user) return

        if (!confirm(t("pages.preferences.deleteKeyConfirm"))) {
            return
        }

        try {
            await deleteAPIKey(user.id, keyId)
            await loadAPIKeys()
            toast.success(t("messages.apiKeyDeleted"))
        } catch (err) {
            toast.error(t("messages.apiKeyDeleteFailed"))
        }
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
        toast.success(t("messages.copied"))
    }

    const formatDate = (dateString: string) => {
        if (!dateString) return t("pages.preferences.never")
        return new Date(dateString).toLocaleDateString()
    }

    const isExpired = (expiresAt: string) => {
        if (!expiresAt) return false
        return new Date(expiresAt) < new Date()
    }

    // User Management handlers
    const loadUsers = async () => {
        if (!isOwner) return

        setUsersLoading(true)
        try {
            const usersList = await listUsers()
            setUsers(usersList)
        } catch (err) {
            toast.error(t("messages.userLoadFailed"))
        } finally {
            setUsersLoading(false)
        }
    }

    const handleCreateUser = async () => {
        if (!userFormData.name.trim()) {
            toast.error(t("messages.userNameRequired"))
            return
        }
        if (!userFormData.email.trim()) {
            toast.error(t("messages.userEmailRequired"))
            return
        }
        if (!userFormData.password) {
            toast.error(t("messages.userPasswordRequired"))
            return
        }
        if (userFormData.password !== userFormData.confirmPassword) {
            toast.error(t("messages.passwordMismatch"))
            return
        }

        try {
            const request: CreateUserRequest = {
                name: userFormData.name.trim(),
                email: userFormData.email.trim(),
                password: userFormData.password,
                role: userFormData.role
            }
            await createUser(request)
            setUserFormData({ name: "", email: "", password: "", confirmPassword: "", role: "user" })
            setShowUserDialog(false)
            await loadUsers()
            toast.success(t("messages.userCreated"))
        } catch (err) {
            toast.error(t("messages.userCreateFailed"))
        }
    }

    const handleDeleteUser = async (userId: string) => {
        if (!confirm(t("pages.preferences.deleteUserConfirm"))) {
            return
        }

        try {
            await deleteUser(userId)
            await loadUsers()
            toast.success(t("messages.userDeleted"))
        } catch (err) {
            toast.error(t("messages.userDeleteFailed"))
        }
    }

    const handleDisableUser = async (userId: string) => {
        if (!confirm(t("pages.preferences.disableUserConfirm"))) {
            return
        }

        try {
            await disableUser(userId)
            await loadUsers()
            toast.success(t("messages.userDisabled"))
        } catch (err) {
            toast.error(t("messages.userUpdateFailed"))
        }
    }

    const handleEnableUser = async (userId: string) => {
        if (!confirm(t("pages.preferences.enableUserConfirm"))) {
            return
        }

        try {
            await enableUser(userId)
            await loadUsers()
            toast.success(t("messages.userEnabled"))
        } catch (err) {
            toast.error(t("messages.userUpdateFailed"))
        }
    }

    const handleChangePassword = async () => {
        if (!passwordFormData.newPassword) {
            toast.error(t("messages.userPasswordRequired"))
            return
        }
        if (passwordFormData.newPassword !== passwordFormData.confirmPassword) {
            toast.error(t("messages.passwordMismatch"))
            return
        }

        try {
            const request: UpdateUserPasswordRequest = {
                password: passwordFormData.newPassword
            }
            await updateUserPassword(passwordFormData.userId, request)
            setPasswordFormData({ userId: "", newPassword: "", confirmPassword: "" })
            setShowPasswordDialog(false)
            toast.success(t("messages.userUpdated"))
        } catch (err) {
            toast.error(t("messages.userUpdateFailed"))
        }
    }

    const openPasswordDialog = (userId: string) => {
        setPasswordFormData({ userId, newPassword: "", confirmPassword: "" })
        setShowPasswordDialog(true)
    }

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        e.target.value = ""
        if (!file || !user) return

        if (!file.type.startsWith("image/")) {
            toast.error(t("messages.avatarInvalidType"))
            return
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error(t("messages.avatarTooLarge"))
            return
        }

        setAvatarUploading(true)
        try {
            await uploadAvatar(user.id, file)
            await fetchUser()
            toast.success(t("messages.avatarUploaded"))
        } catch (err) {
            toast.error(t("messages.avatarUploadFailed"))
        } finally {
            setAvatarUploading(false)
        }
    }

    const handleRemoveAvatar = async () => {
        if (!user) return

        setAvatarRemoving(true)
        try {
            await removeAvatar(user.id)
            await fetchUser()
            toast.success(t("messages.avatarRemoved"))
        } catch (err) {
            toast.error(t("messages.avatarRemoveFailed"))
        } finally {
            setAvatarRemoving(false)
        }
    }

    const startEditingEmail = () => {
        setEmailValue(user?.email || "")
        setEditingEmail(true)
    }

    const cancelEditingEmail = () => {
        setEditingEmail(false)
        setEmailValue("")
    }

    const handleSaveEmail = async () => {
        if (!user) return

        const trimmed = emailValue.trim()
        if (!trimmed) {
            toast.error(t("messages.userEmailRequired"))
            return
        }
        if (trimmed === user.email) {
            cancelEditingEmail()
            return
        }

        setEmailSaving(true)
        try {
            await updateEmail(user.id, trimmed)
            await fetchUser()
            setEditingEmail(false)
            toast.success(t("messages.emailUpdated"))
        } catch (err) {
            toast.error(t("messages.emailUpdateFailed"))
        } finally {
            setEmailSaving(false)
        }
    }

    const handleChangeOwnPassword = async () => {
        if (!user) return

        if (!ownPasswordFormData.newPassword) {
            toast.error(t("messages.userPasswordRequired"))
            return
        }
        if (ownPasswordFormData.newPassword !== ownPasswordFormData.confirmPassword) {
            toast.error(t("messages.passwordMismatch"))
            return
        }

        setOwnPasswordSaving(true)
        try {
            await changePassword(user.id, ownPasswordFormData.newPassword)
            setOwnPasswordFormData({ newPassword: "", confirmPassword: "" })
            setShowOwnPasswordDialog(false)
            toast.success(t("messages.passwordUpdated"))
        } catch (err) {
            toast.error(t("messages.passwordUpdateFailed"))
        } finally {
            setOwnPasswordSaving(false)
        }
    }

    const signoutMutation = useMutation({
        mutationFn: () => signOut(),
        onSuccess: () => {
            try {
                onOpenChange(false)
                resetWorkspaces()
                resetCurrentUser()
                navigate("/")
            } catch (error) {
                console.error("Error during sign out:", error)
            }
        },
    })

    useEffect(() => {
        if (!user || !open) return
        savePreferences()
    }, [theme, i18n.language, primaryColor])

    useEffect(() => {
        if (open && activeTab === 'apiKeys') {
            loadAPIKeys()
        }
        if (open && activeTab === 'users' && isOwner) {
            loadUsers()
        }
    }, [open, activeTab, isOwner])

    return (
        <>
            <Modal
                open={open}
                onOpenChange={onOpenChange}
                title={t("menu.settings")}
                className="max-w-[800px] h-[85vh] flex flex-col"
            >
                        {/* Tabs */}
                        <div className="flex gap-2 overflow-x-auto border-b border-gray-200 dark:border-neutral-700 mb-4">
                            <button
                                onClick={() => setActiveTab('account')}
                                className={`shrink-0 whitespace-nowrap px-3 sm:px-4 py-2 text-sm sm:text-base font-medium transition-colors ${
                                    activeTab === 'account'
                                        ? 'text-primary dark:text-primary border-b-2 border-primary dark:border-primary'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                }`}
                            >
                                {t("menu.user")}
                            </button>
                            <button
                                onClick={() => setActiveTab('preferences')}
                                className={`shrink-0 whitespace-nowrap px-3 sm:px-4 py-2 text-sm sm:text-base font-medium transition-colors ${
                                    activeTab === 'preferences'
                                        ? 'text-primary dark:text-primary border-b-2 border-primary dark:border-primary'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                }`}
                            >
                                {t("pages.preferences.language")} & {t("pages.preferences.theme")}
                            </button>
                            <button
                                onClick={() => setActiveTab('apiKeys')}
                                className={`shrink-0 whitespace-nowrap px-3 sm:px-4 py-2 text-sm sm:text-base font-medium transition-colors ${
                                    activeTab === 'apiKeys'
                                        ? 'text-primary dark:text-primary border-b-2 border-primary dark:border-primary'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                }`}
                            >
                                {t("pages.preferences.apiKeys")}
                            </button>
                            {isOwner && (
                                <button
                                    onClick={() => setActiveTab('users')}
                                    className={`shrink-0 whitespace-nowrap px-3 sm:px-4 py-2 text-sm sm:text-base font-medium transition-colors ${
                                        activeTab === 'users'
                                            ? 'text-primary dark:text-primary border-b-2 border-primary dark:border-primary'
                                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                    }`}
                                >
                                    {t("pages.preferences.userManagement")}
                                </button>
                            )}
                            {isOwner && (
                                <button
                                    onClick={() => setActiveTab('system')}
                                    className={`shrink-0 whitespace-nowrap px-3 sm:px-4 py-2 text-sm sm:text-base font-medium transition-colors ${
                                        activeTab === 'system'
                                            ? 'text-primary dark:text-primary border-b-2 border-primary dark:border-primary'
                                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                    }`}
                                >
                                    {t("pages.preferences.systemSettings")}
                                </button>
                            )}
                        </div>

                        <div className="space-y-4 overflow-y-auto flex-1">
                            {/* Account Tab */}
                            {activeTab === 'account' && (
                                <div className="w-full px-4">
                                    <div className="flex flex-col gap-6">
                                        {/* Avatar field */}
                                        <div className="flex flex-col">
                                            <div className="text-xs font-semibold text-gray-500 mb-2">
                                                {t("pages.preferences.changeAvatar")}
                                            </div>
                                            <div className="relative w-fit">
                                                <Avatar name={user?.name} avatarUrl={user?.avatar_url} size={56} />
                                                <button
                                                    onClick={() => avatarInputRef.current?.click()}
                                                    disabled={avatarUploading || avatarRemoving}
                                                    className="absolute -bottom-1 -right-1 p-1 rounded-full bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50"
                                                    title={t("pages.preferences.changeAvatar")}
                                                >
                                                    <Camera size={12} />
                                                </button>
                                                {user?.avatar_url && (
                                                    <button
                                                        onClick={handleRemoveAvatar}
                                                        disabled={avatarUploading || avatarRemoving}
                                                        className="absolute -top-1 -right-1 p-1 rounded-full bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                                                        title={t("pages.preferences.removeAvatar")}
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                )}
                                                <input
                                                    ref={avatarInputRef}
                                                    type="file"
                                                    accept="image/png,image/jpeg,image/gif,image/webp"
                                                    className="hidden"
                                                    onChange={handleAvatarChange}
                                                />
                                            </div>
                                        </div>

                                        {/* Name field */}
                                        <div className="flex flex-col">
                                            <div className="text-xs font-semibold text-gray-500 mb-2">
                                                {t("form.username")}
                                            </div>
                                            <p className="text-sm font-medium">{user?.name}</p>
                                        </div>

                                        {/* Email field */}
                                        <div className="flex flex-col">
                                            <div className="text-xs font-semibold text-gray-500 mb-2">
                                                {t("form.email")}
                                            </div>
                                            {editingEmail ? (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="email"
                                                        value={emailValue}
                                                        onChange={(e) => setEmailValue(e.target.value)}
                                                        autoFocus
                                                        className="min-w-0 flex-1 max-w-xs px-2 py-1.5 text-sm border rounded-md dark:bg-neutral-900 dark:border-neutral-700"
                                                    />
                                                    <button
                                                        onClick={handleSaveEmail}
                                                        disabled={emailSaving}
                                                        className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors disabled:opacity-50"
                                                        title={t("actions.save")}
                                                    >
                                                        <Check size={14} />
                                                    </button>
                                                    <button
                                                        onClick={cancelEditingEmail}
                                                        disabled={emailSaving}
                                                        className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded transition-colors disabled:opacity-50"
                                                        title={t("actions.cancel")}
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="text-sm">{user?.email}</p>
                                                    <button
                                                        onClick={startEditingEmail}
                                                        className="text-xs font-medium text-primary hover:underline shrink-0"
                                                    >
                                                        {t("pages.preferences.changeEmail")}
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Password field */}
                                        <div className="flex flex-col">
                                            <div className="text-xs font-semibold text-gray-500 mb-2">
                                                {t("form.password")}
                                            </div>
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-sm tracking-widest">••••••••</p>
                                                <button
                                                    onClick={() => setShowOwnPasswordDialog(true)}
                                                    className="text-xs font-medium text-primary hover:underline shrink-0"
                                                >
                                                    {t("pages.preferences.changePassword")}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Sign out */}
                                        <div className="flex flex-col pt-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="w-fit mt-4 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                onClick={() => signoutMutation.mutate()}
                                            >
                                                <LogOut size={16} />
                                                {t("actions.signout")}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Preferences Tab */}
                            {activeTab === 'preferences' && (
                                <div className="w-full">
                                    <div className="flex flex-col gap-6">
                                        <div className="flex flex-col">
                                            <div className="text-xs font-semibold text-gray-500 mb-2">
                                                {t("pages.preferences.language")}
                                            </div>
                                            <div>
                                                <Select value={i18n.language} onChange={handleSelectedLangChange}>
                                                    {supportedLanguages.map((lng) => (
                                                        <option key={lng} value={lng}>
                                                            {languageNativeNames[lng] || lng}
                                                        </option>
                                                    ))}
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="flex flex-col">
                                            <div className="text-xs font-semibold text-gray-500 mb-2">
                                                {t("pages.preferences.theme")}
                                            </div>
                                            <div>
                                                <Select value={theme} onChange={handleThemeChange}>
                                                    {themes.map((t) => (
                                                        <option key={t} value={t}>
                                                            {t}
                                                        </option>
                                                    ))}
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="flex flex-col">
                                            <div className="text-xs font-semibold text-gray-500 mb-2">
                                                {t("pages.preferences.primaryColor")}
                                            </div>

                                            {/* Preset colors grid */}
                                            <div className="flex gap-2 mb-3">
                                                {PRESET_COLORS.map((color) => (
                                                    <button
                                                        key={color.value}
                                                        onClick={() => setPrimaryColor(color.value)}
                                                        className="relative w-8 h-8 rounded-full border-2 transition-all hover:scale-110"
                                                        style={{
                                                            backgroundColor: color.value,
                                                            borderColor: primaryColor === color.value ? '#000' : 'transparent'
                                                        }}
                                                        title={color.name}
                                                    >
                                                        {primaryColor === color.value && (
                                                            <Check className="absolute inset-0 m-auto text-white" size={16} />
                                                        )}
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Custom color picker */}
                                            <div className="flex items-center gap-3">
                                                <label className="text-sm text-gray-600 dark:text-gray-400">
                                                    {t("pages.preferences.customColor")}
                                                </label>
                                                <input
                                                    type="color"
                                                    value={primaryColor}
                                                    onChange={(e) => setPrimaryColor(e.target.value)}
                                                    className="w-12 h-8 rounded border cursor-pointer"
                                                />
                                                <span className="text-sm font-mono text-gray-500">
                                                    {primaryColor.toUpperCase()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* API Keys Tab */}
                            {activeTab === 'apiKeys' && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            {t("pages.preferences.apiKeyDescription")}
                                        </p>
                                        <Button onClick={() => setShowCreationDialog(true)}>
                                            <Plus size={16} />
                                            {t("pages.preferences.generateNewKey")}
                                        </Button>
                                    </div>

                                    {loading ? (
                                        <div className="text-center py-8">{t("common.loading")}</div>
                                    ) : apiKeys.length === 0 ? (
                                        <div className="p-8 text-center text-gray-500">
                                            {t("pages.preferences.noApiKeys")}
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {apiKeys.map((key) => (
                                                <div key={key.id} className="p-4 border border-gray-200 dark:border-neutral-700 rounded-lg">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <div className="font-semibold">{key.name}</div>
                                                                {isExpired(key.expires_at) && (
                                                                    <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                                                                        {t("pages.preferences.expired")}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                                                                {key.prefix}...
                                                            </p>
                                                            <div className="text-xs text-gray-500 mt-1">
                                                                <span>{t("pages.preferences.created")}: {formatDate(key.created_at)}</span>
                                                                {key.last_used_at && (
                                                                    <span className="ml-4">
                                                                        {t("pages.preferences.lastUsed")}: {formatDate(key.last_used_at)}
                                                                    </span>
                                                                )}
                                                                {key.expires_at && (
                                                                    <span className="ml-4">
                                                                        {t("pages.preferences.expires")}: {formatDate(key.expires_at)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleDeleteAPIKey(key.id)}
                                                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                                            title={t("actions.delete")}
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Users Tab */}
                            {activeTab === 'users' && isOwner && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            {t("pages.preferences.userList")}
                                        </p>
                                        <Button onClick={() => setShowUserDialog(true)}>
                                            <Plus size={16} />
                                            {t("pages.preferences.createUser")}
                                        </Button>
                                    </div>

                                    {usersLoading ? (
                                        <div className="text-center py-8">{t("common.loading")}</div>
                                    ) : users.length === 0 ? (
                                        <div className="p-8 text-center text-gray-500">
                                            {t("pages.preferences.noUsers")}
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {users.map((u) => (
                                                <div key={u.id} className="p-4 border border-gray-200 dark:border-neutral-700 rounded-lg">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <div className="font-semibold">{u.name}</div>
                                                                <span className={`text-xs px-2 py-1 rounded ${
                                                                    u.role === 'owner'
                                                                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                                                                        : u.role === 'admin'
                                                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                                                                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                                                }`}>
                                                                    {u.role === 'owner' && t("pages.preferences.roleOwner")}
                                                                    {u.role === 'admin' && t("pages.preferences.roleAdmin")}
                                                                    {u.role === 'user' && t("pages.preferences.roleUser")}
                                                                </span>
                                                                {u.disabled && (
                                                                    <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                                                                        {t("pages.preferences.disabled")}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                                {u.email}
                                                            </p>
                                                            <div className="text-xs text-gray-500 mt-1">
                                                                <span>{t("pages.preferences.created")}: {formatDate(u.created_at)}</span>
                                                            </div>
                                                        </div>
                                                        {u.role !== 'owner' && (
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={() => openPasswordDialog(u.id)}
                                                                    className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                                                    title={t("pages.preferences.changePassword")}
                                                                >
                                                                    <Edit size={18} />
                                                                </button>
                                                                {u.disabled ? (
                                                                    <button
                                                                        onClick={() => handleEnableUser(u.id)}
                                                                        className="p-2 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                                                                        title={t("pages.preferences.enableUser")}
                                                                    >
                                                                        <UserCheck size={18} />
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => handleDisableUser(u.id)}
                                                                        className="p-2 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
                                                                        title={t("pages.preferences.disableUser")}
                                                                    >
                                                                        <UserX size={18} />
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => handleDeleteUser(u.id)}
                                                                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                                                    title={t("actions.delete")}
                                                                >
                                                                    <Trash2 size={18} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* System Settings Tab */}
                            {activeTab === 'system' && isOwner && (
                                <RunnersSection />
                            )}
                        </div>
            </Modal>

            {/* Change Own Password Dialog */}
            <Modal
                open={showOwnPasswordDialog}
                onOpenChange={setShowOwnPasswordDialog}
                title={t("pages.preferences.changePassword")}
                nested
            >
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold">{t("pages.preferences.newPassword")}</label>
                                <input
                                    type="password"
                                    value={ownPasswordFormData.newPassword}
                                    onChange={(e) => setOwnPasswordFormData({ ...ownPasswordFormData, newPassword: e.target.value })}
                                    placeholder={t("pages.preferences.newPassword")}
                                    autoFocus
                                    className="w-full px-3 py-2 border rounded-md dark:bg-neutral-900 dark:border-neutral-700"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold">{t("pages.preferences.confirmNewPassword")}</label>
                                <input
                                    type="password"
                                    value={ownPasswordFormData.confirmPassword}
                                    onChange={(e) => setOwnPasswordFormData({ ...ownPasswordFormData, confirmPassword: e.target.value })}
                                    placeholder={t("pages.preferences.confirmNewPassword")}
                                    className="w-full px-3 py-2 border rounded-md dark:bg-neutral-900 dark:border-neutral-700"
                                />
                            </div>

                            <div className="flex gap-2">
                                <Button className="flex-1" onClick={handleChangeOwnPassword} disabled={ownPasswordSaving}>
                                    {t("actions.save")}
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setShowOwnPasswordDialog(false)
                                        setOwnPasswordFormData({ newPassword: "", confirmPassword: "" })
                                    }}
                                    disabled={ownPasswordSaving}
                                >
                                    {t("actions.cancel")}
                                </Button>
                            </div>
                        </div>
            </Modal>

            {/* API Key Creation Dialog */}
            <Modal
                open={showCreationDialog}
                onOpenChange={setShowCreationDialog}
                title={t("pages.preferences.createNewKey")}
                nested
            >
                        {createdKey ? (
                            <div className="space-y-4">
                                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                                    <div className="flex gap-2 items-start">
                                        <AlertTriangle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
                                        <div className="text-sm text-yellow-800 dark:text-yellow-200">
                                            <strong>{t("pages.preferences.saveKeyWarning")}</strong>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold">{t("pages.preferences.yourApiKey")}</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={createdKey}
                                            readOnly
                                            className="flex-1 px-3 py-2 border rounded-md font-mono text-sm bg-gray-50 dark:bg-neutral-900"
                                        />
                                        <Button
                                            size="icon"
                                            onClick={() => copyToClipboard(createdKey)}
                                            title={t("actions.copy")}
                                        >
                                            <Copy size={16} />
                                        </Button>
                                    </div>
                                </div>

                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => {
                                        setCreatedKey(null)
                                        setShowCreationDialog(false)
                                    }}
                                >
                                    {t("pages.preferences.done")}
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold">{t("pages.preferences.keyName")}</label>
                                    <input
                                        type="text"
                                        value={newKeyName}
                                        onChange={(e) => setNewKeyName(e.target.value)}
                                        placeholder={t("pages.preferences.keyNamePlaceholder")}
                                        className="w-full px-3 py-2 border rounded-md dark:bg-neutral-900 dark:border-neutral-700"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold">
                                        {t("pages.preferences.expirationDate")}
                                    </label>
                                    <input
                                        type="date"
                                        value={newKeyExpiresAt}
                                        onChange={(e) => setNewKeyExpiresAt(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-md dark:bg-neutral-900 dark:border-neutral-700"
                                    />
                                </div>

                                <div className="flex gap-2">
                                    <Button className="flex-1" onClick={handleCreateAPIKey}>
                                        {t("pages.preferences.createKey")}
                                    </Button>
                                    <Button variant="outline" onClick={() => setShowCreationDialog(false)}>
                                        {t("actions.cancel")}
                                    </Button>
                                </div>
                            </div>
                        )}
            </Modal>

            {/* Create User Dialog */}
            <Modal
                open={showUserDialog}
                onOpenChange={setShowUserDialog}
                title={t("pages.preferences.createUser")}
                nested
            >
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold">{t("pages.preferences.userName")}</label>
                                <input
                                    type="text"
                                    value={userFormData.name}
                                    onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                                    placeholder={t("form.username")}
                                    className="w-full px-3 py-2 border rounded-md dark:bg-neutral-900 dark:border-neutral-700"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold">{t("pages.preferences.userEmail")}</label>
                                <input
                                    type="email"
                                    value={userFormData.email}
                                    onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                                    placeholder={t("form.email")}
                                    className="w-full px-3 py-2 border rounded-md dark:bg-neutral-900 dark:border-neutral-700"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold">{t("form.password")}</label>
                                <input
                                    type="password"
                                    value={userFormData.password}
                                    onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                                    placeholder={t("form.password")}
                                    className="w-full px-3 py-2 border rounded-md dark:bg-neutral-900 dark:border-neutral-700"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold">{t("form.comfirmPassword")}</label>
                                <input
                                    type="password"
                                    value={userFormData.confirmPassword}
                                    onChange={(e) => setUserFormData({ ...userFormData, confirmPassword: e.target.value })}
                                    placeholder={t("form.comfirmPassword")}
                                    className="w-full px-3 py-2 border rounded-md dark:bg-neutral-900 dark:border-neutral-700"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold">{t("pages.preferences.userRole")}</label>
                                <Select
                                    value={userFormData.role}
                                    onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value })}
                                >
                                    <option value="user">{t("pages.preferences.roleUser")}</option>
                                    <option value="admin">{t("pages.preferences.roleAdmin")}</option>
                                </Select>
                            </div>

                            <div className="flex gap-2">
                                <Button className="flex-1" onClick={handleCreateUser}>
                                    {t("actions.create")}
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setShowUserDialog(false)
                                        setUserFormData({ name: "", email: "", password: "", confirmPassword: "", role: "user" })
                                    }}
                                >
                                    {t("actions.cancel")}
                                </Button>
                            </div>
                        </div>
            </Modal>

            {/* Change Password Dialog */}
            <Modal
                open={showPasswordDialog}
                onOpenChange={setShowPasswordDialog}
                title={t("pages.preferences.changePassword")}
                nested
            >
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold">{t("pages.preferences.newPassword")}</label>
                                <input
                                    type="password"
                                    value={passwordFormData.newPassword}
                                    onChange={(e) => setPasswordFormData({ ...passwordFormData, newPassword: e.target.value })}
                                    placeholder={t("pages.preferences.newPassword")}
                                    className="w-full px-3 py-2 border rounded-md dark:bg-neutral-900 dark:border-neutral-700"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold">{t("pages.preferences.confirmNewPassword")}</label>
                                <input
                                    type="password"
                                    value={passwordFormData.confirmPassword}
                                    onChange={(e) => setPasswordFormData({ ...passwordFormData, confirmPassword: e.target.value })}
                                    placeholder={t("pages.preferences.confirmNewPassword")}
                                    className="w-full px-3 py-2 border rounded-md dark:bg-neutral-900 dark:border-neutral-700"
                                />
                            </div>

                            <div className="flex gap-2">
                                <Button className="flex-1" onClick={handleChangePassword}>
                                    {t("actions.save")}
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setShowPasswordDialog(false)
                                        setPasswordFormData({ userId: "", newPassword: "", confirmPassword: "" })
                                    }}
                                >
                                    {t("actions.cancel")}
                                </Button>
                            </div>
                        </div>
            </Modal>
        </>
    )
}

export default UserSettingsModal
