import { FC } from "react"
import { Skeleton } from "@/components/ui/skeleton"

interface FilesListSkeletonProps {
    count?: number
}

const FilesListSkeleton: FC<FilesListSkeletonProps> = ({ count = 8 }) => {
    return (
        <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {Array.from({ length: count }).map((_, idx) => (
                <div key={idx} className="flex items-center gap-3 px-3 py-2">
                    <Skeleton className="h-8 w-8 shrink-0" />
                    <Skeleton className="h-4 flex-1 max-w-64" />
                    <Skeleton className="hidden sm:block h-4 w-16 ml-auto" />
                </div>
            ))}
        </div>
    )
}

export default FilesListSkeleton
