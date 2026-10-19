export type Orientation = 'landscape' | 'portrait' | 'square'

export interface CarouselLayout {
    /** Number of tiles shown; the last one carries the "+N" overlay when items overflow. */
    visible: number
    aspectRatio: string
    templateColumns: string
    templateRows: string
    /** Grid area name per visible tile, in item order. */
    areas: string[]
    templateAreas: string
}

export const MAX_VISIBLE = 4

export const orientation = (ratio?: number): Orientation => {
    if (!ratio) return 'square'
    if (ratio > 1.2) return 'landscape'
    if (ratio < 0.83) return 'portrait'
    return 'square'
}

const fr = (n: number) => `minmax(0, ${n}fr)`

const layout = (aspectRatio: string, columns: number[], rows: number[], areas: string[]): Omit<CarouselLayout, 'visible' | 'areas'> => ({
    aspectRatio,
    templateColumns: columns.map(fr).join(' '),
    templateRows: rows.map(fr).join(' '),
    templateAreas: areas.map(row => `"${row}"`).join(' '),
})

/**
 * Mosaic layout for a carousel: one main tile (the first item) plus up to
 * three smaller ones, arranged by the main item's orientation.
 * `ratios` holds width / height per item index, when known.
 */
export const computeCarouselLayout = (count: number, ratios: Record<number, number>): CarouselLayout => {
    const visible = Math.min(count, MAX_VISIBLE)
    const areas = ['a', 'b', 'c', 'd'].slice(0, visible)
    const main = orientation(ratios[0])

    if (visible <= 1) {
        const ratio = Math.min(16 / 9, Math.max(3 / 4, ratios[0] ?? 4 / 3))
        return { visible, areas, ...layout(String(ratio), [1], [1], ['a']) }
    }

    if (visible === 2) {
        const second = orientation(ratios[1])
        if (main === 'landscape' && second === 'landscape') {
            return { visible, areas, ...layout('4 / 3', [1], [1, 1], ['a', 'b']) }
        }
        // A square main item stays 1:1: half the width, half the width tall.
        const aspect = main === 'square' ? '2 / 1' : main === 'portrait' && second === 'portrait' ? '1 / 1' : '4 / 3'
        return { visible, areas, ...layout(aspect, [1, 1], [1], ['a b']) }
    }

    // Square main items keep 1:1, with the side column also made of squares.
    if (visible === 3) {
        if (main === 'landscape') return { visible, areas, ...layout('4 / 3', [1, 1], [2, 1], ['a a', 'b c']) }
        if (main === 'square') return { visible, areas, ...layout('3 / 2', [2, 1], [1, 1], ['a b', 'a c']) }
        return { visible, areas, ...layout('4 / 3', [2, 1], [1, 1], ['a b', 'a c']) }
    }

    if (main === 'landscape') return { visible, areas, ...layout('4 / 3', [1, 1, 1], [2, 1], ['a a a', 'b c d']) }
    if (main === 'square') return { visible, areas, ...layout('4 / 3', [3, 1], [1, 1, 1], ['a b', 'a c', 'a d']) }
    return { visible, areas, ...layout('1 / 1', [2, 1], [1, 1, 1], ['a b', 'a c', 'a d']) }
}
