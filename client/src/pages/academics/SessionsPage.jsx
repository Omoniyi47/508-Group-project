import { ResourceCrudPage } from '../../components/crud/ResourceCrudPage';
import { sessionApi } from '../../api/sessionApi';
import { sessionSchema } from '../../validators/academicValidators';

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : '—';
}

export default function SessionsPage() {
  return (
    <ResourceCrudPage
      title="Sessions"
      description="Academic sessions (years) that group semesters together."
      api={sessionApi}
      schema={sessionSchema}
      columns={[
        { key: 'name', label: 'Session' },
        { key: 'datesAreEstimated', label: 'Dates', render: (row) => row.datesAreEstimated ? 'Placeholder dates — update from official calendar' : 'Recorded dates' },
        { key: 'startDate', label: 'Start', render: (row) => formatDate(row.startDate) },
        { key: 'endDate', label: 'End', render: (row) => formatDate(row.endDate) },
        {
          key: 'isCurrent',
          label: 'Current',
          render: (row) =>
            row.isCurrent ? (
              <span className="rounded-full bg-success px-2 py-0.5 text-xs font-medium text-navy">Current</span>
            ) : (
              '—'
            ),
        },
      ]}
      fields={[
        { name: 'name', label: 'Session (YYYY/YYYY)', required: true },
        { name: 'startDate', label: 'Start date', type: 'date', required: true },
        { name: 'endDate', label: 'End date', type: 'date', required: true },
        { name: 'datesAreEstimated', label: 'Dates are placeholders (not verified academic dates)', type: 'checkbox', hint: 'Clear this after entering dates from an official academic calendar.' },
        { name: 'isCurrent', label: 'Mark as current session', type: 'checkbox' },
      ]}
    />
  );
}
