import { HTMLAttributes, Ref, useEffect, useRef, useState } from "react"
import { ImageOff } from "lucide-react"
import { twMerge } from "tailwind-merge"
import { imageSrcSet, imageVariantUrl, knownDimensions } from "@/lib/image"

interface ProgressiveImageProps extends Omit<HTMLAttributes<HTMLSpanElement>, "onLoad"> {
    src: string
    alt?: string
    /** Original dimensions, when known; used to reserve space before loading. */
    width?: number | null
    height?: number | null
    /**
     * Fill the box given by className with object-cover, loading a single
     * variant of this width (e.g. grids and fixed-size thumbnails).
     */
    cover?: boolean
    variantWidth?: number
    /** Cap on the displayed height in px (non-cover only). */
    maxHeight?: number
    imgClassName?: string
    /** Shown instead of the skeleton until src loads (e.g. a local preview). */
    placeholderSrc?: string
    draggable?: boolean
    onLoad?: (naturalWidth: number, naturalHeight: number) => void
    ref?: Ref<HTMLSpanElement>
}

/**
 * Lazily loaded image that shows a skeleton until it arrives, then fades
 * in. Workspace images are served as downscaled variants.
 */
const ProgressiveImage = ({
    src,
    alt = "",
    width,
    height,
    cover = false,
    variantWidth = 640,
    maxHeight,
    className,
    imgClassName,
    placeholderSrc,
    draggable,
    onLoad,
    style,
    ref,
    ...rest
}: ProgressiveImageProps) => {
    const imgRef = useRef<HTMLImageElement>(null)
    // Keyed by URL so a changed src starts over as loading.
    const [loadedSrc, setLoadedSrc] = useState<string | null>(null)
    const [failedSrc, setFailedSrc] = useState<string | null>(null)
    const dims = cover ? undefined : knownDimensions(width, height)

    let imgSrc: string
    let srcSet: string | undefined
    let sizes: string | undefined
    let boxStyle: React.CSSProperties | undefined
    if (cover) {
        imgSrc = imageVariantUrl(src, variantWidth)
    } else if (dims) {
        // Fixing the box to the original size (capped by the container and
        // maxHeight) reserves the space and keeps small images from being
        // stretched by srcset density maths.
        const cap = maxHeight ? `min(${dims.width}px, ${(maxHeight * dims.width) / dims.height}px)` : `${dims.width}px`
        imgSrc = dims.width > 1280 ? imageVariantUrl(src, 1280) : src
        srcSet = imageSrcSet(src, dims.width)
        sizes = `(max-width: ${dims.width}px) 100vw, ${dims.width}px`
        boxStyle = { width: cap, aspectRatio: `${dims.width} / ${dims.height}` }
    } else {
        // Unknown size: the API returns the original when it is narrower.
        imgSrc = imageVariantUrl(src, 1280)
    }

    const status = failedSrc === imgSrc ? "error" : loadedSrc === imgSrc ? "loaded" : "loading"
    const loading = status === "loading"

    useEffect(() => {
        // Cached images can finish loading before React attaches onLoad.
        const img = imgRef.current
        if (img?.complete && img.naturalWidth > 0) setLoadedSrc(imgSrc)
    }, [imgSrc])

    return (
        <span
            ref={ref}
            className={twMerge(
                "relative block max-w-full overflow-hidden",
                loading && !placeholderSrc && "animate-pulse bg-gray-200 dark:bg-neutral-800",
                !cover && !dims && status !== "loaded" && "w-full min-h-40",
                className,
            )}
            style={{ ...boxStyle, ...style }}
            {...rest}
        >
            {loading && placeholderSrc && (
                <img src={placeholderSrc} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" draggable={false} />
            )}
            {status === "error" ? (
                <span className="flex h-full min-h-24 w-full items-center justify-center bg-gray-100 text-gray-400 dark:bg-neutral-800 dark:text-neutral-500">
                    <ImageOff size={24} />
                </span>
            ) : (
                <img
                    ref={imgRef}
                    src={imgSrc}
                    srcSet={srcSet}
                    sizes={sizes}
                    alt={alt}
                    loading="lazy"
                    decoding="async"
                    draggable={draggable}
                    onLoad={(e) => {
                        setLoadedSrc(imgSrc)
                        onLoad?.(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)
                    }}
                    onError={() => setFailedSrc(imgSrc)}
                    className={twMerge(
                        "block transition-opacity duration-300",
                        cover || dims ? "h-full w-full" : "h-auto max-w-full",
                        cover && "object-cover",
                        !cover && !dims && maxHeight && "w-auto",
                        loading ? "opacity-0" : "opacity-100",
                        imgClassName,
                    )}
                    style={!cover && !dims && maxHeight ? { maxHeight } : undefined}
                />
            )}
        </span>
    )
}

export default ProgressiveImage
