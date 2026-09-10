import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { transcriptApi } from '../../api/transcriptApi';
import { PageHeader } from '../../components/common/PageHeader';
import { Select } from '../../components/common/Select';
import { DataTable } from '../../components/common/DataTable';
import { Pagination } from '../../components/common/Pagination';
import { EmptyState } from '../../components/common/EmptyState';
import { Spinner } from '../../components/common/Spinner';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Button } from '../../components/common/Button';

const STATUS_OPTIONS = [
  { value: 'requested', label: 'Requested' },
  { value: 'verified', label: 'Verified' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'released', label: 'Released' },
];

const QUEUE_CARDS = [
  { status: 'requested', label: 'Awaiting verification', tone: 'border-warning/40 bg-warning/5 text-warning' },
  { status: 'verified', label: 'Awaiting HOD approval', tone: 'border-indigo/30 bg-indigo/5 text-indigo' },
  { status: 'approved', label: 'Ready to export', tone: 'border-teal/30 bg-teal/5 text-teal' },
  { status: 'released', label: 'Released', tone: 'border-success/30 bg-success/5 text-success' },
];

export default function TranscriptRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [queueCounts, setQueueCounts] = useState({ requested: 0, verified: 0, approved: 0, released: 0 });

  const load = async () => {
    setIsLoading(true);
    try {
      const params = { page, limit: 10 };
      if (status) params.status = status;
      const [res, ...queueResponses] = await Promise.all([
        transcriptApi.listRequests(params),
        ...QUEUE_CARDS.map((card) => transcriptApi.listRequests({ status: card.status, limit: 1 })),
      ]);
      setRequests(res.data.data);
      setMeta(res.data.meta);
      setQueueCounts(Object.fromEntries(QUEUE_CARDS.map((card, index) => [card.status, queueResponses[index].data.meta.total])));
    } catch {
      toast.error('Failed to load transcript requests');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status]);

  return (
    <div>
      <PageHeader title="Transcript Requests" description="Track transcript requests through verification and approval." />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {QUEUE_CARDS.map((card) => (
          <button
            key={card.status}
            type="button"
            onClick={() => {
              setPage(1);
              setStatus(card.status);
            }}
            className={`rounded-xl border p-4 text-left transition hover:-translate-y-0.5 ${card.tone}`}
          >
            <p className="text-2xl font-bold">{queueCounts[card.status]}</p>
            <p className="mt-1 text-xs font-semibold">{card.label}</p>
          </button>
        ))}
      </div>

      <div className="mb-4 max-w-xs">
        <Select
          placeholder="All statuses"
          options={STATUS_OPTIONS}
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
          aria-label="Filter by status"
        />
      </div>

      <div className="rounded-xl border border-slate/15 bg-white">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : requests.length === 0 ? (
          <EmptyState title="No transcript requests found" />
        ) : (
          <>
            <DataTable
              columns={[
                {
                  key: 'student',
                  label: 'Student',
                  render: (r) => (r.student ? `${r.student.firstName} ${r.student.lastName} (${r.student.matricNumber})` : 'Student record deleted'),
                },
                { key: 'purpose', label: 'Purpose', render: (r) => r.purpose || '—' },
                { key: 'requestedBy', label: 'Requested By', render: (r) => r.requestedBy?.name },
                { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
                { key: 'createdAt', label: 'Requested On', render: (r) => new Date(r.createdAt).toLocaleDateString() },
              ]}
              rows={requests}
              actions={(row) =>
                row.student ? (
                  <Link to={`/transcripts/${row.student._id}`}>
                    <Button variant="ghost" size="sm">
                      View
                    </Button>
                  </Link>
                ) : null
              }
            />
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
