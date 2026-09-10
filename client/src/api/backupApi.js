import { apiClient } from './axiosClient';
import { downloadFile } from './downloadFile';

export const backupApi = {
  list: (params) => apiClient.get('/backups', { params }),
  trigger: () => apiClient.post('/backups'),
  download: (id, fileName) => downloadFile(`/backups/${id}/download`, fileName),
};
