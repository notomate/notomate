// Widths the API can scale workspace images down to (see ?w= on file
// downloads). Keep in sync with imagevariant.Widths in the API.
export const IMAGE_VARIANT_WIDTHS = [320, 640, 1280] as const

const WORKSPACE_FILE = /^\/api\/v1\/workspaces\/[^/]+\/files\/[^/?#]+$/
const RESIZABLE_EXT = /\.(jpe?g|png|webp)$/i

/** Whether src is a workspace image the API can serve downscaled. */
export const isResizableImage = (src?: string | null): src is string =>
    !!src && WORKSPACE_FILE.test(src) && RESIZABLE_EXT.test(src)

/**
 * URL of a copy of src at most width pixels wide. The API snaps width up to
 * a variant size and returns the original when it is already smaller; other
 * URLs are returned unchanged.
 */
export const imageVariantUrl = (src: string, width: number) =>
    isResizableImage(src) ? `${src}?w=${width}` : src

/**
 * srcset for a workspace image whose original width is known. Only variants
 * smaller than the original are listed, so every width descriptor is true.
 */
export const imageSrcSet = (src: string, originalWidth: number) => {
    if (!isResizableImage(src)) return undefined
    const entries = IMAGE_VARIANT_WIDTHS
        .filter(w => w < originalWidth)
        .map(w => `${src}?w=${w} ${w}w`)
    entries.push(`${src} ${originalWidth}w`)
    return entries.join(', ')
}

/** Positive dimensions or undefined; 0 means the API couldn't read them. */
export const knownDimensions = (width?: number | null, height?: number | null) =>
    width && height && width > 0 && height > 0 ? { width, height } : undefined
