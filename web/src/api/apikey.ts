import axios from "axios";

/** Empty for an unrestricted key. */
export type APIKeyScope = "" | "mcp:read" | "mcp:write";

export interface APIKey {
    id: string;
    user_id: string;
    name: string;
    prefix: string;
    last_used_at: string;
    expires_at: string;
    created_at: string;
    scope: APIKeyScope;
}

export interface APIKeyCreationResponse extends APIKey {
    full_key: string; // Only present on creation
}

export interface CreateAPIKeyRequest {
    name: string;
    expires_at?: string; // Optional, RFC3339 format
    scope?: APIKeyScope;
}

export const listAPIKeys = async (userId: string): Promise<APIKey[]> => {
    const response = await axios.get(`/api/v1/users/${userId}/api-keys`);
    return response.data;
};

export const createAPIKey = async (
    userId: string,
    request: CreateAPIKeyRequest
): Promise<APIKeyCreationResponse> => {
    const response = await axios.post(`/api/v1/users/${userId}/api-keys`, request);
    return response.data;
};

export const deleteAPIKey = async (userId: string, keyId: string): Promise<void> => {
    await axios.delete(`/api/v1/users/${userId}/api-keys/${keyId}`);
};
