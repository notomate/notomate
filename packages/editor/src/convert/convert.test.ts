// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { BLOCK_ID_ATTR, docToTiptap, parseTiptap, tiptapToDoc } from './index';
import { htmlToInline, htmlToPlain, inlineToHtml } from './inline';
import type { TipTapNode } from './types';

const p = (text: string, marks?: TipTapNode['marks']): TipTapNode => ({
  type: 'paragraph',
  content: [marks ? { type: 'text', text, marks } : { type: 'text', text }],
});
const cell = (type: string, text: string): TipTapNode => ({
  type,
  attrs: { colspan: 1, rowspan: 1, colwidth: null },
  content: [p(text)],
});

/** One of every block the web editor produces (mirrors runner/workflow_examples/tiptap-blocks-demo.yml). */
const FIXTURE: TipTapNode = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Heading 1' }] },
    { type: 'heading', attrs: { level: 5 }, content: [{ type: 'text', text: 'Heading 5' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', marks: [{ type: 'bold' }], text: 'Bold ' },
        { type: 'text', marks: [{ type: 'italic' }], text: 'Italic ' },
        { type: 'text', marks: [{ type: 'strike' }], text: 'Strike ' },
        { type: 'text', marks: [{ type: 'code' }], text: 'Code ' },
        { type: 'text', marks: [{ type: 'underline' }], text: 'Underline ' },
        { type: 'text', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }], text: 'Link' },
        { type: 'hardBreak' },
        { type: 'text', marks: [{ type: 'comment', attrs: { threadId: 't1' } }, { type: 'bold' }], text: 'a < b & c' },
        { type: 'mention', attrs: { id: 'u1', label: 'Zoë', mentionSuggestionChar: '@' } },
      ],
    },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [p('Bullet 1'), { type: 'bulletList', content: [{ type: 'listItem', content: [p('Nested')] }] }],
        },
        {
          type: 'listItem',
          content: [
            p('Bullet 2'),
            { type: 'details', attrs: { open: false }, content: [{ type: 'detailsSummary' }, { type: 'detailsContent' }] },
          ],
        },
      ],
    },
    {
      type: 'orderedList',
      attrs: { start: 3, type: null },
      content: [
        { type: 'listItem', content: [p('Ordered 3')] },
        { type: 'listItem', content: [p('Ordered 4')] },
      ],
    },
    {
      type: 'taskList',
      content: [
        { type: 'taskItem', attrs: { checked: false }, content: [p('Todo')] },
        { type: 'taskItem', attrs: { checked: true }, content: [p('Done')] },
      ],
    },
    { type: 'blockquote', content: [p('Quote'), p('Second line')] },
    {
      type: 'details',
      attrs: { open: true },
      content: [
        { type: 'detailsSummary', content: [{ type: 'text', text: 'Toggle' }] },
        {
          type: 'detailsContent',
          content: [
            p('Inside'),
            { type: 'bulletList', content: [{ type: 'listItem', content: [p('Toggle bullet')] }] },
          ],
        },
      ],
    },
    { type: 'codeBlock', attrs: { language: 'javascript' }, content: [{ type: 'text', text: 'if (a < b) {\n  go();\n}' }] },
    { type: 'horizontalRule' },
    {
      type: 'table',
      content: [
        { type: 'tableRow', content: [cell('tableHeader', 'Col A'), cell('tableHeader', 'Col B')] },
        { type: 'tableRow', content: [cell('tableCell', 'A1'), cell('tableCell', 'B1')] },
      ],
    },
    { type: 'image', attrs: { src: '/api/v1/workspaces/demo/files/example.png', name: 'example.png', width: 640, height: 480, uploadId: null } },
    { type: 'video', attrs: { src: '/f/example.mp4', name: 'example.mp4' } },
    { type: 'audio', attrs: { src: '/f/example.mp3', name: 'example.mp3' } },
    { type: 'attachment', attrs: { src: '/f/example.pdf', name: 'example.pdf' } },
    {
      type: 'carouselNode',
      attrs: { items: [{ src: '/f/a.png', name: 'a.png', type: 'image' }, { src: '/f/b.mp4', name: 'b.mp4', type: 'video' }] },
    },
    { type: 'youtubeEmbed', attrs: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } },
    { type: 'threadsEmbed', attrs: { url: 'https://www.threads.net/@example/post/123' } },
    { type: 'instagramEmbed', attrs: { url: 'https://www.instagram.com/p/example/' } },
    { type: 'tiktokEmbed', attrs: { url: 'https://www.tiktok.com/@example/video/123' } },
    { type: 'calendarNode', attrs: { date: '2026-07-15', title: 'Team sync', description: 'Weekly planning' } },
    { type: 'locationNode', attrs: { lat: 25.033, lng: 121.5654, name: 'Taipei 101', address: 'Taipei', zoom: 15 } },
    { type: 'tagsNode', attrs: { tags: ['work', 'urgent'] } },
    { type: 'ratingNode', attrs: { rating: 4, maxRating: 5, label: 'Overall' } },
    { type: 'subPage', attrs: { noteId: 'n1', title: 'Sub note' } },
    { type: 'viewNode', attrs: { viewId: 'v1', viewType: 'kanban', name: 'Board' } },
    { type: 'googleMapNode', attrs: { title: 'Trip', center: { lat: 1, lng: 2 }, zoom: 13, markers: [{ lat: 1, lng: 2 }], route: null } },
    { type: 'googlePlacesNode', attrs: { query: 'coffee', places: [], fetchedAt: null } },
    { type: 'googleDirectionsNode', attrs: { waypoints: [], travelMode: 'DRIVE', optimize: false, result: null, alternatives: [] } },
    { type: 'paragraph' },
  ],
};

describe('inline', () => {
  it('round-trips marks, breaks, mentions and escaping', () => {
    const nodes = (FIXTURE.content![2].content ?? []) as TipTapNode[];
    const html = inlineToHtml(nodes);
    expect(html).toContain('<a href="https://example.com">Link</a><br>');
    expect(html).toContain('<span data-comment-thread-id="t1"><b>a &lt; b &amp; c</b></span>');
    expect(htmlToInline(html)).toEqual(nodes);
  });

  it('accepts the tags browsers produce and unwraps unknown ones', () => {
    expect(htmlToInline('<strong>x</strong><em>y</em><del>z</del><font>w</font>&nbsp;')).toEqual([
      { type: 'text', text: 'x', marks: [{ type: 'bold' }] },
      { type: 'text', text: 'y', marks: [{ type: 'italic' }] },
      { type: 'text', text: 'z', marks: [{ type: 'strike' }] },
      { type: 'text', text: 'w ' },
    ]);
  });

  it('drops unsafe links but keeps their text', () => {
    expect(htmlToInline('<a href="javascript:alert(1)">x</a>')).toEqual([{ type: 'text', text: 'x' }]);
  });

  it('keeps editor text colors as a textColor mark', () => {
    const nodes = htmlToInline('<span data-color="red">hot</span>');
    expect(nodes).toEqual([{ type: 'text', text: 'hot', marks: [{ type: 'textColor', attrs: { color: 'red' } }] }]);
    expect(inlineToHtml(nodes)).toBe('<span data-color="red">hot</span>');
  });
});

/** `node` without the block ids `docToTiptap` stores. */
const stripIds = (node: TipTapNode): TipTapNode => {
  const out: TipTapNode = { ...node };
  if (out.attrs && BLOCK_ID_ATTR in out.attrs) {
    const { [BLOCK_ID_ATTR]: _id, ...attrs } = out.attrs;
    if (Object.keys(attrs).length) out.attrs = attrs;
    else delete out.attrs;
  }
  if (out.content) out.content = out.content.map(stripIds);
  return out;
};

describe('tiptapToDoc / docToTiptap', () => {
  it('reproduces every node type the app stores', () => {
    expect(stripIds(docToTiptap(tiptapToDoc(FIXTURE)))).toEqual(FIXTURE);
  });

  it('keeps block ids through storage', () => {
    const doc = tiptapToDoc(FIXTURE);
    const again = tiptapToDoc(docToTiptap(doc));
    expect(again.rootIds).toEqual(doc.rootIds);
    expect(again.blocks).toEqual(doc.blocks);
  });

  it('replaces missing, malformed and repeated block ids', () => {
    const withId = (id: unknown, text: string): TipTapNode => ({ ...p(text), attrs: { [BLOCK_ID_ATTR]: id } });
    const doc = tiptapToDoc({
      type: 'doc',
      content: [withId('keep', 'a'), withId('keep', 'b'), withId('__proto__', 'c'), withId(7, 'd'), p('e')],
    });
    expect(doc.rootIds[0]).toBe('keep');
    expect(new Set(doc.rootIds).size).toBe(5);
    expect(doc.rootIds.map((id) => doc.blocks[id].html)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('does not leak the block id into atom props', () => {
    const doc = tiptapToDoc({ type: 'doc', content: [{ type: 'tagsNode', attrs: { tags: ['x'], [BLOCK_ID_ATTR]: 'tags1' } }] });
    expect(doc.rootIds).toEqual(['tags1']);
    expect(doc.blocks.tags1.props).toEqual({ tags: ['x'] });
  });

  it('is stable on repeated conversion', () => {
    const once = docToTiptap(tiptapToDoc(FIXTURE));
    expect(docToTiptap(tiptapToDoc(once))).toEqual(once);
  });

  it('maps lists to nested blocks', () => {
    const doc = tiptapToDoc(FIXTURE, 'T');
    expect(doc.title).toBe('T');
    const bullets = doc.rootIds.map((id) => doc.blocks[id]).filter((b) => b.type === 'bullet');
    expect(bullets.map((b) => b.html)).toEqual(['Bullet 1', 'Bullet 2']);
    const nested = doc.blocks[bullets[0].children[0]];
    expect(nested).toMatchObject({ type: 'bullet', html: 'Nested', parentId: bullets[0].id });
    const todos = doc.rootIds.map((id) => doc.blocks[id]).filter((b) => b.type === 'todo');
    expect(todos.map((b) => b.props.checked)).toEqual([false, true]);
  });

  it('maps toggles to collapsible blocks with nested children', () => {
    const doc = tiptapToDoc(FIXTURE);
    const toggles = Object.values(doc.blocks).filter((b) => b.type === 'toggle');
    expect(toggles.map((b) => [b.html, b.props.open])).toEqual([['', false], ['Toggle', true]]);
    expect(doc.blocks[toggles[0].parentId!]).toMatchObject({ type: 'bullet', html: 'Bullet 2' });
    const [inside, list] = toggles[1].children.map((id) => doc.blocks[id]);
    expect(inside).toMatchObject({ type: 'paragraph', html: 'Inside', parentId: toggles[1].id });
    expect(list).toMatchObject({ type: 'bullet', html: 'Toggle bullet', parentId: toggles[1].id });
  });

  it('keeps atom attrs as props and code as escaped plain text', () => {
    const doc = tiptapToDoc(FIXTURE);
    const byType = (t: string) => Object.values(doc.blocks).find((b) => b.type === t)!;
    expect(byType('ratingNode').props).toEqual({ rating: 4, maxRating: 5, label: 'Overall' });
    expect(byType('code')).toMatchObject({ html: 'if (a &lt; b) {\n  go();\n}', props: { language: 'javascript' } });
    expect(byType('table').props.rows).toHaveLength(2);
  });

  it('splits adjacent lists of different types and flattens nested paragraphs', () => {
    const doc = tiptapToDoc({ type: 'doc', content: [p('parent')] });
    const parent = doc.blocks[doc.rootIds[0]];
    const child = { ...parent, id: 'child', html: 'child', parentId: parent.id, children: [] };
    doc.blocks.child = child;
    doc.blocks[parent.id] = { ...parent, children: ['child'] };
    expect(stripIds(docToTiptap(doc)).content).toEqual([p('parent'), p('child')]);
  });

  it('reads lines Chrome wrapped in <div> as code newlines', () => {
    expect(htmlToPlain('a<div>b</div><div><br></div><div>c</div>')).toBe('a\nb\n\nc');
    expect(htmlToPlain('<div>a</div><div>b</div>')).toBe('a\nb');
    expect(htmlToPlain('a<br>b\nc')).toBe('a\nb\nc');
  });

  it('produces a single empty paragraph for an empty document', () => {
    const doc = tiptapToDoc({ type: 'doc', content: [] });
    expect(doc.rootIds).toHaveLength(1);
    expect(stripIds(docToTiptap(doc))).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
  });

  it('passes unknown container nodes through untouched', () => {
    const custom: TipTapNode = { type: 'doc', content: [{ type: 'columns', attrs: { n: 2 }, content: [p('x')] }] };
    expect(stripIds(docToTiptap(tiptapToDoc(custom)))).toEqual(custom);
  });
});

describe('parseTiptap', () => {
  it('strips empty text nodes', () => {
    const { doc } = parseTiptap(JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }] }));
    expect(doc).toEqual({ type: 'doc', content: [{ type: 'paragraph', content: [] }] });
  });

  it('recovers the first object from duplicated content', () => {
    const one = JSON.stringify({ type: 'doc', content: [p('a')] });
    expect(parseTiptap(one + one).doc).toEqual({ type: 'doc', content: [p('a')] });
  });

  it('reports unreadable content', () => {
    expect(parseTiptap('{not json').error).toBe(true);
    expect(parseTiptap('').error).toBe(false);
  });
});
