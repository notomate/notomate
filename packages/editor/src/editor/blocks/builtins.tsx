import type { BlockSpec, BlockComponentProps } from './registry';
import { BlockText, TextBlock, useListNumber } from '../components/BlockText';
import { ImageBlock } from '../components/blocks/ImageBlock';
import { setProps, toggleOpen } from '../ops';
import { msg } from '../messages';

const BULLETS = ['•', '◦', '▪'];
const CALLOUT_ICONS = ['💡', '📌', '⚠️', '✅', '❗', '📝', '🔥', '💬'];

function toAlpha(n: number) {
  let s = '';
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(97 + ((n - 1) % 26)) + s;
  return s;
}

function toRoman(n: number) {
  const map: [number, string][] = [[10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
  let s = '';
  for (const [v, r] of map) for (; n >= v; n -= v) s += r;
  return s;
}

/** Always installed; pass your own spec with type "paragraph" to replace it. */
export const paragraph: BlockSpec = {
  type: 'paragraph',
  component: TextBlock,
  menu: {
    get label() {
      return msg().paragraph;
    },
    get hint() {
      return msg().paragraphHint;
    },
    icon: 'text',
    keywords: 'text paragraph plain',
  },
};

function heading(level: 1 | 2 | 3, keywords: string, inputRule: RegExp, pasteRule: RegExp): BlockSpec {
  const type = `h${level}`;
  return {
    type,
    component: ({ block }) => (
      <div className={`text ${type}`}>
        <BlockText block={block} />
      </div>
    ),
    menu: {
      get label() {
        return msg()[`heading${level}`];
      },
      get hint() {
        return msg()[`heading${level}Hint`];
      },
      icon: `H${level}`,
      keywords,
    },
    get placeholder() {
      return msg()[`heading${level}`];
    },
    inputRules: [{ pattern: inputRule }],
    pasteRules: [{ pattern: pasteRule }],
    parseHtml: { tags: level === 3 ? ['H3', 'H4'] : [`H${level}`] },
    toMarkdown: (_b, text) => `${'#'.repeat(level)} ${text}`,
    toHtml: (b) => `<${type}>${b.html}</${type}>`,
  };
}

export const heading1 = heading(1, 'heading1 title h1', /^#\s$/, /^#\s+/);
export const heading2 = heading(2, 'heading2 subtitle h2', /^##\s$/, /^##\s+/);
export const heading3 = heading(3, 'heading3 h3', /^###\s$/, /^###\s+/);

export const bulletList: BlockSpec = {
  type: 'bullet',
  component: ({ block, depth }) => (
    <div className="text list">
      <span className="marker bullet" contentEditable={false}>{BULLETS[depth % 3]}</span>
      <BlockText block={block} />
    </div>
  ),
  menu: {
    get label() {
      return msg().bulletList;
    },
    get hint() {
      return msg().bulletListHint;
    },
    icon: 'bullet',
    keywords: 'list ul unordered bullet',
  },
  get placeholder() {
    return msg().listPlaceholder;
  },
  continues: true,
  exitOnEmpty: true,
  inputRules: [{ pattern: /^[-*+]\s$/ }],
  pasteRules: [{ pattern: /^\s*[-*+•]\s+/ }],
  parseHtml: { tags: ['LI'], match: (el) => el.parentElement?.tagName !== 'OL' },
  toMarkdown: (_b, text) => `- ${text}`,
  toHtml: (b) => `<p>• ${b.html}</p>`,
};

function NumberedItem({ block, depth }: BlockComponentProps) {
  const n = useListNumber(block.id);
  const label = depth % 3 === 0 ? String(n) : depth % 3 === 1 ? toAlpha(n) : toRoman(n);
  return (
    <div className="text list">
      <span className="marker number" contentEditable={false}>{label}.</span>
      <BlockText block={block} />
    </div>
  );
}

export const numberedList: BlockSpec = {
  type: 'numbered',
  component: NumberedItem,
  menu: {
    get label() {
      return msg().numberedList;
    },
    get hint() {
      return msg().numberedListHint;
    },
    icon: 'numbered',
    keywords: 'list ol ordered numbered',
  },
  get placeholder() {
    return msg().listPlaceholder;
  },
  continues: true,
  exitOnEmpty: true,
  inputRules: [{ pattern: /^\d+[.)]\s$/ }],
  pasteRules: [{ pattern: /^\s*\d+[.)]\s+/ }],
  parseHtml: { tags: ['LI'], match: (el) => el.parentElement?.tagName === 'OL' },
  toMarkdown: (_b, text, n) => `${n}. ${text}`,
};

export const todoList: BlockSpec = {
  type: 'todo',
  component: ({ block }) => {
    const checked = !!block.props.checked;
    return (
      <div className={`text list todo ${checked ? 'checked' : ''}`}>
        <span className="marker" contentEditable={false}>
          <button
            type="button"
            className={`checkbox ${checked ? 'on' : ''}`}
            aria-label={checked ? msg().markUndone : msg().markDone}
            onClick={() => setProps([block.id], { checked: !checked })}
          >
            {checked && (
              <svg viewBox="0 0 14 14" aria-hidden="true">
                <path d="M5.5 10.5 2 7l1.2-1.2 2.3 2.3 5.3-5.3L12 4z" fill="currentColor" />
              </svg>
            )}
          </button>
        </span>
        <BlockText block={block} />
      </div>
    );
  },
  menu: {
    get label() {
      return msg().todoList;
    },
    get hint() {
      return msg().todoListHint;
    },
    icon: 'todo',
    keywords: 'task check checkbox todo',
  },
  props: { checked: false },
  get placeholder() {
    return msg().todoPlaceholder;
  },
  continues: true,
  exitOnEmpty: true,
  inputRules: [
    { pattern: /^\[\s?\]\s$/, props: { checked: false } },
    { pattern: /^\[x\]\s$/i, props: { checked: true } },
  ],
  pasteRules: [
    { pattern: /^\s*[-*+]\s+\[\s\]\s+/, props: { checked: false } },
    { pattern: /^\s*[-*+]\s+\[x\]\s+/i, props: { checked: true } },
  ],
  onModEnter: (b) => setProps([b.id], { checked: !b.props.checked }),
  toMarkdown: (b, text) => `- [${b.props.checked ? 'x' : ' '}] ${text}`,
  toHtml: (b) => `<p>${b.props.checked ? '☑' : '☐'} ${b.html}</p>`,
};

export const toggleList: BlockSpec = {
  type: 'toggle',
  component: ({ block }) => (
    <div className="text list">
      <span className="marker" contentEditable={false}>
        <button
          type="button"
          className={`toggle-arrow ${block.props.open ? 'open' : ''}`}
          aria-label={block.props.open ? msg().collapse : msg().expand}
          aria-expanded={!!block.props.open}
          onClick={() => toggleOpen(block.id)}
        >
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M4 2.5 8.5 6 4 9.5z" fill="currentColor" />
          </svg>
        </button>
      </span>
      <BlockText block={block} />
    </div>
  ),
  menu: {
    get label() {
      return msg().toggleList;
    },
    get hint() {
      return msg().toggleListHint;
    },
    icon: 'toggle',
    keywords: 'toggle collapse expand',
  },
  props: { open: true },
  get placeholder() {
    return msg().togglePlaceholder;
  },
  collapsible: true,
  exitOnEmpty: true,
  inputRules: [{ pattern: /^>\s$/, props: { open: true } }],
  onModEnter: (b) => toggleOpen(b.id),
  toMarkdown: (_b, text) => `- ${text}`,
};

export const quote: BlockSpec = {
  type: 'quote',
  component: ({ block }) => (
    <div className="text quote">
      <BlockText block={block} />
    </div>
  ),
  menu: {
    get label() {
      return msg().quote;
    },
    get hint() {
      return msg().quoteHint;
    },
    icon: 'quote',
    keywords: 'blockquote quote',
  },
  get placeholder() {
    return msg().quote;
  },
  exitOnEmpty: true,
  inputRules: [{ pattern: /^["“”]\s$/ }],
  pasteRules: [{ pattern: /^>\s?/ }],
  parseHtml: { tags: ['BLOCKQUOTE'] },
  toMarkdown: (_b, text) => `> ${text}`,
  toHtml: (b) => `<blockquote>${b.html}</blockquote>`,
};

export const callout: BlockSpec = {
  type: 'callout',
  component: ({ block }) => {
    const icon = block.props.icon ?? '💡';
    return (
      <div className="text callout-row">
        <button
          type="button"
          className="callout-icon"
          aria-label={msg().changeIcon}
          onClick={() => {
            const i = CALLOUT_ICONS.indexOf(icon);
            setProps([block.id], { icon: CALLOUT_ICONS[(i + 1) % CALLOUT_ICONS.length] });
          }}
        >
          {icon}
        </button>
        <BlockText block={block} />
      </div>
    );
  },
  menu: {
    get label() {
      return msg().callout;
    },
    get hint() {
      return msg().calloutHint;
    },
    icon: 'callout',
    keywords: 'callout note info',
  },
  props: { icon: '💡' },
  get placeholder() {
    return msg().calloutPlaceholder;
  },
  exitOnEmpty: true,
  toMarkdown: (b, text) => `> ${b.props.icon ?? ''} ${text}`,
};

export const codeBlock: BlockSpec = {
  type: 'code',
  component: ({ block }) => (
    <div className="code-wrap">
      <span className="code-lang" contentEditable={false}>Code</span>
      <BlockText block={block} className="code" placeholder="" />
    </div>
  ),
  menu: {
    get label() {
      return msg().code;
    },
    get hint() {
      return msg().codeHint;
    },
    icon: 'code',
    keywords: 'code snippet pre',
  },
  content: 'plain',
  inputRules: [{ pattern: /^```$/ }],
  parseHtml: { tags: ['PRE'] },
  toMarkdown: (_b, text) => '```\n' + text + '\n```',
  toHtml: (b) => `<pre>${b.html}</pre>`,
};

export const divider: BlockSpec = {
  type: 'divider',
  component: () => (
    <div className="divider-row">
      <hr />
    </div>
  ),
  menu: {
    get label() {
      return msg().divider;
    },
    get hint() {
      return msg().dividerHint;
    },
    icon: 'divider',
    keywords: 'divider hr line separator',
  },
  content: 'none',
  trailingParagraph: true,
  inputRules: [{ pattern: /^---$/ }],
  pasteRules: [{ pattern: /^\s*(-{3,}|\*{3,})\s*$/ }],
  parseHtml: { tags: ['HR'] },
  toMarkdown: () => '---',
  toHtml: () => '<hr>',
};

export const image: BlockSpec = {
  type: 'image',
  component: ImageBlock,
  menu: {
    get label() {
      return msg().image;
    },
    get hint() {
      return msg().imageHint;
    },
    icon: 'image',
    keywords: 'image picture photo img',
  },
  content: 'none',
  turnInto: false,
  toMarkdown: (b) => (b.props.src && !b.props.src.startsWith('data:') ? `![](${b.props.src})` : '[image]'),
  toHtml: (b) => `<img src="${b.props.src ?? ''}">`,
};

/** Every built-in block type, in menu order. */
export const allBlocks: readonly BlockSpec[] = [
  paragraph,
  heading1,
  heading2,
  heading3,
  bulletList,
  numberedList,
  todoList,
  toggleList,
  quote,
  callout,
  codeBlock,
  divider,
  image,
];
