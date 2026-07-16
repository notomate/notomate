import axios from "axios";

export interface UserPreferences {
    lang?: string;
    theme?: 'light' | 'dark';
    primaryColor?: string;
}

export interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    avatar_url?: string;
    preferences: UserPreferences;
}

export const updatePreferences = async (user: User) => {
    const response = await axios.patch(`/api/v1/users/${user.id}/preferences`,
        {
            preferences: user.preferences
        });
    return response.data as User;
};

export const uploadAvatar = async (userId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await axios.post(`/api/v1/users/${userId}/avatar`, formData, {
        withCredentials: true,
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data as { avatar_url: string };
};

export const removeAvatar = async (userId: string) => {
    const response = await axios.delete(`/api/v1/users/${userId}/avatar`);
    return response.data as { avatar_url: string };
};

export const updateEmail = async (userId: string, email: string) => {
    const response = await axios.patch(`/api/v1/users/${userId}/email`, { email });
    return response.data as { email: string };
};

export const changePassword = async (userId: string, password: string) => {
    const response = await axios.patch(`/api/v1/users/${userId}/password`, { password });
    return response.data;
};
