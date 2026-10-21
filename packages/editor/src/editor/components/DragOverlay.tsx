import { useDragView } from '../dnd/useBlockDrag';

export function DragOverlay() {
  const { indicator, ghost } = useDragView();
  return (
    <>
      {indicator && (
        <div
          className="ui-layer drop-indicator"
          style={{ top: indicator.top, left: indicator.left, width: indicator.width }}
        />
      )}
      {ghost && (
        <div className="ui-layer drag-ghost" style={{ transform: `translate(${ghost.x + 12}px, ${ghost.y + 8}px)` }}>
          <span className="ghost-label">{ghost.label}</span>
          {ghost.count > 1 && <span className="ghost-count">{ghost.count}</span>}
        </div>
      )}
    </>
  );
}
