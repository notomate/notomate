import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "@tanstack/react-query"
import { CircleHelp } from "lucide-react"
import ShikiHighlighter from "react-shiki"
import { getRunners } from "@/api/runner"

// Read-only view of instance runners for the workspace settings page: shows
// which runners are currently online so members know what labels are
// available to target from a workflow's `runs-on:` field.
const ConnectedRunnersSection = () => {
    const { t } = useTranslation()
    const [showExample, setShowExample] = useState(false)

    const { data: runners = [] } = useQuery({
        queryKey: ['runners'],
        queryFn: getRunners,
    })

    const onlineRunners = runners.filter(runner => runner.status === 'online')
    const exampleLabel = onlineRunners.flatMap(runner => runner.labels)[0] || "ubuntu-latest"

    const yamlExample = `jobs:\n  my-job:\n    runs-on: ${exampleLabel}\n    steps:\n      - name: Say hello\n        run: echo "hello"`

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
                <div className="text-lg font-semibold">{t("pages.settings.connectedRunners")}</div>
                <button
                    onClick={() => setShowExample(s => !s)}
                    title={t("pages.settings.runsOnExample")}
                    aria-label={t("pages.settings.runsOnExample")}
                    className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                >
                    <CircleHelp size={16} />
                </button>
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-500 -mt-2">
                {t("pages.settings.connectedRunnersHint")}
            </div>

            {showExample && (
                <ShikiHighlighter language="yaml" theme="ayu-dark" showLineNumbers={false}>
                    {yamlExample}
                </ShikiHighlighter>
            )}

            {onlineRunners.length === 0 ? (
                <div className="text-sm text-gray-400 dark:text-gray-500">
                    {t("pages.settings.noConnectedRunners")}
                </div>
            ) : (
                <div className="flex flex-col divide-y divide-neutral-100 dark:divide-neutral-700">
                    {onlineRunners.map(runner => (
                        <div key={runner.id} className="flex items-center gap-3 py-3">
                            <span className="shrink-0 inline-block w-2 h-2 rounded-full bg-green-500" title={runner.status} />
                            <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{runner.name}</div>
                                <div className="text-xs text-gray-400 dark:text-gray-500 truncate">
                                    {runner.labels.join(", ")}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default ConnectedRunnersSection
