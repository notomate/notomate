import axios from 'axios';

export interface ChannelData {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  created_at: string;
  created_by: string;
  updated_at: string;
}

export const getChannels = async (workspaceId: string) => {
  const response = await axios.get(`/api/v1/workspaces/${workspaceId}/channels`, { withCredentials: true });
  return response.data as ChannelData[];
};

export const createChannel = async (workspaceId: string, data: { name: string; description?: string }) => {
  const response = await axios.post(`/api/v1/workspaces/${workspaceId}/channels`, {
    name: data.name,
    description: data.description ?? '',
  });
  return response.data as ChannelData;
};

export const updateChannel = async (workspaceId: string, channelId: string, data: { name: string; description?: string }) => {
  const response = await axios.put(`/api/v1/workspaces/${workspaceId}/channels/${channelId}`, {
    name: data.name,
    description: data.description ?? '',
  });
  return response.data as ChannelData;
};

export const deleteChannel = async (workspaceId: string, channelId: string) => {
  const response = await axios.delete(`/api/v1/workspaces/${workspaceId}/channels/${channelId}`);
  return response.data;
};
