import { Link, useLocation } from "react-router-dom"
import { useCurrentUserStore } from "@/stores/current-user"
import Avatar from "@/components/avatar/Avatar"

/** The signed-in user at the foot of the sidebar; opens account settings. */
const UserMenu = () => {
    const { user } = useCurrentUserStore()
    const { pathname } = useLocation()

    if (!user) return null

    return (
        <Link
            to="/account"
            className={`w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left ${pathname.startsWith("/account") ? "bg-neutral-100 dark:bg-neutral-700" : ""}`}
        >
            <Avatar name={user.name} avatarUrl={user.avatar_url} size={24} />
            <span className="text-sm text-gray-700 dark:text-gray-200 truncate">{user.name}</span>
        </Link>
    )
}

export default UserMenu
