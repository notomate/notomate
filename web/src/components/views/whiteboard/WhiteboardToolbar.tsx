import { Fragment } from 'react';
import { Pen, Square, Circle, Minus, Type, StickyNote, MousePointer2, Eraser, Hand, MoveUpRight, Lock, LockOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Tooltip from '@/components/tooltip/Tooltip';
import { Tool, TOOL_SHORTCUTS, TOOL_NUMBERS } from './tools/types';
import { ISLAND, ISLAND_BTN, ISLAND_BTN_ACTIVE } from './ui';

export type { Tool } from './tools/types';

interface WhiteboardToolbarProps {
    currentTool: Tool;
    setCurrentTool: (tool: Tool) => void;
    isLocked: boolean;
    onToggleLock: () => void;
}

type ToolDef = { id: Tool; icon: React.ReactNode; label: string };

const ICON = { size: 17, strokeWidth: 1.75 };

const WhiteboardToolbar = ({
    currentTool,
    setCurrentTool,
    isLocked,
    onToggleLock,
}: WhiteboardToolbarProps) => {
    const { t } = useTranslation();

    const groups: ToolDef[][] = [
        [
            { id: 'hand', icon: <Hand {...ICON} />, label: t('whiteboard.hand') },
            { id: 'select', icon: <MousePointer2 {...ICON} />, label: t('whiteboard.select') },
        ],
        [
            { id: 'rectangle', icon: <Square {...ICON} />, label: t('whiteboard.rectangle') },
            { id: 'circle', icon: <Circle {...ICON} />, label: t('whiteboard.circle') },
            { id: 'edge', icon: <MoveUpRight {...ICON} />, label: t('whiteboard.edge') },
            { id: 'line', icon: <Minus {...ICON} />, label: t('whiteboard.line') },
            { id: 'pen', icon: <Pen {...ICON} />, label: t('whiteboard.pen') },
            { id: 'text', icon: <Type {...ICON} />, label: t('whiteboard.text') },
            { id: 'note', icon: <StickyNote {...ICON} />, label: t('whiteboard.note') },
            { id: 'eraser', icon: <Eraser {...ICON} />, label: t('whiteboard.eraser') },
        ],
    ];

    const tooltipFor = (tool: Tool, label: string) => {
        const keys = [TOOL_SHORTCUTS[tool], TOOL_NUMBERS[tool]].filter(Boolean).join(' / ');
        return keys ? `${label} — ${keys}` : label;
    };

    const lockLabel = isLocked ? t('whiteboard.unlock') : t('whiteboard.lock');

    return (
        <div
            className={`${ISLAND} absolute left-1/2 z-50 -translate-x-1/2 bottom-3 sm:bottom-auto sm:top-3 max-w-[calc(100%-1.5rem)] overflow-x-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
            role="toolbar"
            aria-label={t('whiteboard.tools')}
        >
            <div className="flex items-center gap-0.5">
                <Tooltip text={lockLabel} side="bottom">
                    <button
                        type="button"
                        onClick={onToggleLock}
                        aria-label={lockLabel}
                        aria-pressed={isLocked}
                        className={`${ISLAND_BTN} ${isLocked ? ISLAND_BTN_ACTIVE : ''}`}
                    >
                        {isLocked ? <Lock {...ICON} /> : <LockOpen {...ICON} />}
                    </button>
                </Tooltip>

                {groups.map((group, gi) => (
                    <Fragment key={gi}>
                        <div className="mx-1 h-5 w-px shrink-0 bg-neutral-200 dark:bg-neutral-700" />
                        {group.map((tool) => {
                            const active = isLocked ? tool.id === 'hand' : currentTool === tool.id;
                            const num = TOOL_NUMBERS[tool.id];
                            return (
                                <Tooltip key={tool.id} text={tooltipFor(tool.id, tool.label)} side="bottom">
                                    <button
                                        type="button"
                                        onClick={() => setCurrentTool(tool.id)}
                                        disabled={isLocked && tool.id !== 'hand'}
                                        aria-label={tool.label}
                                        aria-pressed={active}
                                        className={`${ISLAND_BTN} relative ${active ? ISLAND_BTN_ACTIVE : ''}`}
                                    >
                                        {tool.icon}
                                        {num && (
                                            <span className="pointer-events-none absolute bottom-[3px] right-[4px] hidden text-[9px] leading-none text-neutral-400 sm:block dark:text-neutral-500">
                                                {num}
                                            </span>
                                        )}
                                    </button>
                                </Tooltip>
                            );
                        })}
                    </Fragment>
                ))}
            </div>
        </div>
    );
};

export default WhiteboardToolbar;
