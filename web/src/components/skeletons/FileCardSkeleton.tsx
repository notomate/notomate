import { FC } from "react"
import { Skeleton } from "@/components/ui/skeleton"

const FileCardSkeleton: FC = () => {
    return (
        <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden bg-white dark:bg-neutral-800">
            {/* Thumbnail/Icon Area */}
            <div className="aspect-square relative bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center">
                <Skeleton className="w-16 h-16" />
            </div>

            {/* File Info */}
            <div className="p-2.5">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2" />
            </div>
        </div>
    )
}

export default FileCardSkeleton
