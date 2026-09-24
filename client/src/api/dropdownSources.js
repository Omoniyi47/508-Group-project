import { facultyApi } from './facultyApi';
import { departmentApi } from './departmentApi';
import { sessionApi } from './sessionApi';
import { semesterApi } from './semesterApi';
import { levelApi } from './levelApi';
import { courseApi } from './courseApi';

export const facultySource = { api: facultyApi, emptyMessage: 'No faculties available. Ask an administrator to add them under Faculties.' };
export const departmentSource = { api: departmentApi, emptyMessage: 'No departments available. Ask an administrator to add them under Departments.' };
export const sessionSource = { api: sessionApi, emptyMessage: 'No sessions available. Ask an administrator to add them under Sessions.' };
export const semesterSource = { api: semesterApi, emptyMessage: 'No semesters available. Ask an administrator to add them under Semesters.' };
export const levelSource = { api: levelApi, emptyMessage: 'No levels available. Ask an administrator to add them under Levels.' };
export const courseSource = { api: courseApi, label: (course) => `${course.code} - ${course.title}`, emptyMessage: 'No courses available. Ask an administrator to add or import the approved curriculum under Courses.' };
export const academicSources = { sessions: sessionSource, semesters: semesterSource, levels: levelSource };
