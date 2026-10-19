import { cloneElement, CSSProperties, HTMLAttributes, MouseEvent, ReactElement, useEffect, useRef, useState } from "react"
import { PhotoView } from "react-photo-view"
import { LoaderCircle } from "lucide-react"
import { twMerge } from "tailwind-merge"
import { knownDimensions, viewerImageUrl } from "@/lib/image"

interface ViewerImageProps {
    attrs: Partial<HTMLAttributes<HTMLElement>>
    scale: number
    screenSrc: string
    originalSrc: string
    placeholderSrc?: string
}

/**
 * The image inside the viewer, loaded in steps: the thumbnail already on the
 * page, then a copy sized to the screen, then the original once zoomed in.
 * Each step fades in over the previous one.
 */
const ViewerImage = ({ attrs, scale, screenSrc, originalSrc, placeholderSrc }: ViewerImageProps) => {
    const [loaded, setLoaded] = useState<Record<string, boolean>>({})
    const [zoomed, setZoomed] = useState(false)

    useEffect(() => {
        if (scale > 1) setZoomed(true)
    }, [scale])

    // The viewer animates object-fit while opening and closing.
    const objectFit = (attrs.style as CSSProperties | undefined)?.objectFit
    const layer = (src: string, fade = true) => (
        <img
            src={src}
            alt=""
            draggable={false}
            onLoad={() => setLoaded(prev => ({ ...prev, [src]: true }))}
            className={twMerge(
                "absolute inset-0 h-full w-full max-w-none",
                fade && "transition-opacity duration-300",
                fade && !loaded[src] && "opacity-0",
            )}
            style={{ objectFit }}
        />
    )

    return (
        <div {...attrs} className={twMerge("PhotoView__Photo relative", attrs.className)}>
            {placeholderSrc && layer(placeholderSrc, false)}
            {layer(screenSrc)}
            {zoomed && layer(originalSrc)}
            {!placeholderSrc && !loaded[screenSrc] && (
                <LoaderCircle size={32} className="absolute left-1/2 top-1/2 -ml-4 -mt-4 animate-spin text-white/70" />
            )}
        </div>
    )
}

interface ProgressivePhotoViewProps {
    src: string
    /** Original dimensions, when known. */
    width?: number | null
    height?: number | null
    children: ReactElement<{ onClick?: (e: MouseEvent<HTMLElement>) => void }>
}

/**
 * PhotoView that opens on a screen-sized copy of a workspace image instead of
 * the original. With known dimensions the original loads when zoomed in;
 * otherwise the screen-sized copy is all the viewer shows.
 */
const ProgressivePhotoView = ({ src, width, height, children }: ProgressivePhotoViewProps) => {
    const thumbRef = useRef<string>()
    const dims = knownDimensions(width, height)
    const screenSrc = viewerImageUrl(src, width, height)

    // The viewer needs the size up front to lay out a custom render.
    if (!dims || screenSrc === src) return <PhotoView src={screenSrc}>{children}</PhotoView>

    const onClick = (e: MouseEvent<HTMLElement>) => {
        // Reuse the thumbnail as the first step when it has finished loading.
        const img = e.currentTarget.querySelector("img")
        thumbRef.current = img?.complete && img.naturalWidth > 0 ? img.currentSrc : undefined
        children.props.onClick?.(e)
    }

    return (
        <PhotoView
            width={dims.width}
            height={dims.height}
            render={({ attrs, scale }) => (
                <ViewerImage
                    attrs={attrs}
                    scale={scale}
                    screenSrc={screenSrc}
                    originalSrc={src}
                    placeholderSrc={thumbRef.current}
                />
            )}
        >
            {cloneElement(children, { onClick })}
        </PhotoView>
    )
}

export default ProgressivePhotoView
