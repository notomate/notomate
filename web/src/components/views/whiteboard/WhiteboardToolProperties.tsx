import { Bold, Italic, Underline } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tool } from './tools/types';
import { WhiteboardTextData, WhiteboardEdgeData } from '../../../types/view';

interface WhiteboardToolPropertiesProps {
    currentTool: Tool;
    currentColor: string;
    setCurrentColor: (color: string) => void;
    currentStrokeWidth: number;
    setCurrentStrokeWidth: (width: number) => void;
    isPublic?: boolean;
    // Text properties
    selectedTextData?: WhiteboardTextData | null;
    onTextUpdate?: (updates: Partial<WhiteboardTextData>) => void;
    // Edge properties
    selectedEdgeData?: WhiteboardEdgeData | null;
    onEdgeUpdate?: (updates: Partial<WhiteboardEdgeData>) => void;
}

const WhiteboardToolProperties = ({
    currentTool,
    currentColor,
    setCurrentColor,
    currentStrokeWidth,
    setCurrentStrokeWidth,
    isPublic = false,
    selectedTextData,
    onTextUpdate,
    selectedEdgeData,
    onEdgeUpdate
}: WhiteboardToolPropertiesProps) => {
    const { t } = useTranslation();

    const strokeWidths = [1, 2, 4, 6, 8];
    const commonColors = ['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];
    const fontFamilies: { value: 'sans-serif' | 'serif' | 'monospace'; label: string }[] = [
        { value: 'sans-serif', label: t('whiteboard.sansSerif') || 'Sans-serif' },
        { value: 'serif', label: t('whiteboard.serif') || 'Serif' },
        { value: 'monospace', label: t('whiteboard.monospace') || 'Monospace' },
    ];
    const fontSizes = [12, 16, 20, 24, 32, 48, 64];

    const curveTypes: { value: 'straight' | 'bezier' | 'elbow'; label: string }[] = [
        { value: 'straight', label: t('whiteboard.straight') || 'Straight' },
        { value: 'bezier', label: t('whiteboard.bezier') || 'Bezier' },
        { value: 'elbow', label: t('whiteboard.elbow') || 'Elbow' },
    ];

    const arrowTypes: { value: 'none' | 'end' | 'start' | 'both'; label: string }[] = [
        { value: 'none', label: t('whiteboard.arrowNone') || 'None' },
        { value: 'end', label: t('whiteboard.arrowEnd') || 'End' },
        { value: 'start', label: t('whiteboard.arrowStart') || 'Start' },
        { value: 'both', label: t('whiteboard.arrowBoth') || 'Both' },
    ];

    const lineStyles: { value: 'solid' | 'dashed' | 'dotted'; label: string }[] = [
        { value: 'solid', label: t('whiteboard.solid') || 'Solid' },
        { value: 'dashed', label: t('whiteboard.dashed') || 'Dashed' },
        { value: 'dotted', label: t('whiteboard.dotted') || 'Dotted' },
    ];

    const showColorPicker = currentTool === 'pen' || currentTool === 'rectangle' || currentTool === 'circle' || currentTool === 'line' || currentTool === 'text' || currentTool === 'edge';
    const showStrokeWidth = currentTool === 'pen' || currentTool === 'rectangle' || currentTool === 'circle' || currentTool === 'line' || currentTool === 'edge';
    const showTextProperties = selectedTextData && onTextUpdate;
    const showEdgeProperties = selectedEdgeData && onEdgeUpdate;

    if (isPublic || (!showColorPicker && !showStrokeWidth && !showTextProperties && !showEdgeProperties)) {
        return null;
    }

    return (
        <div className="absolute top-4 left-4 bg-white dark:bg-neutral-800 rounded-lg shadow-lg p-3 z-50 border border-neutral-200 dark:border-neutral-700 max-h-[calc(100vh-120px)] overflow-y-auto">
            <div className="flex flex-col gap-3">
                {/* Text properties - show when text is selected */}
                {showTextProperties && (
                    <>
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            {t('whiteboard.textProperties') || 'Text'}
                        </div>

                        {/* Text Content */}
                        <input
                            type="text"
                            value={selectedTextData.text || ''}
                            onChange={(e) => onTextUpdate({ text: e.target.value })}
                            placeholder={t('whiteboard.defaultText') || 'Text'}
                            className="w-full px-2 py-1 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100"
                        />

                        {/* Font Family */}
                        <select
                            value={selectedTextData.fontFamily || 'sans-serif'}
                            onChange={(e) => onTextUpdate({ fontFamily: e.target.value as 'sans-serif' | 'serif' | 'monospace' })}
                            className="w-full px-2 py-1 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100"
                        >
                            {fontFamilies.map((font) => (
                                <option key={font.value} value={font.value}>
                                    {font.label}
                                </option>
                            ))}
                        </select>

                        {/* Font Size */}
                        <div className="flex flex-wrap gap-1">
                            {fontSizes.map((size) => (
                                <button
                                    key={size}
                                    onClick={() => onTextUpdate({ fontSize: size })}
                                    className={`px-2 py-1 text-xs rounded transition-colors ${selectedTextData.fontSize === size
                                            ? 'bg-primary-light text-foreground'
                                            : 'bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                                        }`}
                                >
                                    {size}
                                </button>
                            ))}
                        </div>

                        {/* Style Buttons */}
                        <div className="flex gap-1">
                            <button
                                onClick={() => onTextUpdate({ fontWeight: selectedTextData.fontWeight === 'bold' ? 'normal' : 'bold' })}
                                className={`p-2 rounded transition-colors ${selectedTextData.fontWeight === 'bold'
                                        ? 'bg-primary-light text-foreground'
                                        : 'bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                                    }`}
                                title={t('whiteboard.bold') || 'Bold'}
                            >
                                <Bold size={14} />
                            </button>
                            <button
                                onClick={() => onTextUpdate({ fontStyle: selectedTextData.fontStyle === 'italic' ? 'normal' : 'italic' })}
                                className={`p-2 rounded transition-colors ${selectedTextData.fontStyle === 'italic'
                                        ? 'bg-primary-light text-foreground'
                                        : 'bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                                    }`}
                                title={t('whiteboard.italic') || 'Italic'}
                            >
                                <Italic size={14} />
                            </button>
                            <button
                                onClick={() => onTextUpdate({ textDecoration: selectedTextData.textDecoration === 'underline' ? 'none' : 'underline' })}
                                className={`p-2 rounded transition-colors ${selectedTextData.textDecoration === 'underline'
                                        ? 'bg-primary-light text-foreground'
                                        : 'bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                                    }`}
                                title={t('whiteboard.underline') || 'Underline'}
                            >
                                <Underline size={14} />
                            </button>
                        </div>

                        {/* Text Color */}
                        <div className="flex flex-wrap gap-1">
                            {commonColors.map((color) => (
                                <button
                                    key={color}
                                    onClick={() => onTextUpdate({ color })}
                                    className={`w-6 h-6 rounded border-2 transition-all ${selectedTextData.color === color
                                            ? 'border-primary scale-110'
                                            : 'border-neutral-300 dark:border-neutral-600 hover:scale-105'
                                        }`}
                                    style={{ backgroundColor: color }}
                                    title={color}
                                />
                            ))}
                            <input
                                type="color"
                                value={selectedTextData.color || '#000000'}
                                onChange={(e) => onTextUpdate({ color: e.target.value })}
                                className="w-6 h-6 rounded border-2 border-neutral-300 dark:border-neutral-600 cursor-pointer"
                                title={t('whiteboard.customColor') || 'Custom Color'}
                            />
                        </div>

                    </>
                )}

                {/* Edge properties - show when edge is selected */}
                {showEdgeProperties && (
                    <>
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            {t('whiteboard.edgeProperties') || 'Edge Properties'}
                        </div>

                        {/* Curve Type */}
                        <div className="flex flex-col gap-1">
                            <div className="text-xs text-muted-foreground">
                                {t('whiteboard.curveType') || 'Curve Type'}
                            </div>
                            <div className="flex gap-1">
                                {curveTypes.map((type) => (
                                    <button
                                        key={type.value}
                                        onClick={() => onEdgeUpdate({ curveType: type.value })}
                                        className={`px-2 py-1 text-xs rounded transition-colors ${selectedEdgeData.curveType === type.value
                                            ? 'bg-primary-light text-foreground'
                                            : 'bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                                            }`}
                                    >
                                        {type.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Arrow Type */}
                        <div className="flex flex-col gap-1">
                            <div className="text-xs text-muted-foreground">
                                {t('whiteboard.arrowType') || 'Arrow Type'}
                            </div>
                            <div className="flex gap-1">
                                {arrowTypes.map((type) => (
                                    <button
                                        key={type.value}
                                        onClick={() => onEdgeUpdate({ arrowType: type.value })}
                                        className={`px-2 py-1 text-xs rounded transition-colors ${selectedEdgeData.arrowType === type.value
                                            ? 'bg-primary-light text-foreground'
                                            : 'bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                                            }`}
                                    >
                                        {type.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Line Style */}
                        <div className="flex flex-col gap-1">
                            <div className="text-xs text-muted-foreground">
                                {t('whiteboard.lineStyle') || 'Line Style'}
                            </div>
                            <div className="flex gap-1">
                                {lineStyles.map((style) => (
                                    <button
                                        key={style.value}
                                        onClick={() => onEdgeUpdate({ lineStyle: style.value })}
                                        className={`px-2 py-1 text-xs rounded transition-colors ${selectedEdgeData.lineStyle === style.value
                                            ? 'bg-primary-light text-foreground'
                                            : 'bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                                            }`}
                                    >
                                        {style.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Edge Color */}
                        <div className="flex flex-wrap gap-1">
                            {commonColors.map((color) => (
                                <button
                                    key={color}
                                    onClick={() => onEdgeUpdate({ color })}
                                    className={`w-6 h-6 rounded border-2 transition-all ${selectedEdgeData.color === color
                                        ? 'border-primary scale-110'
                                        : 'border-neutral-300 dark:border-neutral-600 hover:scale-105'
                                        }`}
                                    style={{ backgroundColor: color }}
                                    title={color}
                                />
                            ))}
                            <input
                                type="color"
                                value={selectedEdgeData.color || '#000000'}
                                onChange={(e) => onEdgeUpdate({ color: e.target.value })}
                                className="w-6 h-6 rounded border-2 border-neutral-300 dark:border-neutral-600 cursor-pointer"
                                title={t('whiteboard.customColor') || 'Custom Color'}
                            />
                        </div>

                        {/* Edge Stroke Width */}
                        <div className="flex flex-wrap gap-1">
                            {strokeWidths.map((width) => (
                                <button
                                    key={width}
                                    onClick={() => onEdgeUpdate({ strokeWidth: width })}
                                    className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${selectedEdgeData.strokeWidth === width
                                        ? 'bg-primary-light text-foreground'
                                        : 'bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                                        }`}
                                    title={`${width}px`}
                                >
                                    <div
                                        className="rounded-full bg-current"
                                        style={{ width: `${width * 2}px`, height: `${width * 2}px` }}
                                    />
                                </button>
                            ))}
                        </div>
                    </>
                )}

                {/* Color picker - for drawing tools */}
                {showColorPicker && !showTextProperties && !showEdgeProperties && (
                    <div className="flex flex-col gap-1">
                        <div className="flex flex-col gap-1">
                            {commonColors.map((color) => (
                                <button
                                    key={color}
                                    onClick={() => setCurrentColor(color)}
                                    className={`w-6 h-6 rounded border-2 transition-all ${currentColor === color
                                        ? 'border-primary scale-110'
                                        : 'border-neutral-300 dark:border-neutral-600 hover:scale-105'
                                        }`}
                                    style={{ backgroundColor: color }}
                                    title={color}
                                />
                            ))}
                            <input
                                type="color"
                                value={currentColor}
                                onChange={(e) => setCurrentColor(e.target.value)}
                                className="w-6 h-6 rounded border-2 border-neutral-300 dark:border-neutral-600 cursor-pointer"
                                title={t('whiteboard.customColor') || 'Custom Color'}
                            />
                        </div>
                    </div>
                )}

                {/* Stroke width */}
                {showStrokeWidth && !showEdgeProperties && (
                    <div className="flex flex-col gap-1">
                        <div className="flex flex-col gap-1">
                            {strokeWidths.map((width) => (
                                <button
                                    key={width}
                                    onClick={() => setCurrentStrokeWidth(width)}
                                    className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${currentStrokeWidth === width
                                        ? 'bg-primary-light text-foreground'
                                        : 'bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                                        }`}
                                    title={`${width}px`}
                                >
                                    <div
                                        className="rounded-full bg-current"
                                        style={{ width: `${width * 2}px`, height: `${width * 2}px` }}
                                    />
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WhiteboardToolProperties;
