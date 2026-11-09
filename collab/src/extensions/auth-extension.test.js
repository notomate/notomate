import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AuthExtension } from './auth-extension.js'

const OWNER = 'owner'
const MEMBER = 'member'
const OUTSIDER = 'outsider'

const extension = (note, keyScope = '') =>
  new AuthExtension({
    db: {
      findNote: async () => note,
      findView: async () => note,
      isWorkspaceMember: async (userId) => userId === OWNER || userId === MEMBER,
      validateApiKey: async (key) => ({ id: key, name: key, disabled: false, scope: keyScope }),
    },
  })

async function connect(ext, userId, { publicPath = false, documentName = 'note:n1' } = {}) {
  const headers = new Headers({ 'x-public-access': String(publicPath) })
  if (userId) headers.set('authorization', `Bearer ${userId}`)
  const data = { requestHeaders: headers, documentName, connectionConfig: {}, context: {} }
  await ext.onConnect(data)
  return data.connectionConfig.readOnly === true ? 'read' : 'write'
}

const note = (visibility) => ({ visibility, workspace_id: 'w1', created_by: OWNER })

test('a private note opens only for its creator', async () => {
  const ext = extension(note('private'))
  assert.equal(await connect(ext, OWNER), 'write')
  await assert.rejects(connect(ext, MEMBER), /Access denied/)
  await assert.rejects(connect(ext, OUTSIDER), /Access denied/)
  await assert.rejects(connect(ext, null), /Access denied/)
})

test('a workspace note opens for members only', async () => {
  const ext = extension(note('workspace'))
  assert.equal(await connect(ext, MEMBER), 'write')
  await assert.rejects(connect(ext, OUTSIDER), /Access denied/)
  await assert.rejects(connect(ext, null), /Access denied/)
})

test('a public note is writable by members and read-only for everyone else', async () => {
  const ext = extension(note('public'))
  assert.equal(await connect(ext, MEMBER), 'write')
  assert.equal(await connect(ext, OUTSIDER), 'read')
  assert.equal(await connect(ext, null), 'read')
  assert.equal(await connect(ext, MEMBER, { publicPath: true }), 'read')
})

test('a private view stays open to workspace members, as in REST', async () => {
  const ext = extension(note('private'))
  assert.equal(await connect(ext, MEMBER, { documentName: 'whiteboard:v1' }), 'write')
})

test('key scopes cap what a connection can do', async () => {
  const workspaceNote = note('workspace')
  assert.equal(await connect(extension(workspaceNote, 'mcp:read'), MEMBER), 'read')
  assert.equal(await connect(extension(workspaceNote, 'mcp:write'), MEMBER), 'write')
  assert.equal(await connect(extension(workspaceNote, 'mcp:write'), MEMBER, { documentName: 'spreadsheet:v1' }), 'read')
  assert.equal(await connect(extension(workspaceNote), MEMBER, { documentName: 'spreadsheet:v1' }), 'write')
})
