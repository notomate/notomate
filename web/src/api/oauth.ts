import axios from "axios";

export type OAuthScope = "mcp:read" | "mcp:write";

export interface OAuthAuthorizeInfo {
    client_name: string;
    redirect_host: string;
    max_scope: OAuthScope;
}

export interface OAuthGrant {
    id: string;
    client_name: string;
    scope: OAuthScope;
    created_at: string;
    last_used_at: string;
}

export const getAuthorizeInfo = async (query: string): Promise<OAuthAuthorizeInfo> => {
    const response = await axios.get(`/api/v1/oauth/authorize?${query}`);
    return response.data;
};

/** Records the user's answer and returns the URL to send them back to. */
export const decideAuthorization = async (
    params: Record<string, string>,
    decision: { approved: boolean; granted_scope?: OAuthScope }
): Promise<string> => {
    const response = await axios.post("/api/v1/oauth/authorize", { ...params, ...decision });
    return response.data.redirect_to;
};

export const listOAuthGrants = async (userId: string): Promise<OAuthGrant[]> => {
    const response = await axios.get(`/api/v1/users/${userId}/oauth-grants`);
    return response.data;
};

export const deleteOAuthGrant = async (userId: string, grantId: string): Promise<void> => {
    await axios.delete(`/api/v1/users/${userId}/oauth-grants/${grantId}`);
};
