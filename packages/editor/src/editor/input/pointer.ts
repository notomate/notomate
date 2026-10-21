/** Mouse is the only pointer that may start marquee / text-to-block selection. */
export const isMouse = (e: { pointerType?: string }) => e.pointerType === 'mouse';

export const isCoarsePointer = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;

export function blockIdAt(x: number, y: number): string | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  return (el?.closest('[data-block-id]') as HTMLElement | null)?.dataset.blockId ?? null;
}

export function rowsIn(root: ParentNode = document): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('.block-row'));
}

export const blockIdOfRow = (row: HTMLElement) => (row.closest('[data-block-id]') as HTMLElement).dataset.blockId!;

/** Row whose vertical band contains `y` (client coords), clamped to the first/last row. */
export function rowAtY(y: number, root?: ParentNode): HTMLElement | null {
  const rows = rowsIn(root);
  if (!rows.length) return null;
  let best: HTMLElement | null = null;
  let bestDist = Infinity;
  for (const r of rows) {
    const b = r.getBoundingClientRect();
    if (y >= b.top && y < b.bottom) return r;
    const dist = y < b.top ? b.top - y : y - b.bottom;
    if (dist < bestDist) {
      bestDist = dist;
      best = r;
    }
  }
  return best;
}

/** Scroll the window while a drag is held near the top/bottom edge. */
export function createAutoScroller(onScroll: () => void) {
  let raf = 0;
  let y = -1;
  const EDGE = 48;
  const tick = () => {
    const h = window.innerHeight;
    let dy = 0;
    if (y >= 0 && y < EDGE) dy = -Math.ceil((EDGE - y) / 3);
    else if (y > h - EDGE) dy = Math.ceil((y - (h - EDGE)) / 3);
    if (dy) {
      window.scrollBy(0, dy);
      onScroll();
    }
    raf = requestAnimationFrame(tick);
  };
  return {
    update(clientY: number) {
      y = clientY;
      if (!raf) raf = requestAnimationFrame(tick);
    },
    stop() {
      cancelAnimationFrame(raf);
      raf = 0;
      y = -1;
    },
  };
}
