import axios from 'axios';
import { NoteData } from '@/api/note';

export interface NoteLocation {
  source: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export interface SearchNote extends NoteData {
  tags: string[];
  locations: NoteLocation[];
}

export interface SearchNotesResult {
  notes: SearchNote[];
  /** Notes not indexed yet: recent edits may be missing from keyword/tag/location results. */
  pending: number;
}

export interface SearchNotesParams {
  query?: string;
  tags?: string[];
  tagMode?: 'all' | 'any';
  /** [minLng, minLat, maxLng, maxLat]; minLng > maxLng crosses the antimeridian. */
  bbox?: [number, number, number, number];
  creatorId?: string;
  sort?: 'created_at' | 'updated_at';
  pageNumber: number;
  pageSize: number;
}

export const searchNotes = async (workspaceId: string, p: SearchNotesParams): Promise<SearchNotesResult> => {
  const params = new URLSearchParams({ pageSize: String(p.pageSize), pageNumber: String(p.pageNumber) });
  if (p.query) params.set('q', p.query);
  if (p.tags?.length) params.set('tags', p.tags.join(','));
  if (p.tagMode) params.set('tagMode', p.tagMode);
  if (p.bbox) params.set('bbox', p.bbox.join(','));
  if (p.creatorId) params.set('creatorId', p.creatorId);
  if (p.sort) params.set('sort', p.sort);
  const response = await axios.get(`/api/v1/workspaces/${workspaceId}/search?${params}`, { withCredentials: true });
  return response.data;
};

export interface TagCount {
  tag: string;
  count: number;
}

export const getSearchTags = async (workspaceId: string, prefix = '', limit = 200): Promise<TagCount[]> => {
  const params = new URLSearchParams({ limit: String(limit) });
  if (prefix) params.set('prefix', prefix);
  const response = await axios.get(`/api/v1/workspaces/${workspaceId}/search/tags?${params}`, { withCredentials: true });
  return response.data;
};
