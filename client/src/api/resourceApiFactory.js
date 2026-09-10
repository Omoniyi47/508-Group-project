import { apiClient } from './axiosClient';

export function createResourceApi(basePath) {
  return {
    list: (params) => apiClient.get(basePath, { params }),
    getById: (id) => apiClient.get(`${basePath}/${id}`),
    create: (data) => apiClient.post(basePath, data),
    update: (id, data) => apiClient.put(`${basePath}/${id}`, data),
    remove: (id) => apiClient.delete(`${basePath}/${id}`),
  };
}
