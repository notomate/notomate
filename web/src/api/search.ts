import axios from 'axios';
import { NoteData, type NoteListFilterParams } from '@/api/note';

export interface NoteLocation {
  source: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

/** A calendar block's day, YYYY-MM-DD. */
export interface NoteEvent {
  date: string;
  title: string;
}

export interface SearchNote extends NoteData {
  tags: string[];
  locations: NoteLocation[];
  events: NoteEvent[];
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
  /** Only pinned notes. */
  pinned?: boolean;
  /** Sort, block types and date range, as for the note list endpoints. */
  filters?: NoteListFilterParams;
  pageNumber: number;
  pageSize: number;
}

const searchParams = (p: SearchNotesParams) => {
  const params = new URLSearchParams({ pageSize: String(p.pageSize), pageNumber: String(p.pageNumber) });
  if (p.query) params.set('q', p.query);
  if (p.tags?.length) params.set('tags', p.tags.join(','));
  if (p.tagMode) params.set('tagMode', p.tagMode);
  if (p.bbox) params.set('bbox', p.bbox.join(','));
  if (p.creatorId) params.set('creatorId', p.creatorId);
  if (p.pinned) params.set('pinned', 'true');
  for (const [key, value] of Object.entries(p.filters ?? {})) {
    if (value) params.set(key, value);
  }
  return params;
};

export const searchNotes = async (workspaceId: string, p: SearchNotesParams): Promise<SearchNotesResult> => {
  const response = await axios.get(`/api/v1/workspaces/${workspaceId}/search?${searchParams(p)}`, { withCredentials: true });
  return response.data;
};

export type PublicSearchParams = Omit<SearchNotesParams, 'pinned'>;

/** Public root notes of every workspace, for Explore; `pending` is always 0. */
export const searchPublicNotes = async (p: PublicSearchParams): Promise<SearchNotesResult> => {
  const response = await axios.get(`/api/v1/explore/search?${searchParams(p)}`);
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
