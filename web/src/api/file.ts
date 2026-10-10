import axios from "axios";
import { useUploadStore, type UploadResult } from "@/stores/upload";

export interface FileInfo {
    id: string;
    name: string;
    original_name: string;
    size: number;
    ext: string;
    created_at: string;
    updated_at: string;
}

/**
 * Uploads a file to the workspace using the resumable (tus) endpoint. The
 * upload lives in the global upload store, so it keeps going (and shows in
 * the upload panel) even if the component that started it unmounts.
 */
export const uploadFile = (
    workspaceId: string,
    file: File,
    onUploadProgress?: (progressPercent: number) => void
): Promise<UploadResult> => {
    return useUploadStore.getState().startUpload(workspaceId, file, onUploadProgress).promise;
};

export const listFiles = async (
    workspaceId: string,
    query?: string,
    ext?: string,
    pageSize?: number,
    pageNumber?: number
): Promise<{ files: FileInfo[] }> => {
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (ext) params.append('ext', ext);
    if (pageSize) params.append('pageSize', pageSize.toString());
    if (pageNumber) params.append('pageNumber', pageNumber.toString());

    const response = await axios.get(`/api/v1/workspaces/${workspaceId}/files?${params.toString()}`, {
        withCredentials: true,
    });
    return response.data;
};

export const deleteFile = async (workspaceId: string, fileId: string) => {
    const response = await axios.delete(`/api/v1/workspaces/${workspaceId}/files/${fileId}`, {
        withCredentials: true,
    });
    return response.data;
};

export const renameFile = async (workspaceId: string, fileId: string, originalFilename: string) => {
    const response = await axios.patch(`/api/v1/workspaces/${workspaceId}/files/${fileId}`, {
        original_filename: originalFilename,
    }, {
        withCredentials: true,
    });
    return response.data;
};

export const getFileDownloadUrl = (workspaceId: string, fileName: string) => {
    return `/api/v1/workspaces/${workspaceId}/files/${fileName}`;
};
