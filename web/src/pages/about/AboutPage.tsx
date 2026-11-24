import { useTranslation } from "react-i18next"
import logo from "@/assets/app.svg"
import ProjectInfo from "@/components/ProjectInfo"

const AboutPage = () => {
    const { t } = useTranslation()

    const appVersion = import.meta.env.VITE_APP_VERSION || "0.0.0"
    const appName = "Notomate"

    return (
        <div className="h-full overflow-y-auto">
            <div className="w-full max-w-[640px] p-4 md:p-6">
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <img src={logo} className="w-8 h-8 dark:invert" alt="logo" />
                        <div>
                            <div className="text-2xl font-bold text-primary dark:text-primary">
                                {appName}
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {t("about.description")}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t("about.version")}
                        </span>
                        <span className="text-sm text-muted-foreground font-mono">
                            {appVersion}
                        </span>
                        <ProjectInfo />
                    </div>
                </div>
            </div>
        </div>
    )
}

export default AboutPage
