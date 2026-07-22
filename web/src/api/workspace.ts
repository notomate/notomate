import axios from 'axios';

interface WorkspaceData {
  id?: string;
  name: string;
  description?: string;
}

export const createWorkspace = async (data: WorkspaceData) => {
  const response = await axios.post('/api/v1/workspaces', {
    name: data.name,
    description: data.description,
  });
  return response.data as WorkspaceData;
};

export const getWorkspace = async (id: string) => {
  const response = await axios.get(`/api/v1/workspaces/${id}`);
  return response.data;
};

export const getWorkspaces = async () => {
  const response = await axios.get('/api/v1/workspaces', { withCredentials: true });
  return response.data;
};

export const updateWorkspace = async (id: string, data: WorkspaceData) => {
  const response = await axios.put(`/api/v1/workspaces/${id}`, {
    withCredentials: true,
    name: data.name,
  });
  return response.data;
};

export const deleteWorkspace = async (id: string) => {
  const response = await axios.delete(`/api/v1/workspaces/${id}`, { withCredentials: true });
  return response.data;
};

// Workspace Members Management

export interface WorkspaceMember {
  workspace_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  user_avatar_url?: string;
  role: 'owner' | 'admin' | 'user';
  created_at: string;
}

export interface InviteMemberRequest {
  email: string;
  role: 'admin' | 'user';
}

export interface UpdateMemberRoleRequest {
  role: 'admin' | 'user';
}

export const getWorkspaceMembers = async (workspaceId: string) => {
  const response = await axios.get(`/api/v1/workspaces/${workspaceId}/members`, {
    withCredentials: true
  });
  return response.data as WorkspaceMember[];
};

export const inviteMember = async (workspaceId: string, data: InviteMemberRequest) => {
  const response = await axios.post(`/api/v1/workspaces/${workspaceId}/members`, data, {
    withCredentials: true
  });
  return response.data as WorkspaceMember;
};

export const updateMemberRole = async (workspaceId: string, userId: string, data: UpdateMemberRoleRequest) => {
  const response = await axios.patch(`/api/v1/workspaces/${workspaceId}/members/${userId}/role`, data, {
    withCredentials: true
  });
  return response.data as WorkspaceMember;
};

export const removeMember = async (workspaceId: string, userId: string) => {
  const response = await axios.delete(`/api/v1/workspaces/${workspaceId}/members/${userId}`, {
    withCredentials: true
  });
  return response.data;
};