import { apiClient } from './axiosClient';
import { createResourceApi } from './resourceApiFactory';

export const userApi = {
  ...createResourceApi('/users'),
  resetPassword: (id, newPassword) => apiClient.post(`/users/${id}/reset-password`, { newPassword }),
};
