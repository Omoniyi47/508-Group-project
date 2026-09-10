import { apiClient } from './axiosClient';

export const resultApi = {
  list: (params) => apiClient.get('/results', { params }),
  gradeDistribution: (params) => apiClient.get('/results/stats/grade-distribution', { params }),
  entrySafeguards: (params) => apiClient.get('/results/entry-safeguards', { params }),
  getById: (id) => apiClient.get(`/results/${id}`),
  create: (data) => apiClient.post('/results', data),
  update: (id, data) => apiClient.put(`/results/${id}`, data),
  remove: (id) => apiClient.delete(`/results/${id}`),
  submit: (id) => apiClient.post(`/results/${id}/submit`),
  submitBatch: (ids) => apiClient.post('/results/submit-batch', { ids }),
  approve: (id) => apiClient.post(`/results/${id}/approve`),
  reject: (id, reason) => apiClient.post(`/results/${id}/reject`, { reason }),

  previewUpload: (file, context) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('course', context.course);
    formData.append('session', context.session);
    formData.append('semester', context.semester);
    formData.append('level', context.level);
    return apiClient.post('/results/upload-batches/preview', formData);
  },
  previewOcrUpload: (file, context) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('course', context.course);
    formData.append('session', context.session);
    formData.append('semester', context.semester);
    formData.append('level', context.level);
    return apiClient.post('/results/upload-batches/ocr-preview', formData);
  },
  correctOcrRow: (batchId, rowNumber, data) => apiClient.patch(`/results/upload-batches/${batchId}/rows/${rowNumber}`, data),
  confirmUpload: (batchId) => apiClient.post(`/results/upload-batches/${batchId}/confirm`),
  listUploadBatches: (params) => apiClient.get('/results/upload-batches', { params }),
  getUploadBatch: (id) => apiClient.get(`/results/upload-batches/${id}`),
};
