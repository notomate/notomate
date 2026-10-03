import { useState } from 'react'
import { StoredRoute } from './types'

// Lets read-only views switch between stored alternatives without editing
// the note. Resets when the stored route changes.
export const useRouteChoice = (result: StoredRoute | null, alternatives?: StoredRoute[] | null) => {
  const [choice, setChoice] = useState<{ source: StoredRoute | null; route: StoredRoute } | null>(null)
  const current = choice?.source === result ? choice.route : null
  if (!result || !current || !alternatives?.length) {
    return { result, alternatives: alternatives ?? null, select: (r: StoredRoute) => setChoice({ source: result, route: r }) }
  }
  const all = [result, ...alternatives]
  return {
    result: current,
    alternatives: all.filter(r => r !== current),
    select: (r: StoredRoute) => setChoice({ source: result, route: r }),
  }
}
