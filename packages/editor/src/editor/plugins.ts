import type { ComponentType } from 'react';
import type { BlockSpec } from './blocks/registry';
import type { Doc } from './model/types';
import { applyRemote, localPresence, useEditor } from './model/store';
import { on, type PresenceState } from './events';
import type { InlineSpan } from './inline/spans';
import type { InlineTrigger } from './triggers';

/** What a plugin can reach while the editor is mounted. */
export interface EditorApi {
  getDoc(): Doc;
  /** Subscribe to `change` / `presence` events. Returns an unsubscribe function. */
  on: typeof on;
  /** Apply a collaborator's changes (not recorded in undo history). */
  applyRemote: typeof applyRemote;
  /** Where this user's caret / block selection currently is. */
  localPresence(): PresenceState;
}

export interface BlockDecorationProps {
  blockId: string;
}

export interface EditorPlugin {
  /** Unique name, also used as a React key. */
  name: string;
  /** Block types this plugin adds; installed before the editor's own `blocks`. */
  blocks?: readonly BlockSpec[];
  /** Runs after mount. Return a cleanup function to run on unmount. */
  setup?: (editor: EditorApi) => void | (() => void);
  /** Rendered once inside the editor page (bars, floating UI). */
  Overlay?: ComponentType;
  decorations?: {
    /** Rendered inside each block, covering it and its children. */
    block?: ComponentType<BlockDecorationProps>;
    /** Rendered inside each block's own row (its text line, without children). */
    row?: ComponentType<BlockDecorationProps>;
  };
  /** Extra `<span>` kinds kept in block text (beyond colour, comment and mention). */
  inline?: readonly InlineSpan[];
  /** Suggestion lists opened by a typed character, e.g. `@` for mentions. */
  inlineTriggers?: readonly InlineTrigger[];
  /**
   * Clipboard paste into a block (text editing or block selection), after the editor's
   * own copied blocks are handled. Return true to take it over, e.g. to upload pasted
   * files or convert Markdown; plugins run in order until one returns true.
   */
  onPaste?: (data: DataTransfer, ctx: TransferContext) => boolean;
  /** Files or content dropped onto a block's text. Return true when handled. */
  onDrop?: (data: DataTransfer, ctx: TransferContext) => boolean;
}

export interface TransferContext {
  /** The block pasted or dropped into; insert new blocks after it. */
  blockId: string;
  /** The block holds plain text (code), so rich content should become text. */
  plain: boolean;
}

/** Offer a paste or drop to plugins; true when one of them handled it. */
export function runTransfer(kind: 'onPaste' | 'onDrop', data: DataTransfer, ctx: TransferContext): boolean {
  return plugins.some((p) => {
    try {
      return p[kind]?.(data, ctx) === true;
    } catch (err) {
      console.error(`[editor] ${p.name}.${kind} failed`, err);
      return false;
    }
  });
}

let plugins: readonly EditorPlugin[] = [];

export function setPlugins(list: readonly EditorPlugin[]) {
  plugins = list;
}

export const getPlugins = () => plugins;

export const editorApi: EditorApi = {
  getDoc: () => useEditor.getState().doc,
  on,
  applyRemote,
  localPresence,
};
