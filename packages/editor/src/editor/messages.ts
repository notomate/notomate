/** UI text. Pass a partial override as `<Editor messages>` (e.g. from i18next). */
export const defaultMessages = {
  placeholder: "Type '/' for commands",
  untitled: 'Untitled',
  // slash menu
  blockTypes: 'Block types',
  basicBlocks: 'Basic blocks',
  noResults: 'No results',
  // gutter
  addBelow: 'Add a block below',
  dragHandle: 'Drag to move, click to open the menu',
  emptyToggle: 'Empty toggle. Click to add a block.',
  // block menu
  block: 'Block',
  selectedBlocks: (n: number) => (n === 1 ? '1 block selected' : `${n} blocks selected`),
  turnInto: 'Turn into',
  color: 'Color',
  textColor: 'Text color',
  backgroundColor: 'Background color',
  colorBackground: (color: string) => `${color} background`,
  duplicate: 'Duplicate',
  copy: 'Copy',
  moveUp: 'Move up',
  moveDown: 'Move down',
  indent: 'Indent',
  outdent: 'Outdent',
  delete: 'Delete',
  colors: {
    default: 'Default',
    gray: 'Gray',
    brown: 'Brown',
    orange: 'Orange',
    yellow: 'Yellow',
    green: 'Green',
    blue: 'Blue',
    purple: 'Purple',
    pink: 'Pink',
    red: 'Red',
  } as Record<string, string>,
  // format toolbar
  textFormat: 'Text formatting',
  bold: 'Bold (Ctrl+B)',
  italic: 'Italic (Ctrl+I)',
  underline: 'Underline (Ctrl+U)',
  strike: 'Strikethrough (Ctrl+Shift+S)',
  inlineCode: 'Inline code (Ctrl+E)',
  link: 'Link',
  linkShortcut: 'Link (Ctrl+K)',
  linkPlaceholder: 'Paste or type a link…',
  linkUrl: 'Link URL',
  apply: 'Apply',
  remove: 'Remove',
  removeLink: 'Remove link',
  cancel: 'Cancel',
  // mobile toolbar
  editTools: 'Editing tools',
  insertBlock: 'Insert block',
  selectBlock: 'Select block',
  undo: 'Undo',
  redo: 'Redo',
  done: 'Done',
  // built-in blocks: menu label, hint and placeholder
  paragraph: 'Text',
  paragraphHint: 'Plain text',
  heading1: 'Heading 1',
  heading1Hint: 'Large section heading',
  heading2: 'Heading 2',
  heading2Hint: 'Medium section heading',
  heading3: 'Heading 3',
  heading3Hint: 'Small section heading',
  bulletList: 'Bulleted list',
  bulletListHint: 'A simple bulleted list',
  numberedList: 'Numbered list',
  numberedListHint: 'A list with numbering',
  listPlaceholder: 'List',
  todoList: 'To-do list',
  todoListHint: 'Track tasks with checkboxes',
  todoPlaceholder: 'To-do',
  toggleList: 'Toggle list',
  toggleListHint: 'Collapsible content',
  togglePlaceholder: 'Toggle',
  quote: 'Quote',
  quoteHint: 'Capture a quote',
  callout: 'Callout',
  calloutHint: 'Make writing stand out',
  calloutPlaceholder: 'Type something…',
  code: 'Code',
  codeHint: 'Capture a code snippet',
  divider: 'Divider',
  dividerHint: 'Visually divide blocks',
  image: 'Image',
  imageHint: 'Upload or embed an image',
  // built-in block controls
  markDone: 'Mark as done',
  markUndone: 'Mark as not done',
  expand: 'Expand',
  collapse: 'Collapse',
  changeIcon: 'Change icon',
  uploadImage: 'Upload image',
  imageLinkPlaceholder: 'Or paste an image link…',
  imageLink: 'Image link',
  embed: 'Embed',
  // presence
  guest: 'Guest',
  peersOnline: (n: number) => (n === 1 ? '1 person online' : `${n} people online`),
  you: (name: string) => `${name} (you)`,
};

export type EditorMessages = typeof defaultMessages;

let current: EditorMessages = defaultMessages;

export function setMessages(overrides: Partial<EditorMessages> = {}) {
  current = { ...defaultMessages, ...overrides, colors: { ...defaultMessages.colors, ...overrides.colors } };
}

/** Current UI text. Read at render time; messages are installed once on mount. */
export const msg = (): EditorMessages => current;
