export const ROLES = Object.freeze({
  ADMIN: 'admin',
  RESULT_OFFICER: 'result_officer',
  TRANSCRIPT_OFFICER: 'transcript_officer',
  HOD: 'hod',
});

export const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Administrator',
  [ROLES.RESULT_OFFICER]: 'Departmental Result Officer',
  [ROLES.TRANSCRIPT_OFFICER]: 'Transcript Officer',
  [ROLES.HOD]: 'Head of Department',
};
