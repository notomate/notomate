import { Dialog } from "radix-ui"
import { useTranslation } from "react-i18next"
import logo from "@/assets/app.svg"

interface AboutModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

const AboutModal = ({ open, onOpenChange }: AboutModalProps) => {
    const { t } = useTranslation()

    const appVersion = import.meta.env.VITE_APP_VERSION || "0.0.0"
    const appName = "Collabreef"

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 z-[1000]" />
                <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-neutral-800 rounded-lg shadow-xl p-6 w-[90vw] max-w-[450px] z-[1001]">
                    <Dialog.Title className="text-xl font-semibold mb-4">
                        {t("menu.about")}
                    </Dialog.Title>

                    <div className="">
                        {/* App Logo/Name */}
                        <div className=" space-y-3">
                            <div className="flex items-center gap-3">
                                <div>
                                    <img src={logo} className="w-8 h-8" alt="logo" />
                                </div>
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
                        </div>
                        {/* Close Button */}
                        <div className="flex justify-end pt-2">
                            <button
                                onClick={() => onOpenChange(false)}
                                className="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary-hover transition-colors"
                            >
                                {t("common.close")}
                            </button>
                        </div>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}

export default AboutModal
