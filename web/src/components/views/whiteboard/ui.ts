import { WhiteboardShapeData } from '../../../types/view';

/**
 * Shared styling for the whiteboard's floating UI "islands" (toolbar, property
 * panel, zoom controls, menus). A hairline ring plus a soft drop shadow instead
 * of a hard border keeps the chrome light over the canvas.
 */
export const ISLAND =
    'rounded-lg bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_1px_3px_rgba(0,0,0,0.08),0_6px_20px_rgba(0,0,0,0.06)] ' +
    'dark:bg-neutral-800 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_1px_3px_rgba(0,0,0,0.4),0_6px_20px_rgba(0,0,0,0.3)]';

/**
 * Applied to drawn content (strokes, shapes, text, arrows) so dark ink stays
 * legible on the dark canvas: invert lightness, then rotate hue back so colours
 * keep their identity. UI chrome and notes are left alone.
 */
export const INK = 'dark:[filter:invert(93%)_hue-rotate(180deg)]';

/** Corner radius of a rounded rectangle (world units): a subtle 15% of the short side, capped at 12. */
export const rectCornerRadius = (width: number, height: number) =>
    Math.min(12, Math.min(Math.abs(width), Math.abs(height)) * 0.15);

/** Default font size (world units) of a shape label. */
export const SHAPE_TEXT_SIZE = 16;

/** Inner padding (world units) between a shape's outline and its label. */
export const SHAPE_TEXT_PADDING = 8;

/** Line height of shape labels (relative to the font size). */
export const SHAPE_TEXT_LINE_HEIGHT = 1.25;

/** Rectangles and circles can hold a centred label; lines cannot. */
export const isTextableShape = (d: WhiteboardShapeData) => d.type === 'rectangle' || d.type === 'circle';

/**
 * World-space box a shape's label is laid out in: the rectangle itself, or the
 * square inscribed in the circle. Null for shapes that take no label.
 */
export const shapeTextBox = (d: WhiteboardShapeData): { x: number; y: number; width: number; height: number } | null => {
    if (!d?.position || !d?.dimensions) return null;
    if (d.type === 'rectangle') {
        return {
            x: Math.min(d.position.x, d.position.x + d.dimensions.width),
            y: Math.min(d.position.y, d.position.y + d.dimensions.height),
            width: Math.abs(d.dimensions.width),
            height: Math.abs(d.dimensions.height),
        };
    }
    if (d.type === 'circle') {
        const half = Math.hypot(d.dimensions.width, d.dimensions.height) / Math.SQRT2;
        return { x: d.position.x - half, y: d.position.y - half, width: half * 2, height: half * 2 };
    }
    return null;
};

/** Square icon button used inside islands. */
export const ISLAND_BTN =
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-neutral-700 transition-colors ' +
    'hover:bg-neutral-100 disabled:pointer-events-none disabled:opacity-40 ' +
    'dark:text-neutral-200 dark:hover:bg-neutral-700';

/** Active/pressed state for ISLAND_BTN and property buttons. */
export const ISLAND_BTN_ACTIVE =
    '!bg-primary-light !text-primary dark:!text-primary-300';
