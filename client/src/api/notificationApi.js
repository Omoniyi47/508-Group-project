import { apiClient } from './axiosClient';

export const notificationApi = {
  list: (params) => apiClient.get('/notifications', { params }),
  markRead: (id) => apiClient.patch(`/notifications/${id}/read`),
  markAllRead: () => apiClient.patch('/notifications/read-all'),
};
