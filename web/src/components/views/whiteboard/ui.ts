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

/** Square icon button used inside islands. */
export const ISLAND_BTN =
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-neutral-700 transition-colors ' +
    'hover:bg-neutral-100 disabled:pointer-events-none disabled:opacity-40 ' +
    'dark:text-neutral-200 dark:hover:bg-neutral-700';

/** Active/pressed state for ISLAND_BTN and property buttons. */
export const ISLAND_BTN_ACTIVE =
    '!bg-primary-light !text-primary dark:!text-primary-300';
