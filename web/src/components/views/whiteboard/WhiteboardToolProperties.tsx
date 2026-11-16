import { ReactNode, useState } from 'react';
import { Popover } from 'radix-ui';
import { Bold, Italic, Underline, Trash2, Minus, MoveRight, MoveLeft, MoveHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tool } from './tools/types';
import { WhiteboardTextData, WhiteboardEdgeData } from '../../../types/view';
import { ISLAND, INK } from './ui';

/** Style shared by the selected strokes / shapes (taken from the first one). */
export interface ShapeStyle {
    color: string;
    strokeWidth: number;
    fill: string | null;
    /** True when at least one selected object is a rectangle or circle. */
    fillable: boolean;
    roundness: 'sharp' | 'round';
    /** True when at least one selected object is a rectangle. */
    roundable: boolean;
}

export interface DrawingDefaults {
    color: string;
    strokeWidth: number;
    fill: string | null;
    roundness: 'sharp' | 'round';
}

interface WhiteboardToolPropertiesProps {
    currentTool: Tool;
    isPublic?: boolean;
    defaults: DrawingDefaults;
    onDefaultsChange: (updates: Partial<DrawingDefaults>) => void;
    selectionCount: number;
    onDelete: () => void;
    selectedShapeStyle?: ShapeStyle | null;
    onShapeStyleUpdate?: (updates: Partial<DrawingDefaults>) => void;
    selectedTextData?: WhiteboardTextData | null;
    onTextUpdate?: (updates: Partial<WhiteboardTextData>) => void;
    selectedEdgeData?: WhiteboardEdgeData | null;
    onEdgeUpdate?: (updates: Partial<WhiteboardEdgeData>) => void;
}

// --- Palettes ---

const STROKE_QUICK = ['#1e1e1e', '#e03131', '#2f9e44', '#1971c2', '#f08c00'];
const STROKE_FULL = [
    '#1e1e1e', '#495057', '#868e96', '#ced4da', '#ffffff',
    '#e03131', '#c2255c', '#9c36b5', '#6741d9', '#1971c2',
    '#0c8599', '#099268', '#2f9e44', '#f08c00', '#e8590c',
];
const BG_QUICK: (string | null)[] = [null, '#ffc9c9', '#b2f2bb', '#a5d8ff', '#ffec99'];
const BG_FULL: (string | null)[] = [
    null, '#f1f3f5', '#e9ecef', '#ced4da', '#ffffff',
    '#ffc9c9', '#fcc2d7', '#eebefa', '#d0bfff', '#a5d8ff',
    '#99e9f2', '#96f2d7', '#b2f2bb', '#ffec99', '#ffd8a8',
];

const STROKE_WIDTHS = [1, 2, 4, 8];
const FONT_SIZES = [
    { value: 16, label: 'S' },
    { value: 24, label: 'M' },
    { value: 32, label: 'L' },
    { value: 48, label: 'XL' },
];

const DRAWING_TOOLS: Tool[] = ['pen', 'rectangle', 'circle', 'line', 'edge'];
const FILLABLE_TOOLS: Tool[] = ['rectangle', 'circle'];

const CHECKER = 'repeating-conic-gradient(#d4d4d4 0% 25%, #ffffff 0% 50%) 50% / 8px 8px';

const WhiteboardToolProperties = ({
    currentTool,
    isPublic = false,
    defaults,
    onDefaultsChange,
    selectionCount,
    onDelete,
    selectedShapeStyle,
    onShapeStyleUpdate,
    selectedTextData,
    onTextUpdate,
    selectedEdgeData,
    onEdgeUpdate,
}: WhiteboardToolPropertiesProps) => {
    const { t } = useTranslation();

    const hasSelection = selectionCount > 0;
    const showToolDefaults = !hasSelection && (DRAWING_TOOLS.includes(currentTool) || currentTool === 'text');

    if (isPublic || (!hasSelection && !showToolDefaults)) {
        return null;
    }

    const labels = {
        stroke: t('whiteboard.stroke'),
        background: t('whiteboard.background'),
        strokeWidth: t('whiteboard.strokeWidth'),
        custom: t('whiteboard.customColor'),
        transparent: t('whiteboard.transparent'),
        edges: t('whiteboard.edges'),
        sharp: t('whiteboard.sharp'),
        round: t('whiteboard.round'),
    };

    return (
        <div
            className={`${ISLAND} absolute left-3 top-3 z-50 w-[13.25rem] max-h-[calc(100%-5.5rem)] sm:max-h-[calc(100%-1.5rem)] overflow-y-auto p-3`}
        >
            <div className="flex flex-col gap-3.5">
                {/* ---- Defaults for the active drawing tool ---- */}
                {showToolDefaults && (
                    <>
                        <Section label={labels.stroke}>
                            <ColorRow
                                quick={STROKE_QUICK}
                                full={STROKE_FULL}
                                value={defaults.color}
                                onChange={(c) => onDefaultsChange({ color: c ?? defaults.color })}
                                customLabel={labels.custom}
                                transparentLabel={labels.transparent}
                            />
                        </Section>
                        {FILLABLE_TOOLS.includes(currentTool) && (
                            <Section label={labels.background}>
                                <ColorRow
                                    quick={BG_QUICK}
                                    full={BG_FULL}
                                    value={defaults.fill}
                                    onChange={(c) => onDefaultsChange({ fill: c })}
                                    customLabel={labels.custom}
                                    transparentLabel={labels.transparent}
                                />
                            </Section>
                        )}
                        {currentTool !== 'text' && (
                            <Section label={labels.strokeWidth}>
                                <StrokeWidthRow value={defaults.strokeWidth} onChange={(w) => onDefaultsChange({ strokeWidth: w })} />
                            </Section>
                        )}
                        {currentTool === 'rectangle' && (
                            <Section label={labels.edges}>
                                <EdgesRow value={defaults.roundness} onChange={(r) => onDefaultsChange({ roundness: r })} sharp={labels.sharp} round={labels.round} />
                            </Section>
                        )}
                    </>
                )}

                {/* ---- Selected strokes / shapes ---- */}
                {selectedShapeStyle && onShapeStyleUpdate && (
                    <>
                        <Section label={labels.stroke}>
                            <ColorRow
                                quick={STROKE_QUICK}
                                full={STROKE_FULL}
                                value={selectedShapeStyle.color}
                                onChange={(c) => c && onShapeStyleUpdate({ color: c })}
                                customLabel={labels.custom}
                                transparentLabel={labels.transparent}
                            />
                        </Section>
                        {selectedShapeStyle.fillable && (
                            <Section label={labels.background}>
                                <ColorRow
                                    quick={BG_QUICK}
                                    full={BG_FULL}
                                    value={selectedShapeStyle.fill}
                                    onChange={(c) => onShapeStyleUpdate({ fill: c })}
                                    customLabel={labels.custom}
                                    transparentLabel={labels.transparent}
                                />
                            </Section>
                        )}
                        <Section label={labels.strokeWidth}>
                            <StrokeWidthRow value={selectedShapeStyle.strokeWidth} onChange={(w) => onShapeStyleUpdate({ strokeWidth: w })} />
                        </Section>
                        {selectedShapeStyle.roundable && (
                            <Section label={labels.edges}>
                                <EdgesRow value={selectedShapeStyle.roundness} onChange={(r) => onShapeStyleUpdate({ roundness: r })} sharp={labels.sharp} round={labels.round} />
                            </Section>
                        )}
                    </>
                )}

                {/* ---- Selected edge (arrow) ---- */}
                {selectedEdgeData && onEdgeUpdate && (
                    <>
                        <Section label={labels.stroke}>
                            <ColorRow
                                quick={STROKE_QUICK}
                                full={STROKE_FULL}
                                value={selectedEdgeData.color || '#1e1e1e'}
                                onChange={(c) => c && onEdgeUpdate({ color: c })}
                                customLabel={labels.custom}
                                transparentLabel={labels.transparent}
                            />
                        </Section>
                        <Section label={labels.strokeWidth}>
                            <StrokeWidthRow value={selectedEdgeData.strokeWidth} onChange={(w) => onEdgeUpdate({ strokeWidth: w })} />
                        </Section>
                        <Section label={t('whiteboard.lineStyle')}>
                            <ButtonRow
                                value={selectedEdgeData.lineStyle ?? 'solid'}
                                onChange={(v) => onEdgeUpdate({ lineStyle: v })}
                                options={[
                                    { value: 'solid', title: t('whiteboard.solid'), icon: <LineIcon /> },
                                    { value: 'dashed', title: t('whiteboard.dashed'), icon: <LineIcon dash="4 3" /> },
                                    { value: 'dotted', title: t('whiteboard.dotted'), icon: <LineIcon dash="0.5 3.5" /> },
                                ]}
                            />
                        </Section>
                        <Section label={t('whiteboard.curveType')}>
                            <ButtonRow
                                value={selectedEdgeData.curveType ?? 'straight'}
                                onChange={(v) => onEdgeUpdate({ curveType: v })}
                                options={[
                                    { value: 'straight', title: t('whiteboard.straight'), icon: <PathIcon d="M3 15 L15 3" /> },
                                    { value: 'bezier', title: t('whiteboard.bezier'), icon: <PathIcon d="M3 15 C 3 6, 15 12, 15 3" /> },
                                    { value: 'elbow', title: t('whiteboard.elbow'), icon: <PathIcon d="M3 15 L3 9 L15 9 L15 3" /> },
                                ]}
                            />
                        </Section>
                        <Section label={t('whiteboard.arrowType')}>
                            <ButtonRow
                                value={selectedEdgeData.arrowType ?? 'end'}
                                onChange={(v) => onEdgeUpdate({ arrowType: v })}
                                options={[
                                    { value: 'none', title: t('whiteboard.arrowNone'), icon: <Minus size={16} /> },
                                    { value: 'end', title: t('whiteboard.arrowEnd'), icon: <MoveRight size={16} /> },
                                    { value: 'start', title: t('whiteboard.arrowStart'), icon: <MoveLeft size={16} /> },
                                    { value: 'both', title: t('whiteboard.arrowBoth'), icon: <MoveHorizontal size={16} /> },
                                ]}
                            />
                        </Section>
                    </>
                )}

                {/* ---- Selected text ---- */}
                {selectedTextData && onTextUpdate && (
                    <>
                        <Section label={t('whiteboard.textContent')}>
                            <input
                                type="text"
                                value={selectedTextData.text || ''}
                                onChange={(e) => onTextUpdate({ text: e.target.value })}
                                placeholder={t('whiteboard.defaultText')}
                                className="h-8 w-full rounded-md border border-neutral-200 bg-white px-2 text-sm text-neutral-900 outline-none transition-colors focus:border-primary dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100"
                            />
                        </Section>
                        <Section label={labels.stroke}>
                            <ColorRow
                                quick={STROKE_QUICK}
                                full={STROKE_FULL}
                                value={selectedTextData.color || '#1e1e1e'}
                                onChange={(c) => c && onTextUpdate({ color: c })}
                                customLabel={labels.custom}
                                transparentLabel={labels.transparent}
                            />
                        </Section>
                        <Section label={t('whiteboard.fontFamily')}>
                            <ButtonRow
                                value={selectedTextData.fontFamily || 'sans-serif'}
                                onChange={(v) => onTextUpdate({ fontFamily: v })}
                                options={[
                                    { value: 'sans-serif', title: t('whiteboard.sansSerif'), icon: <span className="font-sans text-sm">Aa</span> },
                                    { value: 'serif', title: t('whiteboard.serif'), icon: <span className="font-serif text-sm">Aa</span> },
                                    { value: 'monospace', title: t('whiteboard.monospace'), icon: <span className="font-mono text-sm">Aa</span> },
                                ]}
                            />
                        </Section>
                        <Section label={t('whiteboard.fontSize')}>
                            <ButtonRow
                                value={selectedTextData.fontSize}
                                onChange={(v) => onTextUpdate({ fontSize: v })}
                                options={FONT_SIZES.map((s) => ({
                                    value: s.value,
                                    title: `${s.value}px`,
                                    icon: <span className="text-xs font-medium">{s.label}</span>,
                                }))}
                            />
                        </Section>
                        <Section label={t('whiteboard.textStyle')}>
                            <div className="flex gap-1">
                                <PropButton
                                    active={selectedTextData.fontWeight === 'bold'}
                                    onClick={() => onTextUpdate({ fontWeight: selectedTextData.fontWeight === 'bold' ? 'normal' : 'bold' })}
                                    title={t('whiteboard.bold')}
                                >
                                    <Bold size={15} />
                                </PropButton>
                                <PropButton
                                    active={selectedTextData.fontStyle === 'italic'}
                                    onClick={() => onTextUpdate({ fontStyle: selectedTextData.fontStyle === 'italic' ? 'normal' : 'italic' })}
                                    title={t('whiteboard.italic')}
                                >
                                    <Italic size={15} />
                                </PropButton>
                                <PropButton
                                    active={selectedTextData.textDecoration === 'underline'}
                                    onClick={() => onTextUpdate({ textDecoration: selectedTextData.textDecoration === 'underline' ? 'none' : 'underline' })}
                                    title={t('whiteboard.underline')}
                                >
                                    <Underline size={15} />
                                </PropButton>
                            </div>
                        </Section>
                    </>
                )}

                {/* ---- Actions ---- */}
                {hasSelection && (
                    <Section label={t('whiteboard.actions')}>
                        <div className="flex gap-1">
                            <PropButton active={false} onClick={onDelete} title={`${t('whiteboard.delete')} (Del)`} danger>
                                <Trash2 size={15} />
                            </PropButton>
                        </div>
                    </Section>
                )}
            </div>
        </div>
    );
};

// --- Building blocks ---

const Section = ({ label, children }: { label: string; children: ReactNode }) => (
    <div className="flex flex-col gap-1.5">
        <div className="text-xs text-neutral-500 dark:text-neutral-400">{label}</div>
        {children}
    </div>
);

const PropButton = ({
    active,
    onClick,
    title,
    danger = false,
    children,
}: {
    active: boolean;
    onClick: () => void;
    title: string;
    danger?: boolean;
    children: ReactNode;
}) => (
    <button
        type="button"
        onClick={onClick}
        title={title}
        aria-label={title}
        aria-pressed={active}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors ${
            active
                ? 'bg-primary-light text-primary ring-1 ring-primary dark:text-primary-300'
                : danger
                    ? 'bg-neutral-100 text-neutral-700 hover:bg-red-50 hover:text-red-600 dark:bg-neutral-700 dark:text-neutral-200 dark:hover:bg-red-900/40 dark:hover:text-red-400'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-600'
        }`}
    >
        {children}
    </button>
);

function ButtonRow<T extends string | number>({
    value,
    onChange,
    options,
}: {
    value: T | undefined;
    onChange: (value: T) => void;
    options: { value: T; title: string; icon: ReactNode }[];
}) {
    return (
        <div className="flex gap-1">
            {options.map((opt) => (
                <PropButton key={String(opt.value)} active={value === opt.value} onClick={() => onChange(opt.value)} title={opt.title}>
                    {opt.icon}
                </PropButton>
            ))}
        </div>
    );
}

const StrokeWidthRow = ({ value, onChange }: { value: number | undefined; onChange: (w: number) => void }) => (
    <ButtonRow
        value={value}
        onChange={onChange}
        options={STROKE_WIDTHS.map((w) => ({
            value: w,
            title: `${w}px`,
            icon: (
                <svg width="18" height="18" viewBox="0 0 18 18">
                    <line x1="3" y1="9" x2="15" y2="9" stroke="currentColor" strokeLinecap="round" strokeWidth={Math.min(6, 0.75 + w * 0.7)} />
                </svg>
            ),
        }))}
    />
);

const EdgesRow = ({ value, onChange, sharp, round }: { value: 'sharp' | 'round'; onChange: (r: 'sharp' | 'round') => void; sharp: string; round: string }) => (
    <ButtonRow
        value={value}
        onChange={onChange}
        options={[
            { value: 'sharp', title: sharp, icon: <PathIcon d="M4 14 V4 H14" /> },
            { value: 'round', title: round, icon: <PathIcon d="M4 14 V9 A5 5 0 0 1 9 4 H14" /> },
        ]}
    />
);

const Swatch = ({
    color,
    active,
    onClick,
    title,
    size = 'h-6 w-6',
}: {
    color: string | null;
    active: boolean;
    onClick: () => void;
    title: string;
    size?: string;
}) => (
    <button
        type="button"
        onClick={onClick}
        title={title}
        aria-label={title}
        aria-pressed={active}
        className={`${size} shrink-0 overflow-hidden rounded-md border border-black/10 transition-transform hover:scale-110 dark:border-white/15 ${
            active ? 'ring-2 ring-primary ring-offset-1 ring-offset-white dark:ring-offset-neutral-800' : ''
        }`}
    >
        {/* Fill gets the canvas's dark-mode ink filter so swatches match what is drawn */}
        <span className={`block h-full w-full ${color ? INK : ''}`} style={{ background: color ?? CHECKER }} />
    </button>
);

const sameColor = (a: string | null, b: string | null) => (a ?? '').toLowerCase() === (b ?? '').toLowerCase();

/** Quick swatches + a "current colour" button that opens the full palette. */
const ColorRow = ({
    quick,
    full,
    value,
    onChange,
    customLabel,
    transparentLabel,
}: {
    quick: (string | null)[];
    full: (string | null)[];
    value: string | null;
    onChange: (color: string | null) => void;
    customLabel: string;
    transparentLabel: string;
}) => {
    const [open, setOpen] = useState(false);
    const [hex, setHex] = useState('');
    const titleOf = (c: string | null) => c ?? transparentLabel;

    return (
        <div className="flex items-center gap-1.5">
            {quick.map((c) => (
                <Swatch key={c ?? 'none'} color={c} active={sameColor(c, value)} onClick={() => onChange(c)} title={titleOf(c)} />
            ))}
            <div className="mx-0.5 h-5 w-px bg-neutral-200 dark:bg-neutral-700" />
            <Popover.Root
                open={open}
                onOpenChange={(o) => {
                    setOpen(o);
                    if (o) setHex((value ?? '').replace('#', ''));
                }}
            >
                <Popover.Trigger asChild>
                    <button
                        type="button"
                        title={customLabel}
                        aria-label={customLabel}
                        className="h-7 w-7 shrink-0 overflow-hidden rounded-md border border-black/10 shadow-sm transition-transform hover:scale-105 dark:border-white/15"
                    >
                        <span className={`block h-full w-full ${value ? INK : ''}`} style={{ background: value ?? CHECKER }} />
                    </button>
                </Popover.Trigger>
                <Popover.Portal>
                    <Popover.Content
                        side="right"
                        align="start"
                        sideOffset={14}
                        collisionPadding={12}
                        className={`${ISLAND} z-popover w-[11.5rem] p-3`}
                    >
                        <div className="grid grid-cols-[repeat(5,1.75rem)] gap-1.5">
                            {full.map((c) => (
                                <Swatch
                                    key={c ?? 'none'}
                                    color={c}
                                    active={sameColor(c, value)}
                                    onClick={() => {
                                        onChange(c);
                                        setOpen(false);
                                    }}
                                    title={titleOf(c)}
                                    size="h-7 w-7"
                                />
                            ))}
                        </div>
                        <div className="mt-3 flex items-center gap-1.5">
                            <div className="flex h-8 min-w-0 flex-1 items-center rounded-md border border-neutral-200 bg-white px-2 text-sm focus-within:border-primary dark:border-neutral-600 dark:bg-neutral-900">
                                <span className="text-neutral-400">#</span>
                                <input
                                    value={hex}
                                    onChange={(e) => {
                                        const v = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
                                        setHex(v);
                                        if (v.length === 6 || v.length === 3) onChange(`#${v.toLowerCase()}`);
                                    }}
                                    className="min-w-0 flex-1 bg-transparent pl-1 font-mono text-neutral-900 outline-none dark:text-neutral-100"
                                    aria-label="Hex"
                                />
                            </div>
                            <label
                                title={customLabel}
                                className="relative h-8 w-8 shrink-0 cursor-pointer overflow-hidden rounded-md border border-black/10 dark:border-white/15"
                                style={{ background: 'conic-gradient(#e03131, #f08c00, #ffec99, #2f9e44, #1971c2, #9c36b5, #e03131)' }}
                            >
                                <input
                                    type="color"
                                    value={value && /^#[0-9a-f]{6}$/i.test(value) ? value : '#1e1e1e'}
                                    onChange={(e) => {
                                        onChange(e.target.value);
                                        setHex(e.target.value.replace('#', ''));
                                    }}
                                    className="absolute inset-0 cursor-pointer opacity-0"
                                    aria-label={customLabel}
                                />
                            </label>
                        </div>
                    </Popover.Content>
                </Popover.Portal>
            </Popover.Root>
        </div>
    );
};

const LineIcon = ({ dash }: { dash?: string }) => (
    <svg width="18" height="18" viewBox="0 0 18 18">
        <line x1="2.5" y1="9" x2="15.5" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray={dash} />
    </svg>
);

const PathIcon = ({ d }: { d: string }) => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d={d} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export default WhiteboardToolProperties;
