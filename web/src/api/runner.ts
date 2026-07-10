import axios from 'axios';

export interface RunnerData {
  id: string;
  name: string;
  labels: string[];
  version: string;
  status: 'online' | 'offline';
  last_online_at: string;
  created_at: string;
}

export const getRunners = async () => {
  const response = await axios.get('/api/v1/admin/runners', { withCredentials: true });
  return response.data as RunnerData[];
};

export const deleteRunner = async (id: string) => {
  await axios.delete(`/api/v1/admin/runners/${id}`, { withCredentials: true });
};

export const getRunnerRegistrationToken = async () => {
  const response = await axios.get('/api/v1/admin/runners/registration-token', { withCredentials: true });
  return response.data as { registration_token: string };
};

export const cancelWorkflowRun = async (workspaceId: string, runId: string) => {
  const response = await axios.post(`/api/v1/workspaces/${workspaceId}/runs/${runId}/cancel`, {}, { withCredentials: true });
  return response.data;
};
