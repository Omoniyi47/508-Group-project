import { ResourceCrudPage } from '../../components/crud/ResourceCrudPage';
import { departmentApi } from '../../api/departmentApi';
import { facultyApi } from '../../api/facultyApi';
import { userApi } from '../../api/userApi';
import { departmentSchema } from '../../validators/academicValidators';

export default function DepartmentsPage() {
  return (
    <ResourceCrudPage
      title="Departments"
      description="Departments belong to a faculty and own courses, students, and staff."
      api={departmentApi}
      schema={departmentSchema}
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'code', label: 'Code' },
        { key: 'faculty', label: 'Faculty', render: (row) => row.faculty?.name || '—' },
        { key: 'hod', label: 'Head of Department', render: (row) => row.hod?.name || '—' },
      ]}
      fields={[
        { name: 'name', label: 'Name', required: true },
        { name: 'code', label: 'Code', required: true },
        { name: 'faculty', label: 'Faculty', type: 'select', required: true, optionsFrom: { api: facultyApi, labelKey: 'name' } },
        {
          name: 'hod',
          label: 'Head of Department',
          type: 'select',
          optionsFrom: { api: userApi, labelKey: 'name', params: { role: 'hod' } },
        },
      ]}
    />
  );
}
