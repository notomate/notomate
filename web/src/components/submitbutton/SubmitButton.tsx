import { FC, ReactNode } from "react";

interface Props {
    disabled: boolean
    children: ReactNode
}

const SubmitButton: FC<Props> = (props: Props) => {
    return <button
        className="w-full focus:ring-2 focus:ring-primary bg-primary hover:bg-primary-hover text-primary-foreground font-bold py-2 px-4 rounded-xl focus:outline-none focus:shadow-outline disabled:bg-neutral-200 dark:disabled:bg-neutral-800 disabled:text-disabled disabled:opacity-100 disabled:pointer-events-none"
        type="submit"
        disabled={props.disabled}
    >
        {props.children}
    </button>
}

export default SubmitButton