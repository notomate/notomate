import { FC } from "react"
import { User as UserIcon } from "lucide-react"

interface AvatarProps {
    name?: string
    avatarUrl?: string
    size?: number
    className?: string
}

const Avatar: FC<AvatarProps> = ({ name, avatarUrl, size = 24, className = "" }) => {
    if (avatarUrl) {
        return (
            <img
                src={avatarUrl}
                alt={name || "avatar"}
                style={{ width: size, height: size }}
                className={`rounded-full object-cover shrink-0 ${className}`}
            />
        )
    }

    return (
        <div
            style={{ width: size, height: size, fontSize: size * 0.45 }}
            className={`rounded-full bg-blue-500 text-white font-semibold flex items-center justify-center shrink-0 ${className}`}
        >
            {name ? name.charAt(0).toUpperCase() : <UserIcon size={size * 0.6} />}
        </div>
    )
}

export default Avatar
