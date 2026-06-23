import axios from 'axios';
import { Visibility } from '@/types/visibility';

export interface NoteData {
  id?: string;
  workspace_id?: string;
  parent_id?: string;
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
  title?: string;
  content: string;
  visibility?: Visibility;
}


export const getPublicNotes = async (pageNum: number, pageSize: number, query = '') => {
  const params = new URLSearchParams({ pageSize: String(pageSize), pageNumber: String(pageNum) });
  if (query) params.set('query', query);
  const response = await axios.get(`/api/v1/explore/notes?${params}`);
  return response.data;
};

export const getNotes = async (workspaceId: string, pageNum: number, pageSize: number, query: string, sort?: string, parentId?: string) => {
  const params = new URLSearchParams({ pageSize: String(pageSize), pageNumber: String(pageNum), query });
  if (sort) params.set('sort', sort);
  if (parentId !== undefined) params.set('parentId', parentId);
  const response = await axios.get(`/api/v1/workspaces/${workspaceId}/notes?${params}`, { withCredentials: true });
  return response.data;
};

export const getNote = async (workspaceId: string, noteId: string) => {
  const response = await axios.get(`/api/v1/workspaces/${workspaceId}/notes/${noteId}`, { withCredentials: true });
  return response.data;
};

export const createNote = async (workspaceId: string, data: NoteData) => {
  const response = await axios.post(`/api/v1/workspaces/${workspaceId}/notes`, data);
  return response.data;
};

export const updateNote = async (workspaceId: string, data: NoteData) => {
  const response = await axios.put(`/api/v1/workspaces/${workspaceId}/notes/${data.id}`, data);
  return response.data;
};

export const deleteNote = async (workspaceId: string, id: string) => {
  const response = await axios.delete(`/api/v1/workspaces/${workspaceId}/notes/${id}`);
  return response.data;
};

export const updateNoteVisibility = async (workspaceId: string, id: string, visibility: Visibility) => {
  const response = await axios.patch(`/api/v1/workspaces/${workspaceId}/notes/${id}/visibility/${visibility}`);
  return response.data;
}; 