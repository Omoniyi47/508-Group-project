import { ROLES } from '../constants/roles';

const ALL_ROLES = [ROLES.ADMIN, ROLES.RESULT_OFFICER, ROLES.TRANSCRIPT_OFFICER, ROLES.HOD];

export const NAV_ITEMS = [
  { label: 'Dashboard', to: '/dashboard', roles: ALL_ROLES },
  { label: 'Students', to: '/students', roles: ALL_ROLES },
  { label: 'Results', to: '/results', roles: ALL_ROLES },
  { label: 'Notifications', to: '/notifications', roles: ALL_ROLES },
  { label: 'Transcript Requests', to: '/transcript-requests', roles: [ROLES.ADMIN, ROLES.TRANSCRIPT_OFFICER, ROLES.HOD] },
  { label: 'Duplicate Queue', to: '/verification-queue', roles: [ROLES.ADMIN, ROLES.TRANSCRIPT_OFFICER] },
  { label: 'Users', to: '/users', roles: [ROLES.ADMIN] },
  { label: 'Faculties', to: '/faculties', roles: [ROLES.ADMIN] },
  { label: 'Departments', to: '/departments', roles: [ROLES.ADMIN] },
  { label: 'Courses', to: '/courses', roles: ALL_ROLES },
  { label: 'Sessions', to: '/sessions', roles: [ROLES.ADMIN] },
  { label: 'Semesters', to: '/semesters', roles: [ROLES.ADMIN] },
  { label: 'Levels', to: '/levels', roles: [ROLES.ADMIN] },
  { label: 'Grading Rules', to: '/grading-rules', roles: [ROLES.ADMIN] },
  { label: 'Audit Trail', to: '/audit-trail', roles: [ROLES.ADMIN] },
  { label: 'System Settings', to: '/settings', roles: [ROLES.ADMIN] },
  { label: 'Backups', to: '/backups', roles: [ROLES.ADMIN] },
];
