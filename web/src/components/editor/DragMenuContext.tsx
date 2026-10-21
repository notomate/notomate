import { useEffect, useRef } from 'react'
import { registerNodeActions, useNodeBlockId, type MenuAction } from '@/components/noteeditor/nodeView'

export type { MenuAction }

/**
 * Register this node's own actions (Edit, Replace…) for the block menu: the drag
 * handle menu on desktop and the block sheet on touch devices. Delete, duplicate and
 * moving are provided by the editor for every block.
 */
export function useDragMenu(_getPos: unknown, getActions: () => MenuAction[]) {
  const id = useNodeBlockId()
  const getActionsRef = useRef(getActions)
  getActionsRef.current = getActions

  useEffect(() => {
    if (!id) return
    return registerNodeActions(id, () => getActionsRef.current())
  }, [id])
}

/** The editor's block sheet shows node actions on touch devices; nothing to render here. */
export function NodeTouchMenu(props: { visible: boolean; actions: MenuAction[] }) {
  void props
  return null
}
