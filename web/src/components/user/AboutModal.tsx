import { useTranslation } from "react-i18next"
import logo from "@/assets/app.svg"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"

interface AboutModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

const AboutModal = ({ open, onOpenChange }: AboutModalProps) => {
    const { t } = useTranslation()

    const appVersion = import.meta.env.VITE_APP_VERSION || "0.0.0"
    const appName = "Notomate"

    return (
        <Modal open={open} onOpenChange={onOpenChange} title={t("menu.about")} className="max-w-[450px]">
            <div className="space-y-3">
                {/* App Logo/Name */}
                <div className="flex items-center gap-3">
                    <img src={logo} className="w-8 h-8" alt="logo" />
                    <div>
                        <div className="text-2xl font-bold text-primary dark:text-primary">
                            {appName}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {t("about.description")}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t("about.version")}
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                        {appVersion}
                    </span>
                </div>
                {/* Close Button */}
                <div className="flex justify-end pt-2">
                    <Button onClick={() => onOpenChange(false)}>
                        {t("common.close")}
                    </Button>
                </div>
            </div>
        </Modal>
    )
}

export default AboutModal
