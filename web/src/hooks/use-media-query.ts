import { useEffect, useState } from "react"

const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const mq = window.matchMedia(query)
    setMatches(mq.matches)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [query])

  return matches
}

/** True at Tailwind's `lg` breakpoint and above. */
export const useIsLg = () => useMediaQuery("(min-width: 1024px)")

export default useMediaQuery
