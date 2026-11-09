import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as Y from 'yjs'
import { applyBlockOps, BlockEditError, readNote } from './blocks.js'

const block = (id, type, html, extra = {}) => ({ id, type, html, props: {}, children: [], parentId: null, ...extra })

function room(...blocks) {
  const doc = new Y.Doc()
  const map = doc.getMap('blocks')
  doc.transact(() => {
    for (const b of blocks) map.set(b.id, b)
    doc.getMap('meta').set('rootIds', blocks.filter((b) => !b.parentId).map((b) => b.id))
  })
  return doc
}

const texts = (doc) => {
  const note = readNote(doc)
  return note.rootIds.map((id) => note.blocks[id].html)
}

test('insert after a block, at the start, and at the end', () => {
  const doc = room(block('a', 'paragraph', 'A'), block('b', 'paragraph', 'B'))
  applyBlockOps(doc, [
    { op: 'insert', after_block_id: 'a', markdown: 'after a' },
    { op: 'insert', position: 'start', markdown: 'first' },
    { op: 'insert', markdown: 'last' },
  ])
  assert.deepEqual(texts(doc), ['first', 'A', 'after a', 'B', 'last'])
})

test('inserting after a nested block stays under its parent', () => {
  const doc = room(block('p', 'bullet', 'P', { children: ['c'] }), block('c', 'bullet', 'C', { parentId: 'p' }))
  applyBlockOps(doc, [{ op: 'insert', after_block_id: 'c', markdown: 'sibling' }])
  const { blocks } = readNote(doc)
  assert.equal(blocks.p.children.length, 2)
  assert.equal(blocks[blocks.p.children[1]].html, 'sibling')
  assert.equal(blocks[blocks.p.children[1]].parentId, 'p')
})

test('replacing with plain text keeps the block type and children', () => {
  const doc = room(block('h', 'h2', 'Old', { children: ['c'] }), block('c', 'paragraph', 'C', { parentId: 'h' }))
  applyBlockOps(doc, [{ op: 'replace', block_id: 'h', markdown: 'New' }])
  const { blocks } = readNote(doc)
  assert.equal(blocks.h.type, 'h2')
  assert.equal(blocks.h.html, 'New')
  assert.deepEqual(blocks.h.children, ['c'])
})

test('replacing with typed Markdown changes the type', () => {
  const doc = room(block('a', 'paragraph', 'A'))
  applyBlockOps(doc, [{ op: 'replace', block_id: 'a', markdown: '# Heading' }])
  assert.equal(readNote(doc).blocks.a.type, 'h1')
})

test('replacing with several blocks keeps the id on the first', () => {
  const doc = room(block('a', 'paragraph', 'A'), block('z', 'paragraph', 'Z'))
  applyBlockOps(doc, [{ op: 'replace', block_id: 'a', markdown: 'one\n\ntwo' }])
  assert.deepEqual(texts(doc), ['one', 'two', 'Z'])
  assert.equal(readNote(doc).rootIds[0], 'a')
})

test('a nested list in a replacement is stored', () => {
  const doc = room(block('a', 'paragraph', 'A'))
  applyBlockOps(doc, [{ op: 'replace', block_id: 'a', markdown: '- top\n  - inner' }])
  const { blocks } = readNote(doc)
  assert.equal(blocks.a.type, 'bullet')
  assert.equal(blocks[blocks.a.children[0]].html, 'inner')
  assert.equal(blocks[blocks.a.children[0]].parentId, 'a')
})

test('embedded blocks cannot be replaced but can be deleted', () => {
  const doc = room(block('m', 'googlemap', ''), block('a', 'paragraph', 'A'))
  assert.throws(() => applyBlockOps(doc, [{ op: 'replace', block_id: 'm', markdown: 'x' }]), BlockEditError)
  applyBlockOps(doc, [{ op: 'delete', block_id: 'm' }])
  assert.deepEqual(texts(doc), ['A'])
})

test('deleting a block removes its nested blocks', () => {
  const doc = room(block('p', 'bullet', 'P', { children: ['c'] }), block('c', 'bullet', 'C', { parentId: 'p' }), block('a', 'paragraph', 'A'))
  applyBlockOps(doc, [{ op: 'delete', block_id: 'p' }])
  assert.deepEqual(Object.keys(readNote(doc).blocks), ['a'])
})

test('deleting the last block leaves one empty paragraph', () => {
  const doc = room(block('a', 'paragraph', 'A'))
  applyBlockOps(doc, [{ op: 'delete', block_id: 'a' }])
  const note = readNote(doc)
  assert.equal(note.rootIds.length, 1)
  assert.equal(note.blocks[note.rootIds[0]].type, 'paragraph')
  assert.equal(note.blocks[note.rootIds[0]].html, '')
})

test('a batch with an invalid operation changes nothing', () => {
  const doc = room(block('a', 'paragraph', 'A'))
  let updates = 0
  doc.on('update', () => updates++)
  assert.throws(
    () =>
      applyBlockOps(doc, [
        { op: 'replace', block_id: 'a', markdown: 'changed' },
        { op: 'delete', block_id: 'missing' },
      ]),
    /does not exist/,
  )
  assert.equal(updates, 0)
  assert.deepEqual(texts(doc), ['A'])
})

test('an edit leaves other blocks alone, so concurrent edits to them survive', () => {
  const server = room(block('a', 'paragraph', 'A'), block('b', 'paragraph', 'B'))
  const agent = new Y.Doc()
  const human = new Y.Doc()
  Y.applyUpdate(agent, Y.encodeStateAsUpdate(server))
  Y.applyUpdate(human, Y.encodeStateAsUpdate(server))

  applyBlockOps(agent, [{ op: 'replace', block_id: 'a', markdown: 'from agent' }])
  human.getMap('blocks').set('b', block('b', 'paragraph', 'from human'))

  Y.applyUpdate(server, Y.encodeStateAsUpdate(agent))
  Y.applyUpdate(server, Y.encodeStateAsUpdate(human))
  assert.deepEqual(texts(server), ['from agent', 'from human'])
})
