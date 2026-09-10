import { createResourceApi } from './resourceApiFactory';

export const auditLogApi = {
  list: createResourceApi('/audit-logs').list,
};
