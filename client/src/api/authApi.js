import { apiClient, sessionClient, refreshSession, logoutSession } from './axiosClient';

export const authApi = {
  login: (email, password) => sessionClient.post('/auth/login', { email, password }),
  refresh: refreshSession,
  logout: logoutSession,
  me: () => apiClient.get('/auth/me'),
  changePassword: (currentPassword, newPassword) =>
    apiClient.post('/auth/change-password', { currentPassword, newPassword }),
};
