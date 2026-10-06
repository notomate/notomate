import { Github } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export default function ProjectInfo({ showVersion = false, showLabel = false }: { showVersion?: boolean; showLabel?: boolean }) {
    const { t } = useTranslation();

    return (
        <div className={cn(
            'flex items-center justify-center gap-3 whitespace-nowrap py-2 text-xs text-muted-foreground',
            showLabel && 'w-full justify-start py-0 text-sm text-inherit',
        )}>
            <a
                href="https://github.com/notomate/notomate"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                title="GitHub"
                className={cn(
                    'inline-flex items-center gap-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    showLabel
                        ? 'w-full px-3 py-2.5 text-left rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800'
                        : 'rounded-sm hover:text-primary',
                )}
            >
                <Github className="size-4" aria-hidden="true" />
                {showLabel && 'GitHub'}
            </a>
            {showVersion && (
                <span aria-label={`${t('about.version')} ${import.meta.env.VITE_APP_VERSION || '0.0.0'}`}>
                    {import.meta.env.VITE_APP_VERSION || '0.0.0'}
                </span>
            )}
        </div>
    );
}
