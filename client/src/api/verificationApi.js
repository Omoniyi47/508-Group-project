import { apiClient } from './axiosClient';

export const verificationApi = {
  list: (params) => apiClient.get('/verifications', { params }),
  resolve: (id, payload) => apiClient.post(`/verifications/${id}/resolve`, payload),
};
