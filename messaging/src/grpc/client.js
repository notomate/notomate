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
  GetUser:                  '/messaging.MessagingService/GetUser',
  ValidateAPIKey:           '/messaging.MessagingService/ValidateAPIKey',
  IsWorkspaceMember:        '/messaging.MessagingService/IsWorkspaceMember',
  GetChannel:               '/messaging.MessagingService/GetChannel',
  CreateMessage:            '/messaging.MessagingService/CreateMessage',
  NotifyRoomCreated:        '/messaging.MessagingService/NotifyRoomCreated',
  NotifyClientConnected:    '/messaging.MessagingService/NotifyClientConnected',
  NotifyClientDisconnected: '/messaging.MessagingService/NotifyClientDisconnected',
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

  return {
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

    async getChannel(id) {
      const res = await call(METHODS.GetChannel, { id })
      return res.found ? { id: res.id, workspace_id: res.workspace_id, name: res.name } : null
    },

    async createMessage(workspaceId, channelId, body, userId) {
      return call(METHODS.CreateMessage, {
        workspace_id: workspaceId,
        channel_id: channelId,
        body,
        user_id: userId,
      })
    },

    async notifyRoomCreated(channelId, userId) {
      await call(METHODS.NotifyRoomCreated, { channel_id: channelId, user_id: userId })
    },

    async notifyClientConnected(channelId, userId) {
      await call(METHODS.NotifyClientConnected, { channel_id: channelId, user_id: userId })
    },

    async notifyClientDisconnected(channelId, userId) {
      await call(METHODS.NotifyClientDisconnected, { channel_id: channelId, user_id: userId })
    },

    close() {
      rawClient.close()
    },
  }
}

export { createGrpcClient }
