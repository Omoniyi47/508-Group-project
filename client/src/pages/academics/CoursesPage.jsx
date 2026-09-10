import { ResourceCrudPage } from '../../components/crud/ResourceCrudPage';
import { courseApi } from '../../api/courseApi';
import { departmentApi } from '../../api/departmentApi';
import { levelApi } from '../../api/levelApi';
import { semesterApi } from '../../api/semesterApi';
import { courseSchema } from '../../validators/academicValidators';
import { useAuth } from '../../context/useAuth';
import { ROLES } from '../../constants/roles';

const COURSE_TYPE_OPTIONS = [
  { value: 'core', label: 'Core course' },
  { value: 'elective', label: 'Elective' },
  { value: 'restricted_elective', label: 'Restricted elective' },
  { value: 'special_elective', label: 'Special elective' },
  { value: 'practicum', label: 'Practicum' },
  { value: 'industrial_training', label: 'Industrial training' },
  { value: 'project', label: 'Project' },
  { value: 'other', label: 'Other approved course' },
];

const COURSE_TYPE_LABELS = Object.fromEntries(COURSE_TYPE_OPTIONS.map((option) => [option.value, option.label]));

export default function CoursesPage() {
  const { hasRole } = useAuth();
  const canManage = hasRole(ROLES.ADMIN);

  return (
    <ResourceCrudPage
      title="Courses"
      description="Undergraduate curriculum courses, grouped by student programme, offering department, level, semester, and requirement type."
      api={courseApi}
      schema={courseSchema}
      canManage={canManage}
      createLabel="+ Add course"
      getRowLabel={(row) => `${row.code} - ${row.title}`}
      columns={[
        { key: 'code', label: 'Code' },
        { key: 'codePrefix', label: 'Prefix' },
        { key: 'title', label: 'Title' },
        { key: 'creditUnit', label: 'Units' },
        { key: 'courseType', label: 'Type', render: (row) => COURSE_TYPE_LABELS[row.courseType] || 'Core course' },
        { key: 'curriculumContext', label: 'Curriculum context', render: (row) => row.curriculumContext || 'Standard' },
        { key: 'offeringDepartment', label: 'Offering department', render: (row) => row.offeringDepartment?.name || row.offeringUnit || 'Unspecified' },
        { key: 'department', label: 'Department', render: (row) => row.department?.name || '—' },
        { key: 'level', label: 'Level', render: (row) => row.level?.name || '—' },
        { key: 'semester', label: 'Semester', render: (row) => row.semester?.name || '—' },
      ]}
      fields={[
        { name: 'code', label: 'Course code', required: true },
        { name: 'title', label: 'Title', required: true },
        { name: 'creditUnit', label: 'Credit units', type: 'number', required: true, hint: 'Whole or half units are supported, including 0-unit non-credit courses.' },
        { name: 'department', label: 'Student programme department', type: 'select', optionsFrom: { api: departmentApi, labelKey: 'name' }, hint: 'Leave blank only for a university-wide course, such as a special elective.' },
        { name: 'offeringDepartment', label: 'Offering department', type: 'select', optionsFrom: { api: departmentApi, labelKey: 'name' }, hint: 'The unit teaching the course; it can differ from the student programme.' },
        { name: 'offeringUnit', label: 'Offering unit (when not a department)' },
        { name: 'level', label: 'Level', type: 'select', optionsFrom: { api: levelApi, labelKey: 'name' }, hint: 'Leave blank only where the approved curriculum permits the course at any level.' },
        { name: 'semester', label: 'Semester', type: 'select', optionsFrom: { api: semesterApi, labelKey: 'name' }, hint: 'Leave blank only for a reference-only course awaiting Registry placement; keep it inactive.' },
        { name: 'curriculumContext', label: 'Curriculum context', hint: 'Use a programme or track name only when the same code has a different approved definition.' },
        { name: 'curriculumVersion', label: 'Curriculum version or effective session', hint: 'Use for approved historical/current definitions that share a code.' },
        { name: 'courseType', label: 'Requirement type', type: 'select', required: true, options: COURSE_TYPE_OPTIONS, defaultValue: 'core' },
        { name: 'isUndergraduate', label: 'Undergraduate course', type: 'checkbox', defaultValue: true },
        { name: 'isActive', label: 'Available for result entry', type: 'checkbox', defaultValue: true },
      ]}
    />
  );
}
