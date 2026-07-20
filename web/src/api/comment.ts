import axios from 'axios';

export interface CommentData {
  id: string;
  note_id: string;
  thread_id: string;
  quoted_text: string;
  body: string;
  edited: boolean;
  created_at: string;
  created_by: string;
  created_by_name: string;
  created_by_avatar_url: string;
  updated_at: string;
}

export const getComments = async (workspaceId: string, noteId: string) => {
  const response = await axios.get(`/api/v1/workspaces/${workspaceId}/notes/${noteId}/comments`, { withCredentials: true });
  return response.data as CommentData[];
};

export const createComment = async (workspaceId: string, noteId: string, data: { threadId?: string; quotedText?: string; body: string }) => {
  const response = await axios.post(`/api/v1/workspaces/${workspaceId}/notes/${noteId}/comments`, {
    thread_id: data.threadId,
    quoted_text: data.quotedText,
    body: data.body,
  });
  return response.data as CommentData;
};

export const updateComment = async (workspaceId: string, noteId: string, id: string, body: string) => {
  const response = await axios.put(`/api/v1/workspaces/${workspaceId}/notes/${noteId}/comments/${id}`, { body });
  return response.data as CommentData;
};

export const deleteComment = async (workspaceId: string, noteId: string, id: string) => {
  const response = await axios.delete(`/api/v1/workspaces/${workspaceId}/notes/${noteId}/comments/${id}`);
  return response.data;
};
