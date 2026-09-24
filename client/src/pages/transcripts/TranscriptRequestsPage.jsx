import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { transcriptApi } from '../../api/transcriptApi';
import { PageHeader } from '../../components/common/PageHeader';
import { Select } from '../../components/common/Select';
import { DataTable } from '../../components/common/DataTable';
import { Pagination } from '../../components/common/Pagination';
import { EmptyState } from '../../components/common/EmptyState';
import { Spinner } from '../../components/common/Spinner';
import { Button } from '../../components/common/Button';
import { retrievalLabel, transcriptProcessLabel, TRANSCRIPT_PROCESS_STEPS } from '../../constants/transcript';

const STATUS_OPTIONS = [
  { value: 'requested', label: 'Requested' },
  { value: 'verified', label: 'Verified' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'released', label: 'Released' },
];

const QUEUE_CARDS = [
  { status: 'received', label: 'Application Received', tone: 'border-warning/40 bg-warning/5 text-warning' },
  { status: 'in_progress', label: 'Application in Progress', tone: 'border-indigo/30 bg-indigo/5 text-indigo' },
  { status: 'generated', label: 'Transcript Generated', tone: 'border-teal/30 bg-teal/5 text-teal' },
];

export default function TranscriptRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [processStage, setProcessStage] = useState('');
  const [retrievalMethod, setRetrievalMethod] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [queueCounts, setQueueCounts] = useState({ received: 0, in_progress: 0, generated: 0 });

  const latestRequestRef = useRef(0);

  const load = async () => {
    const requestId = ++latestRequestRef.current;
    setIsLoading(true);
    try {
      const params = { page, limit: 10 };
      if (status) params.status = status;
      if (processStage) params.processStage = processStage;
      if (retrievalMethod) params.retrievalMethod = retrievalMethod;
      const [res, ...queueResponses] = await Promise.all([
        transcriptApi.listRequests(params),
        ...QUEUE_CARDS.map((card) => transcriptApi.listRequests({ processStage: card.status, limit: 1 })),
      ]);
      if (requestId !== latestRequestRef.current) return;
      setRequests(res.data.data);
      setMeta(res.data.meta);
      setQueueCounts(Object.fromEntries(QUEUE_CARDS.map((card, index) => [card.status, queueResponses[index].data.meta.total])));
    } catch {
      if (requestId === latestRequestRef.current) toast.error('Failed to load transcript requests');
    } finally {
      if (requestId === latestRequestRef.current) setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status, retrievalMethod, processStage]);

  return (
    <div>
      <PageHeader title="Transcript Requests" description="Track verification, approval, online retrieval and physical collection." actions={<Link to="/transcript-collection" className="font-medium text-indigo hover:underline">Step-by-step collection</Link>} />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {QUEUE_CARDS.map((card) => (
          <button
            key={card.status}
            type="button"
            onClick={() => {
              setPage(1);
              setStatus('');
              setProcessStage(card.status);
            }}
            className={`rounded-xl border p-4 text-left transition hover:-translate-y-0.5 ${card.tone}`}
          >
            <p className="text-2xl font-bold">{queueCounts[card.status]}</p>
            <p className="mt-1 text-xs font-semibold">{card.label}</p>
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <Select aria-label="Filter by transcript process" placeholder="All process stages" options={TRANSCRIPT_PROCESS_STEPS} value={processStage} onChange={(event) => { setPage(1); setProcessStage(event.target.value); }} />
        <Select aria-label="Filter by retrieval method" placeholder="All retrieval methods" options={[{ value: 'manual', label: 'Manual collection' }, { value: 'online', label: 'Online download' }]} value={retrievalMethod} onChange={(event) => { setPage(1); setRetrievalMethod(event.target.value); }} />
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
                { key: 'retrievalMethod', label: 'Retrieval', render: (r) => retrievalLabel(r.retrievalMethod) },
                { key: 'process', label: 'Transcript Process', render: (r) => transcriptProcessLabel(r) },
                { key: 'status', label: 'Staff workflow', render: (r) => <span className="capitalize">{r.status}</span> },
                { key: 'createdAt', label: 'Requested On', render: (r) => new Date(r.createdAt).toLocaleDateString() },
              ]}
              rows={requests}
              actions={(row) =>
                row.student ? (
                  <Link to={`/transcript-collection?request=${row._id}`}>
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
