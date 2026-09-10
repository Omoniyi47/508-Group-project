import { apiClient } from './axiosClient';

export const authApi = {
  login: (email, password) => apiClient.post('/auth/login', { email, password }),
  refresh: () => apiClient.post('/auth/refresh'),
  logout: () => apiClient.post('/auth/logout'),
  me: () => apiClient.get('/auth/me'),
  changePassword: (currentPassword, newPassword) =>
    apiClient.post('/auth/change-password', { currentPassword, newPassword }),
};
