import axios from 'axios';

export interface ActionSourceData {
  id: string;
  workspace_id: string;
  owner: string;
  repo: string;
  /** Empty means the repository's default branch. */
  ref: string;
  resolved_ref: string;
  resolved_sha: string;
  status: 'pending' | 'ok' | 'error';
  /** Sync error, or warnings (one per line) when status is ok. */
  last_error: string;
  last_synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface MarketplaceActionInput {
  name: string;
  description?: string;
  required: boolean;
  default?: string;
  deprecation_message?: string;
}

export interface MarketplaceActionOutput {
  name: string;
  description?: string;
}

export interface MarketplaceActionData {
  id: string;
  source_id: string;
  path: string;
  /** Value for a step's `uses:`, e.g. owner/repo/path@ref. */
  uses: string;
  name: string;
  description: string;
  author: string;
  icon: string;
  color: string;
  runs_using: string;
  inputs: MarketplaceActionInput[];
  outputs: MarketplaceActionOutput[];
}

export const actionSourcesKey = (workspaceId: string) => ['action-sources', workspaceId];
export const marketplaceActionsKey = (workspaceId: string) => ['marketplace-actions', workspaceId];
export const githubIntegrationKey = (workspaceId: string) => ['github-integration', workspaceId];

export const getActionSources = async (workspaceId: string) => {
  const response = await axios.get(`/api/v1/workspaces/${workspaceId}/action-sources`, { withCredentials: true });
  return response.data as ActionSourceData[];
};

export const createActionSource = async (workspaceId: string, data: { repo: string; ref?: string }) => {
  const response = await axios.post(`/api/v1/workspaces/${workspaceId}/action-sources`, data, { withCredentials: true });
  return response.data as ActionSourceData;
};

export const syncActionSource = async (workspaceId: string, sourceId: string) => {
  const response = await axios.post(`/api/v1/workspaces/${workspaceId}/action-sources/${sourceId}/sync`, {}, { withCredentials: true });
  return response.data as ActionSourceData;
};

export const deleteActionSource = async (workspaceId: string, sourceId: string) => {
  await axios.delete(`/api/v1/workspaces/${workspaceId}/action-sources/${sourceId}`, { withCredentials: true });
};

export const getMarketplaceActions = async (workspaceId: string) => {
  const response = await axios.get(`/api/v1/workspaces/${workspaceId}/marketplace/actions`, { withCredentials: true });
  return response.data as MarketplaceActionData[];
};

export const getGitHubIntegration = async (workspaceId: string) => {
  const response = await axios.get(`/api/v1/workspaces/${workspaceId}/integrations/github`, { withCredentials: true });
  return response.data as { configured: boolean };
};

export const updateGitHubIntegration = async (workspaceId: string, token: string) => {
  const response = await axios.put(`/api/v1/workspaces/${workspaceId}/integrations/github`, { token }, { withCredentials: true });
  return response.data as { configured: boolean };
};

export const deleteGitHubIntegration = async (workspaceId: string) => {
  await axios.delete(`/api/v1/workspaces/${workspaceId}/integrations/github`, { withCredentials: true });
};
