import { Pen, Square, Circle, Minus, Type, FileText, Hand, Eraser, Trash2, SquareDashedMousePointer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tool } from './tools/types';

export type { Tool } from './tools/types';

interface WhiteboardToolbarProps {
    currentTool: Tool;
    setCurrentTool: (tool: Tool) => void;
    isPublic?: boolean;
    onClear?: () => void;
}

const WhiteboardToolbar = ({
    currentTool,
    setCurrentTool,
    isPublic = false,
    onClear
}: WhiteboardToolbarProps) => {
    const { t } = useTranslation();

    const tools: { id: Tool; icon: React.ReactNode; label: string }[] = [
        { id: 'select', icon: <Hand size={18} />, label: t('whiteboard.select') || 'Select' },
        { id: 'marquee', icon: <SquareDashedMousePointer size={18} />, label: t('whiteboard.marquee') || 'Marquee Select' },
        { id: 'pen', icon: <Pen size={18} />, label: t('whiteboard.pen') || 'Pen' },
        { id: 'eraser', icon: <Eraser size={18} />, label: t('whiteboard.eraser') || 'Eraser' },
        { id: 'rectangle', icon: <Square size={18} />, label: t('whiteboard.rectangle') || 'Rectangle' },
        { id: 'circle', icon: <Circle size={18} />, label: t('whiteboard.circle') || 'Circle' },
        { id: 'line', icon: <Minus size={18} />, label: t('whiteboard.line') || 'Line' },
        { id: 'text', icon: <Type size={18} />, label: t('whiteboard.text') || 'Text' },
        { id: 'note', icon: <FileText size={18} />, label: t('whiteboard.note') || 'Note' },
    ];

    if (isPublic) {
        return null;
    }

    return (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white dark:bg-neutral-800 rounded-lg shadow-lg p-2 z-50 border border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center gap-1">
                {tools.map((tool) => (
                    <button
                        key={tool.id}
                        onClick={() => setCurrentTool(tool.id)}
                        className={`p-2 rounded transition-colors ${
                            currentTool === tool.id
                                ? 'bg-primary-light text-foreground'
                                : 'bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                        }`}
                        title={tool.label}
                    >
                        {tool.icon}
                    </button>
                ))}

                {/* Separator */}
                {onClear && (
                    <>
                        <button
                            onClick={onClear}
                            className="p-2 rounded transition-colors bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50"
                            title={t('whiteboard.clear') || 'Clear All'}
                        >
                            <Trash2 size={18} />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default WhiteboardToolbar;
