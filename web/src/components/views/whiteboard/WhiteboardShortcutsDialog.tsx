import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/modal';
import { Tool, TOOL_SHORTCUTS, TOOL_NUMBERS } from './tools/types';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const TOOL_ORDER: Tool[] = ['hand', 'select', 'rectangle', 'circle', 'edge', 'line', 'pen', 'text', 'note', 'eraser'];

const Keys = ({ keys }: { keys: string[] }) => (
    <span className="flex shrink-0 items-center gap-1">
        {keys.map((k, i) => (
            <span key={i} className="flex items-center gap-1">
                {i > 0 && <span className="text-[10px] text-neutral-400">/</span>}
                <kbd className="min-w-[1.5rem] rounded-md border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-center font-sans text-xs text-neutral-700 shadow-[0_1px_0_rgba(0,0,0,0.06)] dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-200">
                    {k}
                </kbd>
            </span>
        ))}
    </span>
);

const Row = ({ label, keys }: { label: string; keys: string[] }) => (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
        <span className="text-neutral-700 dark:text-neutral-200">{label}</span>
        <Keys keys={keys} />
    </div>
);

const WhiteboardShortcutsDialog = ({ open, onOpenChange }: Props) => {
    const { t } = useTranslation();

    return (
        <Modal open={open} onOpenChange={onOpenChange} title={t('whiteboard.shortcuts')} showClose className="max-w-[640px]">
            <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                <section>
                    <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('whiteboard.tools')}</h3>
                    <div className="divide-y divide-neutral-100 dark:divide-neutral-700">
                        {TOOL_ORDER.map((tool) => (
                            <Row
                                key={tool}
                                label={t(`whiteboard.${tool}`)}
                                keys={[TOOL_SHORTCUTS[tool], TOOL_NUMBERS[tool]].filter((k): k is string => !!k)}
                            />
                        ))}
                    </div>
                </section>
                <section>
                    <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('whiteboard.view')}</h3>
                    <div className="divide-y divide-neutral-100 dark:divide-neutral-700">
                        <Row label={t('whiteboard.panCanvas')} keys={[t('whiteboard.spaceDrag')]} />
                        <Row label={t('whiteboard.zoomIn')} keys={['Ctrl +']} />
                        <Row label={t('whiteboard.zoomOut')} keys={['Ctrl −']} />
                        <Row label={t('whiteboard.resetZoom')} keys={['Ctrl 0']} />
                        <Row label={t('whiteboard.fitToScreen')} keys={['Shift 1']} />
                    </div>
                    <h3 className="mb-1 mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('whiteboard.editor')}</h3>
                    <div className="divide-y divide-neutral-100 dark:divide-neutral-700">
                        <Row label={t('whiteboard.undo')} keys={['Ctrl Z']} />
                        <Row label={t('whiteboard.redo')} keys={['Ctrl Shift Z', 'Ctrl Y']} />
                        <Row label={t('whiteboard.addToSelection')} keys={['Shift + Click']} />
                        <Row label={t('whiteboard.delete')} keys={['Delete', 'Backspace']} />
                        <Row label={t('whiteboard.deselect')} keys={['Esc']} />
                        <Row label={t('whiteboard.shortcuts')} keys={['?']} />
                    </div>
                </section>
            </div>
        </Modal>
    );
};

export default WhiteboardShortcutsDialog;
