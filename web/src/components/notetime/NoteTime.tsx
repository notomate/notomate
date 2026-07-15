import { FC } from "react"
import { useRelativeTime } from "@/hooks/use-relative-time"

interface Props {
    time: string
}

const NoteTime:FC<Props> = (props:Props)=>{
    const time = useRelativeTime(props.time)

    return <span className="text-sm">
        {time}
    </span>
}

export default NoteTime