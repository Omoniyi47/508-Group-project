import { ResourceCrudPage } from '../../components/crud/ResourceCrudPage';
import { semesterApi } from '../../api/semesterApi';
import { semesterSchema } from '../../validators/academicValidators';

export default function SemestersPage() {
  return (
    <ResourceCrudPage
      title="Semesters"
      description="Semesters (e.g. Harmattan, Rain) used to organize each session."
      api={semesterApi}
      schema={semesterSchema}
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'order', label: 'Order' },
      ]}
      fields={[
        { name: 'name', label: 'Name', required: true },
        { name: 'order', label: 'Order', type: 'number', required: true },
      ]}
    />
  );
}
