import { test } from 'node:test'
import assert from 'node:assert/strict'
import { docToMarkdown, markdownToBlocks } from './markdown.js'

const parse = (markdown) => {
  const doc = markdownToBlocks(markdown)
  return { doc, roots: doc.rootIds.map((id) => doc.blocks[id]) }
}

test('common block types parse to editor blocks', () => {
  const { roots } = parse('# Title\n\nSome text\n\n- one\n- two\n\n1. first\n\n- [x] done\n\n> quoted\n\n---\n\n```js\nlet a = 1 < 2\n```')
  assert.deepEqual(
    roots.map((b) => b.type),
    ['h1', 'paragraph', 'bullet', 'bullet', 'numbered', 'todo', 'quote', 'divider', 'code'],
  )
  assert.equal(roots[5].props.checked, true)
  assert.equal(roots[8].props.language, 'js')
  assert.equal(roots[8].html, 'let a = 1 &lt; 2')
})

test('inline marks become the editor\'s inline HTML', () => {
  const { roots } = parse('**b** *i* ~~s~~ `c<d` [l](https://example.com)')
  assert.equal(roots[0].html, '<b>b</b> <i>i</i> <s>s</s> <code>c&lt;d</code> <a href="https://example.com">l</a>')
})

test('raw HTML and unsafe links are neutralized', () => {
  assert.equal(parse('<img src=x onerror=alert(1)> text').roots[0].html.includes('<img'), false)
  assert.equal(parse('<script>alert(1)</script>').roots[0].html.includes('<script'), false)
  assert.equal(parse('[x](javascript:alert(1))').roots[0].html, 'x')
})

test('nested lists keep their structure', () => {
  const { doc, roots } = parse('- parent\n  - child\n- next')
  assert.equal(roots.length, 2)
  assert.equal(roots[0].children.length, 1)
  const child = doc.blocks[roots[0].children[0]]
  assert.equal(child.html, 'child')
  assert.equal(child.parentId, roots[0].id)
})

test('tables become rows with a header', () => {
  const { roots } = parse('| a | b |\n| --- | --- |\n| 1 | **2** |')
  assert.equal(roots[0].type, 'table')
  assert.equal(roots[0].props.rows[0][0].header, true)
  assert.equal(roots[0].props.rows[1][1].html, '<b>2</b>')
})

test('block id markers pasted back are ignored', () => {
  assert.equal(parse('<!--b:abc123--> hello').roots[0].html, 'hello')
})

test('headings deeper than the editor supports are clamped', () => {
  assert.equal(parse('##### deep').roots[0].type, 'h3')
})

test('Markdown survives a round trip through blocks', () => {
  const source = '# Title\n\nSome **bold** text\n\n- one\n- two\n\n> quoted\n\n---'
  assert.equal(docToMarkdown(markdownToBlocks(source)), source)
})

test('markers identify each block when rendering for editing', () => {
  const doc = markdownToBlocks('hello')
  assert.equal(docToMarkdown(doc, { blockIds: true }), `<!--b:${doc.rootIds[0]}--> hello`)
})

test('custom blocks render as a labelled placeholder', () => {
  const doc = { rootIds: ['m'], blocks: { m: { id: 'm', type: 'googlemap', html: '', props: {}, children: [], parentId: null } } }
  assert.equal(docToMarkdown(doc), '[embedded googlemap block]')
})

test('literal characters are escaped and identifiers left alone', () => {
  const doc = { rootIds: ['p'], blocks: { p: { id: 'p', type: 'paragraph', html: '2 * 3 and snake_case and _x_', props: {}, children: [], parentId: null } } }
  assert.equal(docToMarkdown(doc), '2 \\* 3 and snake_case and \\_x\\_')
})
