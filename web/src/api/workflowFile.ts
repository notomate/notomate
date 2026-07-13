import axios from 'axios';

// Workflow codebase files are shared by every workflow in a workspace (same
// scope as workflow vars/secrets), so these calls are workspace-scoped only.
export interface WorkflowFileData {
  id: string;
  workspace_id: string;
  path: string;
  size: number;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
}

export const listWorkflowFiles = async (workspaceId: string) => {
  const response = await axios.get(
    `/api/v1/workspaces/${workspaceId}/workflow-files`,
    { withCredentials: true },
  );
  return response.data as WorkflowFileData[];
};

export const uploadWorkflowFile = async (
  workspaceId: string,
  file: File,
  path?: string,
  onUploadProgress?: (progressPercent: number) => void,
) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('path', path || file.name);
  const response = await axios.post(
    `/api/v1/workspaces/${workspaceId}/workflow-files`,
    formData,
    {
      withCredentials: true,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onUploadProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onUploadProgress(percentCompleted);
        }
      },
    },
  );
  return response.data as WorkflowFileData;
};

export const deleteWorkflowFile = async (workspaceId: string, fileId: string) => {
  const response = await axios.delete(
    `/api/v1/workspaces/${workspaceId}/workflow-files/${fileId}`,
    { withCredentials: true },
  );
  return response.data;
};
