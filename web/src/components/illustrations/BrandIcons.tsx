import React from "react";
import { FileText, CheckCircle2, Zap, Clock } from "lucide-react";

interface Props {
    className?: string;
}

const badgeClass = "absolute -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 shadow-sm flex items-center justify-center";

/**
 * Four small workflow-themed icon badges (note, checklist, automation,
 * schedule) arranged around the branding panel's logo.
 */
const BrandIcons: React.FC<Props> = ({ className }) => (
    <div className={className}>
        <div className="relative w-full h-full">
            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" aria-hidden="true">
                <circle
                    cx="50"
                    cy="50"
                    r="37.5"
                    fill="none"
                    strokeWidth="0.5"
                    strokeDasharray="1.5 3"
                    className="stroke-neutral-300 dark:stroke-neutral-700"
                />
            </svg>
            <div className={badgeClass} style={{ left: "23.5%", top: "23.5%" }}>
                <FileText className="!w-7 !h-7 text-neutral-400 dark:text-neutral-600" />
            </div>
            <div className={badgeClass} style={{ left: "76.5%", top: "23.5%" }}>
                <CheckCircle2 className="!w-7 !h-7 text-primary" />
            </div>
            <div className={badgeClass} style={{ left: "76.5%", top: "76.5%" }}>
                <Zap className="!w-7 !h-7 text-primary" />
            </div>
            <div className={badgeClass} style={{ left: "23.5%", top: "76.5%" }}>
                <Clock className="!w-7 !h-7 text-neutral-400 dark:text-neutral-600" />
            </div>
        </div>
    </div>
);

export default BrandIcons;
