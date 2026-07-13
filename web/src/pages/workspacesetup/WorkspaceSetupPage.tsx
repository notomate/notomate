import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { createWorkspace } from "@/api/workspace";
import { signOut } from "@/api/auth";
import logo from "@/assets/app.svg";
import BrandIcons from "@/components/illustrations/BrandIcons";
import { useTranslation } from "react-i18next";
import { toast } from "@/stores/toast";
import { useWorkspaceStore } from "@/stores/workspace";
import { useCurrentUserStore } from "@/stores/current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, LogOut } from "lucide-react";

const WorkspaceSetupPage: React.FC = () => {
    const [workspaceName, setWorkspaceName] = useState("");
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { resetWorkspaces } = useWorkspaceStore();
    const { user, resetCurrentUser } = useCurrentUserStore();

    const createWorkspaceMutation = useMutation({
        mutationFn: () => createWorkspace({ name: workspaceName }),
        onSuccess: () => {
            resetWorkspaces();
            navigate("/");
        },
        onError: () => {
            toast.error(t("messages.networkError"));
        },
    });

    const signOutMutation = useMutation({
        mutationFn: () => signOut(),
        onSuccess: () => {
            resetWorkspaces();
            resetCurrentUser();
            navigate("/signin");
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!workspaceName.trim()) return;
        createWorkspaceMutation.mutate();
    };

    return (
        <div className="min-h-dvh flex bg-neutral-50 dark:bg-neutral-950">
            {/* Left branding panel */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-transparent dark:from-primary/20 dark:via-primary/10 dark:to-transparent items-center justify-center p-12">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent" />
                <div className="absolute inset-0 flex items-center justify-center">
                    <BrandIcons className="w-[85%] max-w-xl aspect-square" />
                </div>
                <div className="relative z-10 flex flex-col items-center gap-6 text-center max-w-md">
                    <div className="w-24 h-24 rounded-3xl bg-white shadow-lg ring-1 ring-black/5 flex items-center justify-center p-4">
                        <img src={logo} className="w-full h-full object-contain" alt="Notomate" />
                    </div>
                    <h1 className="text-4xl font-bold text-neutral-900 dark:text-white tracking-tight">Notomate</h1>
                </div>
            </div>

            {/* Right form panel */}
            <div className="flex-1 flex flex-col p-6 sm:p-12">
                <div className="flex justify-end">
                    {user && (
                        <button
                            type="button"
                            onClick={() => signOutMutation.mutate()}
                            disabled={signOutMutation.isPending}
                            className="inline-flex items-center gap-1.5 text-sm text-neutral-400 dark:text-neutral-500 hover:text-primary transition-colors disabled:opacity-50"
                        >
                            {signOutMutation.isPending
                                ? <Loader2 className="!w-4 !h-4 animate-spin" />
                                : <LogOut className="!w-4 !h-4" />}
                            {user.name ?? user.email}
                        </button>
                    )}
                </div>

                <div className="grow flex items-center justify-center">
                    <div className="w-full max-w-sm space-y-8">
                        {/* Mobile logo */}
                        <div className="flex flex-col items-center gap-3 lg:hidden">
                            <div className="w-16 h-16 rounded-2xl bg-white shadow-md ring-1 ring-black/5 flex items-center justify-center p-2.5">
                                <img src={logo} className="w-full h-full object-contain" alt="Notomate" />
                            </div>
                            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Notomate</h1>
                        </div>

                        <div className="space-y-2">
                            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">
                                {t("pages.workspaceSetup.createYourFirstWorkspace")}
                            </h2>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400">
                                {t("pages.workspaceSetup.pleaseEnterYourWorkspaceName")}
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="space-y-2">
                                <Label htmlFor="workspace-name">{t("pages.workspaceSetup.workspaceName")}</Label>
                                <Input
                                    id="workspace-name"
                                    type="text"
                                    autoComplete="off"
                                    autoFocus
                                    value={workspaceName}
                                    placeholder={t("pages.workspaceSetup.workspaceNamePlaceholder")}
                                    onChange={(e) => setWorkspaceName(e.target.value)}
                                    required
                                />
                            </div>

                            <Button
                                type="submit"
                                size="lg"
                                className="w-full"
                                disabled={!workspaceName.trim() || createWorkspaceMutation.isPending}
                            >
                                {createWorkspaceMutation.isPending && <Loader2 className="!w-4 !h-4 animate-spin" />}
                                {t("actions.create")}
                            </Button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WorkspaceSetupPage;
