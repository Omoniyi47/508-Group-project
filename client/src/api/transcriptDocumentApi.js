import { apiClient } from './axiosClient';
import { downloadFile } from './downloadFile';

export const transcriptDocumentApi = {
  list: (params) => apiClient.get('/transcript-documents', { params }),
  getById: (id) => apiClient.get(`/transcript-documents/${id}`),
  upload: (studentId, files, { label, notes } = {}) => {
    const formData = new FormData();
    formData.append('student', studentId);
    if (label) formData.append('label', label);
    if (notes) formData.append('notes', notes);
    files.forEach((file) => formData.append('files', file));
    return apiClient.post('/transcript-documents', formData);
  },
  downloadFile: (documentId, fileId, filename) => downloadFile(`/transcript-documents/${documentId}/files/${fileId}`, filename),
  remove: (id) => apiClient.delete(`/transcript-documents/${id}`),
};
