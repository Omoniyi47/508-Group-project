import { ResourceCrudPage } from '../../components/crud/ResourceCrudPage';
import { levelApi } from '../../api/levelApi';
import { levelSchema } from '../../validators/academicValidators';

export default function LevelsPage() {
  return (
    <ResourceCrudPage
      title="Levels"
      description="Class levels students progress through (e.g. 100, 200, 300)."
      api={levelApi}
      schema={levelSchema}
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
