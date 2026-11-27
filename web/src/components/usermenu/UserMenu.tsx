import { Link } from "react-router-dom"
import { LogIn, LogOut } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useCurrentUserStore } from "@/stores/current-user"
import Avatar from "@/components/avatar/Avatar"
import useSignOut from "@/hooks/use-sign-out"

const buttonClass = "w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm text-left transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700"

/** Foot of the sidebar: Sign out with the signed-in user's avatar, or Sign in. */
const UserMenu = () => {
    const { t } = useTranslation()
    const { user } = useCurrentUserStore()
    const signOut = useSignOut()

    if (!user) {
        return (
            <Link to="/signin" className={`${buttonClass} text-gray-700 dark:text-gray-200`}>
                <LogIn size={16} className="shrink-0" />
                {t("actions.signin")}
            </Link>
        )
    }

    return (
        <div className="flex items-center justify-between gap-1">
            <button
                onClick={() => signOut.mutate()}
                disabled={signOut.isPending}
                title={t("actions.signout")}
                className="shrink-0 flex items-center gap-1.5 px-2 py-2 rounded-md text-sm text-muted-foreground transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50"
            >
                <LogOut size={16} />
                {t("actions.signout")}
            </button>
            <div className="shrink-0 px-2 py-2 select-none" title={user.name}>
                <Avatar name={user.name} avatarUrl={user.avatar_url} size={24} />
            </div>
        </div>
    )
}

export default UserMenu
