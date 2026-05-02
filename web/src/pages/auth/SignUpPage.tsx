import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { signUp } from '@/api/auth';
import logo from '@/assets/app.svg'
import { useTranslation } from 'react-i18next';
import { toast } from '@/stores/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';

const SignUp: React.FC = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  const signUpMutation = useMutation({
    mutationFn: signUp,
    onSuccess: () => {
      navigate('/signin');
    },
    onError: (error: any) => {
      console.error('Sign up failed:', error);
      toast.error(t("messages.signUpFailed", { error: error }));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error(t("messages.passwordDoNotMatch"));
      return;
    }
    signUpMutation.mutate({ username, email, password });
  };

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <div className="min-h-dvh flex bg-neutral-50 dark:bg-neutral-950">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-transparent dark:from-primary/20 dark:via-primary/10 dark:to-transparent items-center justify-center p-12">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent" />
        <div className="relative z-10 flex flex-col items-center gap-8 text-center max-w-md">
          <img src={logo} className="w-24 h-24 object-contain drop-shadow-lg" alt="Collabreef" />
          <div className="space-y-3">
            <h1 className="text-4xl font-bold text-neutral-900 dark:text-white tracking-tight">Collabreef</h1>
            <p className="text-lg text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Free and open-source. Self-host your own collaborative workspace.
            </p>
          </div>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            {['Free to get started', 'Sync across devices', 'Collaborate in real-time'].map((feature) => (
              <div key={feature} className="flex items-center gap-3 bg-white/60 dark:bg-white/5 rounded-xl px-4 py-3 backdrop-blur-sm border border-white/20 dark:border-white/10">
                <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                <span className="text-sm text-neutral-700 dark:text-neutral-300 font-medium">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile logo */}
          <div className="flex flex-col items-center gap-3 lg:hidden">
            <img src={logo} className="w-16 h-16 object-contain" alt="Collabreef" />
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Collabreef</h1>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">
              {t("actions.signup")}
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {t("pages.signup.alreadyHaveAccount")}{' '}
              <a href="/signin" className="font-semibold text-primary hover:text-primary-hover transition-colors">
                {t("actions.signin")}
              </a>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("form.email")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                placeholder="you@example.com"
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

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
                  autoComplete="new-password"
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

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t("form.comfirmPassword")}</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  placeholder="••••••••"
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className={`pr-10 ${passwordsMismatch ? 'border-red-400 focus:border-red-400 focus:ring-red-400/50' : ''} ${passwordsMatch ? 'border-green-400 focus:border-green-400 focus:ring-green-400/50' : ''}`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {confirmPassword.length > 0 && (
                    passwordsMatch
                      ? <CheckCircle2 className="!w-4 !h-4 text-green-500" />
                      : <XCircle className="!w-4 !h-4 text-red-400" />
                  )}
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="!w-4 !h-4" /> : <Eye className="!w-4 !h-4" />}
                  </button>
                </div>
              </div>
              {passwordsMismatch && (
                <p className="text-xs text-red-400">{t("messages.passwordDoNotMatch")}</p>
              )}
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full mt-2"
              disabled={signUpMutation.isPending}
            >
              {signUpMutation.isPending && <Loader2 className="!w-4 !h-4 animate-spin" />}
              {t("actions.signup")}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
