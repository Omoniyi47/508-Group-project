import { apiClient } from './axiosClient';

export const systemSettingApi = {
  get: () => apiClient.get('/settings'),
  update: (data) => apiClient.put('/settings', data),
};
