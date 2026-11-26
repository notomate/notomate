import { useTranslation } from "react-i18next"
import { User as UserIcon, Palette, KeyRound, Plug, Users, Server, type LucideIcon } from "lucide-react"
import { useCurrentUserStore } from "@/stores/current-user"

export type SettingsTab = 'account' | 'preferences' | 'apiKeys' | 'mcp' | 'users' | 'system'

export const SETTINGS_TABS: SettingsTab[] = ['account', 'preferences', 'apiKeys', 'mcp', 'users', 'system']
export const OWNER_TABS: SettingsTab[] = ['users', 'system']

export interface SettingsSection {
    value: SettingsTab
    label: string
    icon: LucideIcon
}

/** The account settings sections the current user can open, in display order. */
export const useSettingsSections = (): SettingsSection[] => {
    const { t } = useTranslation()
    const { user } = useCurrentUserStore()
    const isOwner = user?.role === 'owner'

    return [
        { value: "account", label: t("menu.user"), icon: UserIcon },
        { value: "preferences", label: `${t("pages.preferences.language")} & ${t("pages.preferences.theme")}`, icon: Palette },
        { value: "apiKeys", label: t("pages.preferences.apiKeys"), icon: KeyRound },
        { value: "mcp", label: "MCP", icon: Plug },
        ...(isOwner
            ? [
                { value: "users" as const, label: t("pages.preferences.userManagement"), icon: Users },
                { value: "system" as const, label: t("pages.preferences.systemSettings"), icon: Server },
            ]
            : []),
    ]
}
