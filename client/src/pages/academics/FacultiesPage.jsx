import { ResourceCrudPage } from '../../components/crud/ResourceCrudPage';
import { facultyApi } from '../../api/facultyApi';
import { facultySchema } from '../../validators/academicValidators';

export default function FacultiesPage() {
  return (
    <ResourceCrudPage
      title="Faculties"
      description="Faculties group related departments together."
      api={facultyApi}
      schema={facultySchema}
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'code', label: 'Code' },
      ]}
      fields={[
        { name: 'name', label: 'Name', required: true },
        { name: 'code', label: 'Code', required: true },
      ]}
    />
  );
}
