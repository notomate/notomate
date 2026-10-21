export { Editor } from './editor/components/Editor';
export type { EditorProps } from './editor/components/Editor';

export type { BlockAction, BlockMenuEntry, BlockSpec, BlockComponentProps, PrefixRule } from './editor/blocks/registry';
export { BlockText, TextBlock, useListNumber } from './editor/components/BlockText';
export type { BlockTextProps } from './editor/components/BlockText';
export {
  allBlocks,
  bulletList,
  callout,
  codeBlock,
  divider,
  heading1,
  heading2,
  heading3,
  image,
  numberedList,
  paragraph,
  quote,
  todoList,
  toggleList,
} from './editor/blocks/builtins';
export {
  deleteBlocks,
  insertBlockAfter,
  insertFragment,
  setHtml,
  setProps,
  setPropsQuietly,
  toggleOpen,
  type Fragment,
} from './editor/ops';
export { selectBlocks } from './editor/model/store';
export { fragmentFromHtml, fragmentFromText } from './editor/clipboard';
export { sanitizeInline, textToHtml, htmlToText } from './editor/inline/sanitize';
export type { InlineSpan } from './editor/inline/spans';
export type { InlineTrigger, InlineTriggerItem } from './editor/triggers';
export { defaultMessages, type EditorMessages } from './editor/messages';

export type { Block, BlockProps, BlockType, Doc } from './editor/model/types';
export { createBlock, emptyDoc } from './editor/model/tree';
export { repairOrphans } from './editor/model/repair';
export { isDoc, sampleDoc } from './editor/model/doc';

export { useEditor, setDocument, undo, redo, applyRemote } from './editor/model/store';
export type { EditorState, RemoteUpdate } from './editor/model/store';

export { on } from './editor/events';
export type { ChangeOrigin, DocChange, PresenceState } from './editor/events';

export type { EditorApi, EditorPlugin, BlockDecorationProps, TransferContext } from './editor/plugins';

export { presence, broadcastChannelTransport, usePresence } from './plugins/presence';
export type { Peer, PeerInfo, PresenceConnection, PresenceOptions, PresenceTransport } from './plugins/presence';

export { collaboration, broadcastChannelSync, updateFromChange } from './plugins/collaboration';
export type {
  CollaborationConnection,
  CollaborationOptions,
  CollaborationTransport,
  DocUpdate,
} from './plugins/collaboration';
