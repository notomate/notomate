import { FC } from "react"
import { Loader, CircleCheck, CircleX, CircleSlash, Clock } from "lucide-react"
import { WorkflowRunData } from "@/api/workflow"

const styles: Record<WorkflowRunData['status'], string> = {
    queued: "text-amber-600 dark:text-amber-400",
    running: "text-blue-600 dark:text-blue-400",
    success: "text-green-600 dark:text-green-400",
    failure: "text-red-600 dark:text-red-400",
    cancelled: "text-gray-500 dark:text-gray-400",
}

const StatusBadge: FC<{ status: WorkflowRunData['status'] }> = ({ status }) => {
    const icon = (() => {
        switch (status) {
            case 'queued': return <Clock size={14} />
            case 'running': return <Loader size={14} className="animate-spin" />
            case 'success': return <CircleCheck size={14} />
            case 'failure': return <CircleX size={14} />
            case 'cancelled': return <CircleSlash size={14} />
        }
    })()

    return (
        <span className={`inline-flex items-center gap-1.5 text-sm ${styles[status]}`}>
            {icon}
            {status}
        </span>
    )
}

export default StatusBadge
