import { FC, ReactNode } from "react"
import { Tooltip as TP } from "radix-ui"

interface Props {
    children: ReactNode
    text: string
    side: "right" | "top" | "bottom" | "left"
    enabled?: boolean
}

const Tooltip:FC<Props> = ({children, text, side, enabled = true}) => {
    return <TP.Root>
        <TP.Trigger asChild>
            {children}
        </TP.Trigger>
        {
            enabled &&
            <TP.Portal>
                <TP.Content
                    className="z-tooltip select-none rounded-lg bg-gray-900 text-white dark:bg-gray-100 dark:text-black px-2 py-1 text-sm"
                    side={side}
                    sideOffset={5}
                >
                    <TP.Arrow className="fill-gray-900 dark:fill-gray-100" />
                    {text}
                </TP.Content>
            </TP.Portal>
        }
    </TP.Root>
}

export default Tooltip