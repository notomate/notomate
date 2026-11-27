import { Github, Languages, Moon, Sun } from "lucide-react"
import { useTranslation } from "react-i18next"
import { updatePreferences } from "@/api/user"
import { useTheme, type Theme } from "@/providers/Theme"
import { useCurrentUserStore } from "@/stores/current-user"
import { toast } from "@/stores/toast"
import { LANGUAGE_NATIVE_NAMES } from "@/lib/languages"

const appVersion = import.meta.env.VITE_APP_VERSION || "0.0.0"

/**
 * Theme, language and the project link with the app version, above the
 * sidebar footer, for everyone. Theme and language: the browser keeps
 * them (i18next's detector and the theme provider use localStorage), and a
 * signed-in user's account preferences are updated too, as in Settings.
 */
const PreferenceControls = () => {
    const { t, i18n } = useTranslation()
    const { theme, setTheme, primaryColor } = useTheme()!
    const { user } = useCurrentUserStore()
    const languages = (i18n.options.supportedLngs || []).filter((l) => l !== "cimode")

    const save = async (lang: string, nextTheme: Theme) => {
        if (!user) return
        try {
            await updatePreferences({ ...user, preferences: { lang, theme: nextTheme, primaryColor } })
        } catch {
            toast.error(t("messages.settingsUpdateFailed"))
        }
    }

    const changeLanguage = (lang: string) => {
        i18n.changeLanguage(lang)
        save(lang, theme)
    }

    const toggleTheme = () => {
        const next: Theme = theme === "dark" ? "light" : "dark"
        setTheme(next)
        save(i18n.language, next)
    }

    const rowClass = "relative w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm text-left text-muted-foreground transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer"

    return (
        <div className="flex flex-col">
            <button
                type="button"
                onClick={toggleTheme}
                title={t("actions.toggleTheme")}
                className={rowClass}
            >
                {theme === "dark" ? <Moon size={16} className="shrink-0" /> : <Sun size={16} className="shrink-0" />}
                <span className="truncate">{theme === "dark" ? t("pages.preferences.themeDark") : t("pages.preferences.themeLight")}</span>
            </button>
            <label title={t("pages.preferences.language")} className={rowClass}>
                <Languages size={16} className="shrink-0" />
                <span className="truncate">{LANGUAGE_NATIVE_NAMES[i18n.language] ?? i18n.language}</span>
                {/* The native picker sits invisibly over the row: a wheel on phones, a list on desktop. */}
                <select
                    value={i18n.language}
                    onChange={(e) => changeLanguage(e.target.value)}
                    aria-label={t("pages.preferences.language")}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer"
                >
                    {languages.map((lng) => (
                        <option key={lng} value={lng}>{LANGUAGE_NATIVE_NAMES[lng] ?? lng}</option>
                    ))}
                </select>
            </label>
            <a
                href="https://github.com/notomate/notomate"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`GitHub · ${t("about.version")} ${appVersion}`}
                title="GitHub"
                className={rowClass}
            >
                <Github size={16} className="shrink-0" />
                <span className="truncate">{appVersion}</span>
            </a>
        </div>
    )
}

export default PreferenceControls
