import grpc from '@grpc/grpc-js'

const serialize = (value) => Buffer.from(JSON.stringify(value))
const deserialize = (buffer) => JSON.parse(buffer.toString())

function makeMethod(path) {
  return {
    path,
    requestStream: false,
    responseStream: false,
    requestSerialize: serialize,
    requestDeserialize: deserialize,
    responseSerialize: serialize,
    responseDeserialize: deserialize,
  }
}

const METHODS = {
  GetUser:             '/collab.CollabService/GetUser',
  ValidateAPIKey:      '/collab.CollabService/ValidateAPIKey',
  IsWorkspaceMember:   '/collab.CollabService/IsWorkspaceMember',
  GetNote:             '/collab.CollabService/GetNote',
  GetView:             '/collab.CollabService/GetView',
  UpdateNote:          '/collab.CollabService/UpdateNote',
  UpdateViewData:      '/collab.CollabService/UpdateViewData',
  GetViewObjects:      '/collab.CollabService/GetViewObjects',
  CreateViewObject:    '/collab.CollabService/CreateViewObject',
  UpdateViewObject:    '/collab.CollabService/UpdateViewObject',
  DeleteViewObject:    '/collab.CollabService/DeleteViewObject',
}

function createGrpcClient(address) {
  const rawClient = new grpc.Client(address, grpc.credentials.createInsecure())

  function call(methodPath, request) {
    return new Promise((resolve, reject) => {
      const method = makeMethod(methodPath)
      rawClient.makeUnaryRequest(
        method.path,
        method.requestSerialize,
        method.responseDeserialize,
        request,
        (err, response) => {
          if (err) reject(err)
          else resolve(response)
        }
      )
    })
  }

  /**
   * Returns a db-compatible interface used by auth-extension and database-extension.
   * All methods are async and mirror the old SQLite/Postgres db API.
   */
  return {
    // --- auth-extension ---

    async findUser(id) {
      const res = await call(METHODS.GetUser, { id })
      return res.found ? { id: res.id, name: res.name, disabled: res.disabled } : null
    },

    async validateApiKey(key) {
      const res = await call(METHODS.ValidateAPIKey, { key })
      return res.valid ? { id: res.user_id, name: res.user_name, disabled: res.disabled } : null
    },

    async isWorkspaceMember(userId, workspaceId) {
      const res = await call(METHODS.IsWorkspaceMember, { user_id: userId, workspace_id: workspaceId })
      return res.is_member
    },

    async findNote(id) {
      const res = await call(METHODS.GetNote, { id })
      return res.found
        ? {
            id: res.id,
            title: res.title,
            content: res.content,
            visibility: res.visibility,
            workspace_id: res.workspace_id,
            created_by: res.created_by,
          }
        : null
    },

    async findView(id) {
      const res = await call(METHODS.GetView, { id })
      return res.found
        ? {
            id: res.id,
            data: res.data,
            visibility: res.visibility,
            workspace_id: res.workspace_id,
            created_by: res.created_by,
          }
        : null
    },

    // --- database-extension ---

    async updateNote(id, { title, content, updated_at, updated_by }) {
      await call(METHODS.UpdateNote, { id, title, content, updated_at, updated_by })
    },

    async updateViewData(id, data, updated_at) {
      await call(METHODS.UpdateViewData, { id, data, updated_at })
    },

    async findViewObjectsByViewId(viewId) {
      const res = await call(METHODS.GetViewObjects, { view_id: viewId })
      return res.objects || []
    },

    async createViewObject({ id, view_id, name, type, data, created_by, updated_by, created_at, updated_at }) {
      await call(METHODS.CreateViewObject, {
        object: { id, view_id, name, type, data, created_by, updated_by, created_at, updated_at },
      })
    },

    async updateViewObject(id, { name, type, data, updated_by, updated_at }) {
      await call(METHODS.UpdateViewObject, { id, name, type, data, updated_by, updated_at })
    },

    async deleteViewObject(id) {
      await call(METHODS.DeleteViewObject, { id })
    },

    close() {
      rawClient.close()
    },
  }
}

export { createGrpcClient }
