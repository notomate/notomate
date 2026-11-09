import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Check, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"

const SERVER_NAME = "notomate"
const COPIED_FEEDBACK_MS = 1500

interface McpClient {
    name: string
    snippet: string
    hint: string
}

const mcpServersJson = (urlKey: string, url: string) =>
    JSON.stringify({ mcpServers: { [SERVER_NAME]: { [urlKey]: url } } }, null, 2)

interface CopyBlockProps {
    id: string
    text: string
    copiedId: string | null
    onCopy: (id: string, text: string) => void
}

const CopyBlock = ({ id, text, copiedId, onCopy }: CopyBlockProps) => {
    const { t } = useTranslation()
    return (
        <div className="flex items-start gap-2">
            <pre className="flex-1 min-w-0 overflow-x-auto px-3 py-2 border rounded-md font-mono text-sm bg-gray-50 dark:bg-neutral-900 dark:border-neutral-700">
                {text}
            </pre>
            <Button size="icon" variant="outline" className="shrink-0" onClick={() => onCopy(id, text)} title={t("actions.copy")}>
                {copiedId === id ? <Check size={16} /> : <Copy size={16} />}
            </Button>
        </div>
    )
}

const McpSettingsTab = () => {
    const { t } = useTranslation()
    const [copiedId, setCopiedId] = useState<string | null>(null)
    const url = `${window.location.origin}/mcp`

    const handleCopy = (id: string, text: string) => {
        navigator.clipboard.writeText(text)
        setCopiedId(id)
        setTimeout(() => setCopiedId((current) => (current === id ? null : current)), COPIED_FEEDBACK_MS)
    }

    const configHint = (path: string) =>
        t("pages.preferences.mcpConfigFileHint", { path, interpolation: { escapeValue: false } })

    const clients: McpClient[] = [
        {
            name: "Claude Code",
            snippet: `claude mcp add --transport http ${SERVER_NAME} ${url}`,
            hint: t("pages.preferences.mcpClaudeCodeHint"),
        },
        {
            name: "Codex CLI",
            snippet: `codex mcp add ${SERVER_NAME} --url ${url}\ncodex mcp login ${SERVER_NAME}`,
            hint: t("pages.preferences.mcpCodexHint"),
        },
        {
            name: "Gemini CLI",
            snippet: `gemini mcp add --transport http ${SERVER_NAME} ${url}`,
            hint: t("pages.preferences.mcpGeminiHint"),
        },
        {
            name: "Cursor",
            snippet: mcpServersJson("url", url),
            hint: configHint("~/.cursor/mcp.json"),
        },
        {
            name: "VS Code",
            snippet: JSON.stringify({ servers: { [SERVER_NAME]: { type: "http", url } } }, null, 2),
            hint: configHint(".vscode/mcp.json"),
        },
        {
            name: "Windsurf",
            snippet: mcpServersJson("serverUrl", url),
            hint: configHint("~/.codeium/windsurf/mcp_config.json"),
        },
    ]

    return (
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("pages.preferences.mcpDescription")}</p>

            <div className="space-y-2">
                <h3 className="text-sm font-semibold">{t("pages.preferences.mcpServerUrl")}</h3>
                <CopyBlock id="url" text={url} copiedId={copiedId} onCopy={handleCopy} />
                <p className="text-sm text-muted-foreground">{t("pages.preferences.mcpClaudeAppHint")}</p>
            </div>

            {clients.map((client) => (
                <div key={client.name} className="space-y-2">
                    <h3 className="text-sm font-semibold">{client.name}</h3>
                    <CopyBlock id={client.name} text={client.snippet} copiedId={copiedId} onCopy={handleCopy} />
                    <p className="text-sm text-muted-foreground break-words">{client.hint}</p>
                </div>
            ))}

            <p className="text-sm text-muted-foreground">{t("pages.preferences.mcpApiKeyHint")}</p>
        </div>
    )
}

export default McpSettingsTab
