import { useLayoutEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Columns3, Rows3, Trash2 } from 'lucide-react'
import { sanitizeInline } from '@notomate/editor'
import { useDragMenu } from '@/components/editor/DragMenuContext'
import { NodeViewWrapper, type NodeViewProps } from './nodeView'

/** A cell as stored in `props.rows` (see the TipTap converter). */
interface Cell {
  html: string
  header: boolean
  attrs?: Record<string, unknown>
}

const emptyCell = (header = false): Cell => ({ html: '', header })

function readRows(value: unknown): Cell[][] {
  if (!Array.isArray(value)) return []
  return value.map((row) =>
    Array.isArray(row)
      ? row.map((c) => ({
          html: typeof c?.html === 'string' ? c.html : '',
          header: !!c?.header,
          ...(c?.attrs && typeof c.attrs === 'object' ? { attrs: c.attrs } : {}),
        }))
      : [],
  )
}

/**
 * One editable cell. Uncontrolled while focused so typing never fights the store;
 * saved on blur (one undo step per cell edit, and one update for collaborators).
 */
function CellView({ cell, onSave }: { cell: Cell; onSave: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const html = sanitizeInline(cell.html)
  useLayoutEffect(() => {
    const el = ref.current
    if (el && document.activeElement !== el && el.innerHTML !== html) el.innerHTML = html
  }, [html])
  const Tag = cell.header ? 'th' : 'td'
  return (
    <Tag>
      <div
        ref={ref}
        className="table-cell-text"
        contentEditable
        suppressContentEditableWarning
        data-ne-native=""
        onBlur={(e) => {
          const next = sanitizeInline(e.currentTarget.innerHTML)
          if (next !== html) onSave(next)
        }}
        onKeyDown={(e) => {
          // Enter is a line break inside a cell; Escape leaves it.
          if (e.key === 'Escape') e.currentTarget.blur()
          e.stopPropagation()
        }}
      />
    </Tag>
  )
}

export function TableComponent({ node, updateAttributes }: NodeViewProps) {
  const { t } = useTranslation()
  const rows = readRows(node.attrs.rows)
  const cols = Math.max(1, ...rows.map((r) => r.length))
  const save = (next: Cell[][]) => updateAttributes({ rows: next })

  const addRow = () => save([...rows, Array.from({ length: cols }, () => emptyCell())])
  const addColumn = () => save(rows.map((r, i) => [...r, emptyCell(i === 0 && r.every((c) => c.header))]))
  const deleteRow = () => rows.length > 1 && save(rows.slice(0, -1))
  const deleteColumn = () => cols > 1 && save(rows.map((r) => r.slice(0, -1)))

  useDragMenu(undefined, () => [
    { label: t('editor.table.addRow'), icon: <Rows3 size={14} />, onClick: addRow },
    { label: t('editor.table.addColumn'), icon: <Columns3 size={14} />, onClick: addColumn },
    ...(rows.length > 1 ? [{ label: t('editor.table.deleteRow'), icon: <Trash2 size={14} />, onClick: deleteRow }] : []),
    ...(cols > 1 ? [{ label: t('editor.table.deleteColumn'), icon: <Trash2 size={14} />, onClick: deleteColumn }] : []),
  ])

  return (
    <NodeViewWrapper className="note-table">
      <div className="note-table-scroll">
        <table>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <CellView
                    key={c}
                    cell={cell}
                    onSave={(html) => save(rows.map((rr, i) => (i === r ? rr.map((cc, j) => (j === c ? { ...cc, html } : cc)) : rr)))}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="note-table-add">
        <button type="button" onClick={addRow}>+ {t('editor.table.addRow')}</button>
        <button type="button" onClick={addColumn}>+ {t('editor.table.addColumn')}</button>
      </div>
    </NodeViewWrapper>
  )
}

/** Cells of a pasted HTML table. */
export function rowsFromTable(table: Element): Cell[][] {
  return Array.from(table.querySelectorAll('tr')).map((tr) =>
    Array.from(tr.children)
      .filter((c) => c.tagName === 'TD' || c.tagName === 'TH')
      .map((c) => ({ html: sanitizeInline(c.innerHTML), header: c.tagName === 'TH' })),
  )
}

/** A 3×3 table, as the old slash command inserted. Never mutated, so it can be shared. */
export const NEW_TABLE_ROWS: Cell[][] = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => emptyCell()))
