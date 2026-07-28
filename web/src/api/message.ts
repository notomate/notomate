import axios from 'axios';

export interface MessageData {
  id: string;
  channel_id: string;
  body: string;
  edited: boolean;
  created_at: string;
  created_by: string;
  created_by_name: string;
  created_by_avatar_url: string;
  updated_at: string;
}

export const getMessages = async (workspaceId: string, channelId: string) => {
  const response = await axios.get(`/api/v1/workspaces/${workspaceId}/channels/${channelId}/messages`, { withCredentials: true });
  return response.data as MessageData[];
};

export const createMessage = async (workspaceId: string, channelId: string, body: string) => {
  const response = await axios.post(`/api/v1/workspaces/${workspaceId}/channels/${channelId}/messages`, { body });
  return response.data as MessageData;
};

export const updateMessage = async (workspaceId: string, channelId: string, id: string, body: string) => {
  const response = await axios.put(`/api/v1/workspaces/${workspaceId}/channels/${channelId}/messages/${id}`, { body });
  return response.data as MessageData;
};

export const deleteMessage = async (workspaceId: string, channelId: string, id: string) => {
  const response = await axios.delete(`/api/v1/workspaces/${workspaceId}/channels/${channelId}/messages/${id}`);
  return response.data;
};
