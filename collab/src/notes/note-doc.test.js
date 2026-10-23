import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as Y from 'yjs'
import { LEGACY_KEY, LEGACY_MAP, migrateLegacyContent, readNoteContent, seedNoteDoc } from './note-doc.js'

const p = (text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })
const tiptap = (...content) => ({ type: 'doc', content })
const note = (content, title = 'T') => ({ title, content: JSON.stringify(content) })
/** Stored note content without the block ids it carries. */
const stored = (doc) =>
  JSON.parse(readNoteContent(doc), (key, value) => {
    if (key !== 'attrs' || !value || !('blockId' in value)) return value
    const { blockId, ...attrs } = value
    return Object.keys(attrs).length ? attrs : undefined
  })

test('a seeded room stores the same TipTap JSON it was loaded from', () => {
  const content = tiptap({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Hi' }] }, p('body'))
  const doc = new Y.Doc()
  seedNoteDoc(doc, note(content))
  assert.equal(doc.getMap('meta').get('title'), 'T')
  assert.equal(doc.getMap('blocks').size, 2)
  assert.deepEqual(stored(doc), content)
})

test('seeding twice keeps the live room as it is', () => {
  const doc = new Y.Doc()
  seedNoteDoc(doc, note(tiptap(p('one'))))
  seedNoteDoc(doc, note(tiptap(p('two')), 'Other'))
  assert.deepEqual(stored(doc), tiptap(p('one')))
  assert.equal(doc.getMap('meta').get('title'), 'T')
})

test('an unseeded room has nothing to store', () => {
  assert.equal(readNoteContent(new Y.Doc()), null)
})

test('empty or broken stored content opens as one empty paragraph', () => {
  for (const content of ['', '{broken']) {
    const doc = new Y.Doc()
    seedNoteDoc(doc, { title: '', content })
    assert.deepEqual(stored(doc), tiptap({ type: 'paragraph' }))
  }
})

test('a legacy content.data write replaces the blocks and is removed', () => {
  const doc = new Y.Doc()
  seedNoteDoc(doc, note(tiptap(p('old'))))
  doc.getMap(LEGACY_MAP).set(LEGACY_KEY, JSON.stringify(tiptap(p('from MCP'), p('second'))))
  assert.equal(migrateLegacyContent(doc), true)
  assert.equal(doc.getMap(LEGACY_MAP).has(LEGACY_KEY), false)
  assert.deepEqual(stored(doc), tiptap(p('from MCP'), p('second')))
  assert.equal(migrateLegacyContent(doc), false)
})

test('edits to different blocks from two clients both survive', () => {
  const server = new Y.Doc()
  seedNoteDoc(server, note(tiptap(p('a'), p('b'))))
  const a = new Y.Doc()
  const b = new Y.Doc()
  Y.applyUpdate(a, Y.encodeStateAsUpdate(server))
  Y.applyUpdate(b, Y.encodeStateAsUpdate(server))

  const [idA, idB] = a.getMap('meta').get('rootIds')
  const edit = (doc, id, text) => doc.getMap('blocks').set(id, { ...doc.getMap('blocks').get(id), html: text })
  edit(a, idA, 'a edited by A')
  edit(b, idB, 'b edited by B')

  for (const d of [a, b]) Y.applyUpdate(server, Y.encodeStateAsUpdate(d))
  assert.deepEqual(stored(server), tiptap(p('a edited by A'), p('b edited by B')))
})

test('a block whose list entry lost a concurrent write is still stored', () => {
  const doc = new Y.Doc()
  seedNoteDoc(doc, note(tiptap(p('a'))))
  const [first] = doc.getMap('meta').get('rootIds')
  // A block reached the map but its rootIds update was overwritten by a collaborator.
  doc.getMap('blocks').set('orphan', { id: 'orphan', type: 'paragraph', html: 'kept', props: {}, children: [], parentId: null })
  assert.deepEqual(doc.getMap('meta').get('rootIds'), [first])
  assert.deepEqual(stored(doc), tiptap(p('a'), p('kept')))
})

test('a client that outlives its room does not duplicate the note when it reconnects', () => {
  const first = new Y.Doc()
  seedNoteDoc(first, note(tiptap(p('a'), p('b'))))
  const client = new Y.Doc()
  Y.applyUpdate(client, Y.encodeStateAsUpdate(first))

  // The room is unloaded (or the server restarts) and is re-seeded from storage.
  const second = new Y.Doc()
  seedNoteDoc(second, { title: 'T', content: readNoteContent(first) })
  Y.applyUpdate(second, Y.encodeStateAsUpdate(client))

  assert.equal(second.getMap('blocks').size, 2)
  assert.deepEqual(stored(second), tiptap(p('a'), p('b')))
})
