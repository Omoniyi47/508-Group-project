import { apiClient } from './axiosClient';
import { downloadFile } from './downloadFile';

export const transcriptApi = {
  getPreview: (studentId) => apiClient.get(`/transcripts/${studentId}/preview`),
  downloadPreviewPdf: (studentId) => downloadFile(`/transcripts/${studentId}/preview/pdf`, 'unofficial-transcript.pdf'),

  createRequest: (student, purpose) => apiClient.post('/transcripts/requests', { student, purpose }),
  listRequests: (params) => apiClient.get('/transcripts/requests', { params }),
  getRequest: (id) => apiClient.get(`/transcripts/requests/${id}`),
  verifyRequest: (id) => apiClient.post(`/transcripts/requests/${id}/verify`),
  approveRequest: (id) => apiClient.post(`/transcripts/requests/${id}/approve`),
  rejectRequest: (id, reason) => apiClient.post(`/transcripts/requests/${id}/reject`, { reason }),
  downloadPdf: (id) => downloadFile(`/transcripts/requests/${id}/pdf`, 'transcript.pdf'),
  downloadExcel: (id) => downloadFile(`/transcripts/requests/${id}/excel`, 'transcript.xlsx'),
};
