import axios from 'axios';

export interface WorkflowData {
  id: string;
  workspace_id: string;
  name: string;
  definition: string;
  enabled: boolean;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
}

export interface WorkflowValidationError {
  line: number;
  message: string;
}

export interface WorkflowRunData {
  id: string;
  workflow_id: string;
  workspace_id: string;
  run_number: number;
  event: string;
  event_payload: string;
  status: 'queued' | 'running' | 'success' | 'failure' | 'cancelled';
  triggered_by: string;
  created_at: string;
  started_at: string;
  finished_at: string;
}

export interface WorkflowJobData {
  id: string;
  run_id: string;
  workspace_id: string;
  name: string;
  runs_on: string;
  status: WorkflowRunData['status'];
  runner_id: string;
  created_at: string;
  started_at: string;
  finished_at: string;
}

export interface WorkflowRunDetail extends WorkflowRunData {
  jobs: WorkflowJobData[];
}

export interface WorkflowJobLogLine {
  job_id: string;
  line_no: number;
  content: string;
  created_at: string;
}

export interface WorkflowJobLogs {
  lines: WorkflowJobLogLine[];
  next: number;
  finished: boolean;
}

export const getWorkflows = async (workspaceId: string) => {
  const response = await axios.get(`/api/v1/workspaces/${workspaceId}/workflows`, { withCredentials: true });
  return response.data as WorkflowData[];
};

export const getWorkflow = async (workspaceId: string, workflowId: string) => {
  const response = await axios.get(`/api/v1/workspaces/${workspaceId}/workflows/${workflowId}`, { withCredentials: true });
  return response.data as WorkflowData;
};

export const createWorkflow = async (workspaceId: string, data: { name: string; definition: string }) => {
  const response = await axios.post(`/api/v1/workspaces/${workspaceId}/workflows`, data, { withCredentials: true });
  return response.data as WorkflowData;
};

export const updateWorkflow = async (workspaceId: string, workflowId: string, data: { name: string; definition: string }) => {
  const response = await axios.put(`/api/v1/workspaces/${workspaceId}/workflows/${workflowId}`, data, { withCredentials: true });
  return response.data as WorkflowData;
};

export const updateWorkflowEnabled = async (workspaceId: string, workflowId: string, enabled: boolean) => {
  const response = await axios.patch(`/api/v1/workspaces/${workspaceId}/workflows/${workflowId}/enabled`, { enabled }, { withCredentials: true });
  return response.data as WorkflowData;
};

export const deleteWorkflow = async (workspaceId: string, workflowId: string) => {
  await axios.delete(`/api/v1/workspaces/${workspaceId}/workflows/${workflowId}`, { withCredentials: true });
};

export const dispatchWorkflow = async (workspaceId: string, workflowId: string, inputs: Record<string, string>) => {
  const response = await axios.post(`/api/v1/workspaces/${workspaceId}/workflows/${workflowId}/dispatch`, { inputs }, { withCredentials: true });
  return response.data as WorkflowRunData;
};

export const getWorkflowRuns = async (workspaceId: string, workflowId: string, page = 1, pageSize = 30) => {
  const response = await axios.get(
    `/api/v1/workspaces/${workspaceId}/workflows/${workflowId}/runs?page=${page}&page_size=${pageSize}`,
    { withCredentials: true },
  );
  return response.data as WorkflowRunData[];
};

export const getWorkflowRun = async (workspaceId: string, runId: string) => {
  const response = await axios.get(`/api/v1/workspaces/${workspaceId}/runs/${runId}`, { withCredentials: true });
  return response.data as WorkflowRunDetail;
};

export const getWorkflowJobLogs = async (workspaceId: string, runId: string, jobId: string, after = 0) => {
  const response = await axios.get(
    `/api/v1/workspaces/${workspaceId}/runs/${runId}/jobs/${jobId}/logs?after=${after}`,
    { withCredentials: true },
  );
  return response.data as WorkflowJobLogs;
};

export interface WorkflowVarData {
  id: string;
  workspace_id: string;
  key: string;
  value: string;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
}

export interface WorkflowSecretData {
  id: string;
  workspace_id: string;
  key: string;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
}

export const getWorkflowVars = async (workspaceId: string) => {
  const response = await axios.get(`/api/v1/workspaces/${workspaceId}/vars`, { withCredentials: true });
  return response.data as WorkflowVarData[];
};

export const createWorkflowVar = async (workspaceId: string, data: { key: string; value: string }) => {
  const response = await axios.post(`/api/v1/workspaces/${workspaceId}/vars`, data, { withCredentials: true });
  return response.data as WorkflowVarData;
};

export const updateWorkflowVar = async (workspaceId: string, key: string, value: string) => {
  await axios.put(`/api/v1/workspaces/${workspaceId}/vars/${key}`, { value }, { withCredentials: true });
};

export const deleteWorkflowVar = async (workspaceId: string, key: string) => {
  await axios.delete(`/api/v1/workspaces/${workspaceId}/vars/${key}`, { withCredentials: true });
};

export const getWorkflowSecrets = async (workspaceId: string) => {
  const response = await axios.get(`/api/v1/workspaces/${workspaceId}/secrets`, { withCredentials: true });
  return response.data as WorkflowSecretData[];
};

export const createWorkflowSecret = async (workspaceId: string, data: { key: string; value: string }) => {
  const response = await axios.post(`/api/v1/workspaces/${workspaceId}/secrets`, data, { withCredentials: true });
  return response.data as WorkflowSecretData;
};

export const updateWorkflowSecret = async (workspaceId: string, key: string, value: string) => {
  await axios.put(`/api/v1/workspaces/${workspaceId}/secrets/${key}`, { value }, { withCredentials: true });
};

export const deleteWorkflowSecret = async (workspaceId: string, key: string) => {
  await axios.delete(`/api/v1/workspaces/${workspaceId}/secrets/${key}`, { withCredentials: true });
};
