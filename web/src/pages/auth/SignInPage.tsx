import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { signIn } from '@/api/auth';
import logo from '@/assets/app.svg'
import BrandIcons from '@/components/illustrations/BrandIcons';
import { useTranslation } from 'react-i18next';
import { toast } from '@/stores/toast';
import { useCurrentUserStore } from '@/stores/current-user';
import { useTheme } from '@/providers/Theme';
import i18n from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, EyeOff } from 'lucide-react';

const SignIn: React.FC = () => {
    const { t } = useTranslation();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();
    const { fetchUser } = useCurrentUserStore();
    const { setTheme, setPrimaryColor } = useTheme()!;

    const signInMutation = useMutation({
        mutationFn: signIn,
        onSuccess: async () => {
            const currentUser = await fetchUser();
            if (currentUser?.preferences) {
                if (currentUser.preferences.lang) i18n.changeLanguage(currentUser.preferences.lang);
                if (currentUser.preferences.theme) setTheme(currentUser.preferences.theme);
                if (currentUser.preferences.primaryColor) setPrimaryColor(currentUser.preferences.primaryColor);
            }
            navigate('/');
        },
        onError: (error: any) => {
            const errorMessage = error?.response?.data?.error || '';
            if (errorMessage.toLowerCase().includes('disabled')) {
                toast.error(t("messages.accountDisabled"));
            } else {
                toast.error(t("messages.signInFailed"));
            }
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        signInMutation.mutate({ username, password });
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
            <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
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
                            {t('actions.signin')}
                        </h2>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">
                            {t("pages.signin.noAccount")}{' '}
                            <a href="/signup" className="font-semibold text-primary hover:text-primary-hover transition-colors">
                                {t("actions.signup")}
                            </a>
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="username">{t("form.username")}</Label>
                            <Input
                                id="username"
                                type="text"
                                autoComplete="username"
                                value={username}
                                placeholder={t("form.username")}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">{t("form.password")}</Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="current-password"
                                    value={password}
                                    placeholder="••••••••"
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="!w-4 !h-4" /> : <Eye className="!w-4 !h-4" />}
                                </button>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            size="lg"
                            className="w-full"
                            disabled={signInMutation.isPending}
                        >
                            {signInMutation.isPending && <Loader2 className="!w-4 !h-4 animate-spin" />}
                            {t('actions.signin')}
                        </Button>
                    </form>

                    <div className="text-center">
                        <a
                            href="/explore"
                            className="text-sm text-neutral-400 dark:text-neutral-500 hover:text-primary transition-colors"
                        >
                            {t("pages.signin.continueAsGuest")} →
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SignIn;
