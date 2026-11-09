import React, { useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import logo from '@/assets/app.svg';
import { decideAuthorization, getAuthorizeInfo, OAuthScope } from '@/api/oauth';
import { Button } from '@/components/ui/button';
import { useCurrentUserStore } from '@/stores/current-user';

/**
 * Consent screen of the OAuth flow behind the MCP endpoint. It is a page rather
 * than a server-rendered form because the session cookie is SameSite=Strict:
 * it is absent on the redirect from the client, but sent on this page's requests.
 */
const OAuthAuthorize: React.FC = () => {
    const { t } = useTranslation();
    const { search, pathname } = useLocation();
    const { user } = useCurrentUserStore();
    const query = search.replace(/^\?/, '');
    const params = useMemo(() => Object.fromEntries(new URLSearchParams(search)), [search]);
    const [scope, setScope] = useState<OAuthScope>('mcp:read');

    const info = useQuery({
        queryKey: ['oauth-authorize', query],
        queryFn: () => getAuthorizeInfo(query),
        enabled: !!user,
        retry: false,
    });

    const decide = useMutation({
        mutationFn: (approved: boolean) =>
            decideAuthorization(params, approved ? { approved, granted_scope: scope } : { approved }),
        onSuccess: (redirectTo) => window.location.assign(redirectTo),
    });

    if (!user) {
        return <Navigate to={`/signin?next=${encodeURIComponent(pathname + search)}`} replace />;
    }

    const options: { value: OAuthScope; label: string; description: string }[] = [
        { value: 'mcp:read', label: t('pages.oauth.readLabel'), description: t('pages.oauth.readDescription') },
        { value: 'mcp:write', label: t('pages.oauth.writeLabel'), description: t('pages.oauth.writeDescription') },
    ];
    const available = options.filter((o) => o.value === 'mcp:read' || info.data?.max_scope === 'mcp:write');

    return (
        <div className="min-h-dvh flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 p-4 sm:p-6">
            <div className="w-full max-w-md space-y-6 rounded-2xl bg-white dark:bg-neutral-900 p-6 sm:p-8 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
                <img src={logo} className="w-10 h-10 object-contain dark:invert" alt="Notomate" />

                {info.isLoading && (
                    <div className="flex justify-center py-8">
                        <Loader2 className="animate-spin text-muted-foreground" />
                    </div>
                )}

                {info.isError && <p className="text-sm">{t('pages.oauth.invalidRequest')}</p>}

                {info.data && (
                    <>
                        <div className="space-y-2">
                            <h1 className="text-xl font-bold text-neutral-900 dark:text-white break-words">
                                {t('pages.oauth.title', { client: info.data.client_name, interpolation: { escapeValue: false } })}
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                {t('pages.oauth.signedInAs', { name: user.name, interpolation: { escapeValue: false } })}
                            </p>
                        </div>

                        <div className="space-y-2">
                            {available.map((option) => (
                                <label
                                    key={option.value}
                                    className="flex items-start gap-3 rounded-lg border border-gray-200 dark:border-neutral-700 p-3 cursor-pointer"
                                >
                                    <input
                                        type="radio"
                                        name="scope"
                                        className="mt-1"
                                        checked={scope === option.value}
                                        onChange={() => setScope(option.value)}
                                    />
                                    <span>
                                        <span className="block text-sm font-semibold">{option.label}</span>
                                        <span className="block text-sm text-muted-foreground">{option.description}</span>
                                    </span>
                                </label>
                            ))}
                        </div>

                        <p className="text-sm text-muted-foreground break-words">
                            {t('pages.oauth.warning')}{' '}
                            {t('pages.oauth.redirectNotice', { host: info.data.redirect_host, interpolation: { escapeValue: false } })}
                        </p>

                        {decide.isError && <p className="text-sm text-red-500">{t('pages.oauth.invalidRequest')}</p>}

                        <div className="flex gap-2">
                            <Button className="flex-1" disabled={decide.isPending} onClick={() => decide.mutate(true)}>
                                {decide.isPending && <Loader2 className="!w-4 !h-4 animate-spin" />}
                                {t('pages.oauth.allow')}
                            </Button>
                            <Button variant="outline" className="flex-1" disabled={decide.isPending} onClick={() => decide.mutate(false)}>
                                {t('pages.oauth.deny')}
                            </Button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default OAuthAuthorize;
