import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { redo, requestFocus, setDocument, setTitle, startPresenceEvents, undo, useEditor } from '../model/store';
import { emptyDoc } from '../model/tree';
import { setBlocks, type BlockSpec } from '../blocks/registry';
import { paragraph } from '../blocks/builtins';
import { BlockView } from './BlockView';
import { SlashMenu } from './SlashMenu';
import { TriggerMenu } from './TriggerMenu';
import { setTriggers } from '../triggers';
import { setInlineSpans } from '../inline/spans';
import { FormatToolbar } from './FormatToolbar';
import { BlockMenu } from './BlockMenu';
import { MobileToolbar } from './MobileToolbar';
import { DragOverlay } from './DragOverlay';
import { useMarquee } from '../selection/useMarquee';
import { useTextToBlockDrag } from '../selection/useTextToBlockDrag';
import { onSinkCopy, onSinkKeyDown, onSinkPaste } from '../selection/blockKeyboard';
import { placeCaretAtX, selectRange, setCaret } from '../inline/caret';
import { insertBlockAfter } from '../ops';
import { isTextBlock, type Doc } from '../model/types';
import { isCoarsePointer } from '../input/pointer';
import { editorApi, getPlugins, setPlugins, type EditorPlugin } from '../plugins';
import { msg, setMessages, type EditorMessages } from '../messages';

function useFocusRequests() {
  const req = useEditor((s) => s.focusReq);
  useLayoutEffect(() => {
    if (!req) return;
    const el = document.querySelector<HTMLElement>(`[data-editable-id="${req.id}"]`);
    if (!el) return;
    el.focus({ preventScroll: true });
    const at = req.at;
    if (typeof at === 'object' && 'x' in at) placeCaretAtX(el, at.x, at.line);
    else if (typeof at === 'object') selectRange(el, at.start, at.end);
    else setCaret(el, at);
    const r = el.getBoundingClientRect();
    const vh = window.visualViewport?.height ?? window.innerHeight;
    if (r.top < 0 || r.bottom > vh - 48) el.scrollIntoView({ block: 'nearest' });
  }, [req]);
}

function useOnChange(onChange: ((doc: Doc) => void) | undefined) {
  const ref = useRef(onChange);
  ref.current = onChange;
  useEffect(() => useEditor.subscribe((s, prev) => s.doc !== prev.doc && ref.current?.(s.doc)), []);
}

/** Global undo/redo, including the browser's own Edit menu / context menu. */
function useHistoryKeys() {
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'z' || k === 'y') {
        const target = e.target as HTMLElement;
        // Fields with their own undo: form inputs, and areas a block marks with data-ne-native
        // (e.g. editable table cells).
        if (target.matches('input, textarea:not(.selection-sink)') || target.closest('[data-ne-native]')) return;
        e.preventDefault();
        if (k === 'y' || e.shiftKey) redo();
        else undo();
      }
    };
    const before = (e: InputEvent) => {
      if (e.inputType === 'historyUndo' || e.inputType === 'historyRedo') {
        e.preventDefault();
        if (e.inputType === 'historyUndo') undo();
        else redo();
      }
    };
    window.addEventListener('keydown', key, true);
    document.addEventListener('beforeinput', before);
    return () => {
      window.removeEventListener('keydown', key, true);
      document.removeEventListener('beforeinput', before);
    };
  }, []);
}

/**
 * Block selection needs keyboard + clipboard events without a caret, so focus moves
 * to a hidden textarea (inputmode=none keeps the on-screen keyboard closed on touch).
 */
function SelectionSink() {
  const ref = useRef<HTMLTextAreaElement>(null);
  const count = useEditor((s) => s.selection.ids.length);
  const menuOpen = useEditor((s) => !!s.blockMenu);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (count) {
      const active = document.activeElement as HTMLElement | null;
      if (!active?.closest('[data-editable-id], input, .page-title')) el.focus({ preventScroll: true });
    } else if (document.activeElement === el) {
      el.blur();
    }
  }, [count, menuOpen]);
  return (
    <textarea
      ref={ref}
      className="selection-sink"
      aria-hidden="true"
      tabIndex={-1}
      inputMode="none"
      value=""
      onChange={() => {}}
      onKeyDown={onSinkKeyDown}
      onCopy={(e) => onSinkCopy(e)}
      onCut={(e) => onSinkCopy(e, true)}
      onPaste={onSinkPaste}
    />
  );
}

function PageTitle() {
  const title = useEditor((s) => s.doc.title);
  const ref = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    const el = ref.current!;
    if (el.textContent !== title) el.textContent = title;
    el.dataset.empty = String(!title);
  }, [title]);
  const focusFirst = () => {
    const doc = useEditor.getState().doc;
    const first = doc.rootIds.find((id) => isTextBlock(doc.blocks[id]));
    if (first && first === doc.rootIds[0]) requestFocus(first, 'start');
    else insertBlockAfter(null);
  };
  return (
    <h1
      ref={ref}
      className="page-title"
      contentEditable
      suppressContentEditableWarning
      data-placeholder={msg().untitled}
      spellCheck
      onInput={(e) => {
        const el = e.currentTarget;
        el.dataset.empty = String(!el.textContent);
        setTitle(el.textContent ?? '');
      }}
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing) return;
        if (e.key === 'Enter' || e.key === 'ArrowDown') {
          e.preventDefault();
          focusFirst();
        }
      }}
      onPaste={(e) => {
        e.preventDefault();
        document.execCommand('insertText', false, e.clipboardData.getData('text/plain').replace(/\s+/g, ' '));
      }}
    />
  );
}

export interface EditorProps {
  /** Initial document, read once on mount. Change the component `key` to load another one. */
  defaultDoc?: Doc;
  /** Called with the new document after every change (local edits, undo/redo, remote). */
  onChange?: (doc: Doc) => void;
  /**
   * Block types to offer, in menu order. `paragraph` is always included. Read once on
   * mount. Blocks of types not listed here render as plain text.
   */
  blocks?: readonly BlockSpec[];
  /** Plugins, e.g. `presence(...)`. Read once on mount. */
  plugins?: readonly EditorPlugin[];
  /** Render the editable page title (`doc.title`). Default true; turn off when the host owns the title. */
  showTitle?: boolean;
  /**
   * `light` / `dark`, `inherit` (default: dark under an ancestor `.dark` or `[data-theme=dark]`),
   * or `system` (follow the OS setting).
   */
  theme?: 'light' | 'dark' | 'inherit' | 'system';
  /** UI text overrides, e.g. from your i18n library. Read once on mount. */
  messages?: Partial<EditorMessages>;
  /** Extra class on the editor root, for layout overrides such as `.page-column` padding. */
  className?: string;
}

let mounted = 0;

/**
 * The editor keeps its state in a module-level store, so mount one at a time and give
 * it a `key` per document (e.g. the note id) to load another one.
 */
export function Editor({
  defaultDoc,
  onChange,
  blocks = [],
  plugins = [],
  showTitle = true,
  theme = 'inherit',
  messages,
  className = '',
}: EditorProps) {
  // Install before the first store read below so the initial render uses them.
  useState(() => {
    setMessages(messages);
    setPlugins(plugins);
    setTriggers(plugins.flatMap((p) => p.inlineTriggers ?? []));
    setInlineSpans(plugins.flatMap((p) => p.inline ?? []));
    setBlocks([paragraph, ...plugins.flatMap((p) => p.blocks ?? []), ...blocks]);
    setDocument(defaultDoc ?? emptyDoc());
  });
  useEffect(() => {
    if (++mounted > 1) console.error('[editor] Only one <Editor> can be mounted at a time; they share one store.');
    return () => {
      mounted--;
    };
  }, []);
  const rootIds = useEditor((s) => s.doc.rootIds);
  const dragging = useEditor((s) => s.dragging);
  const pageRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [coarse, setCoarse] = useState(isCoarsePointer);

  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    const on = () => setCoarse(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  useFocusRequests();
  useOnChange(onChange);
  useHistoryKeys();
  useMarquee(pageRef, boxRef);
  useEffect(() => startPresenceEvents(), []);
  useEffect(() => {
    const cleanups = getPlugins().map((p) => p.setup?.(editorApi));
    return () => cleanups.forEach((c) => c?.());
  }, []);
  useTextToBlockDrag();

  return (
    <div
      ref={pageRef}
      className={`ne-root ${coarse ? 'coarse' : 'fine'} ${dragging ? 'dragging' : ''} ${className}`}
      data-theme={theme}
    >
      <main className="page-column">
        {showTitle && <PageTitle />}
        <div className="blocks" role="document">
          {rootIds.map((id) => (
            <BlockView key={id} id={id} depth={0} />
          ))}
        </div>
        <div className="page-bottom" aria-hidden="true" />
      </main>
      <div ref={boxRef} className="marquee" aria-hidden="true" />
      {getPlugins().map((p) => p.Overlay && <p.Overlay key={p.name} />)}
      <SelectionSink />
      <SlashMenu />
      <TriggerMenu />
      <FormatToolbar />
      <BlockMenu />
      <DragOverlay />
      {coarse && <MobileToolbar />}
    </div>
  );
}
