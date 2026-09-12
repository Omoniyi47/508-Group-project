import { useEffect, useState } from 'react';
import { loadDropdownOptions } from '../../api/dropdownOptions';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { resultApi } from '../../api/resultApi';
import { courseApi } from '../../api/courseApi';
import { sessionApi } from '../../api/sessionApi';
import { semesterApi } from '../../api/semesterApi';
import { levelApi } from '../../api/levelApi';
import { rejectResultSchema } from '../../validators/resultValidators';
import { useAuth } from '../../context/useAuth';
import { ROLES } from '../../constants/roles';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/common/Button';
import { Select } from '../../components/common/Select';
import { Input } from '../../components/common/Input';
import { DataTable } from '../../components/common/DataTable';
import { Pagination } from '../../components/common/Pagination';
import { EmptyState } from '../../components/common/EmptyState';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Spinner } from '../../components/common/Spinner';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { ManualEntryModal } from './ManualEntryModal';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

function RejectModal({ open, onClose, onConfirm }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(rejectResultSchema) });

  useEffect(() => {
    if (open) reset({ reason: '' });
  }, [open, reset]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reject Result"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" isLoading={isSubmitting} onClick={handleSubmit((v) => onConfirm(v.reason))}>
            Reject
          </Button>
        </>
      }
    >
      <form>
        <Input label="Reason" required error={errors.reason?.message} {...register('reason')} />
      </form>
    </Modal>
  );
}

export default function ResultsPage() {
  const { hasRole } = useAuth();
  const canEnter = hasRole(ROLES.ADMIN, ROLES.RESULT_OFFICER);
  const canApprove = hasRole(ROLES.ADMIN, ROLES.HOD);
  const [searchParams] = useSearchParams();

  const [results, setResults] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingLookups, setIsLoadingLookups] = useState(true);
  const [lookups, setLookups] = useState({ courses: [], sessions: [], semesters: [], levels: [] });

  const [filters, setFilters] = useState({
    course: '',
    session: '',
    semester: '',
    status: searchParams.get('status') || (hasRole(ROLES.HOD) ? 'submitted' : ''),
  });

  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [deletingResult, setDeletingResult] = useState(null);
  const [rejectingResult, setRejectingResult] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadLookups() {
      try {
        const [courseRes, sessionRes, semesterRes, levelRes] = await Promise.all([
          loadDropdownOptions(courseApi),
          loadDropdownOptions(sessionApi),
          loadDropdownOptions(semesterApi),
          loadDropdownOptions(levelApi),
        ]);
        if (!cancelled) {
        setLookups({
          courses: courseRes.data.data.map((c) => ({ value: c._id, label: `${c.code} - ${c.title}` })),
          sessions: sessionRes.data.data.map((s) => ({ value: s._id, label: s.name })),
          semesters: semesterRes.data.data.map((s) => ({ value: s._id, label: s.name })),
          levels: levelRes.data.data.map((l) => ({ value: l._id, label: l.name })),
        });
        }
      } catch {
        if (!cancelled) toast.error('Could not load academic setup data. Refresh the page and try again.');
      } finally {
        if (!cancelled) setIsLoadingLookups(false);
      }
    }

    loadLookups();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadResults = async () => {
    setIsLoading(true);
    try {
      const params = { page, limit: 10 };
      for (const key of ['course', 'session', 'semester', 'status']) {
        if (filters[key]) params[key] = filters[key];
      }
      const res = await resultApi.list(params);
      setResults(res.data.data);
      setMeta(res.data.meta);
    } catch {
      toast.error('Failed to load results');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filters]);

  const updateFilter = (key, value) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const submitResult = async (result) => {
    try {
      await resultApi.submit(result._id);
      toast.success('Result submitted for approval');
      loadResults();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to submit');
    }
  };

  const approveResult = async (result) => {
    try {
      await resultApi.approve(result._id);
      toast.success('Result approved');
      loadResults();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to approve');
    }
  };

  const confirmReject = async (reason) => {
    try {
      await resultApi.reject(rejectingResult._id, reason);
      toast.success('Result rejected');
      setRejectingResult(null);
      loadResults();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to reject');
    }
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      await resultApi.remove(deletingResult._id);
      toast.success('Result deleted');
      setDeletingResult(null);
      loadResults();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to delete');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Results"
        description="Enter, submit, and review course results."
        actions={
          canEnter && (
            <>
              <Link to="/results/upload">
                <Button variant="secondary">Bulk upload</Button>
              </Link>
              <Button disabled={isLoadingLookups} onClick={() => setEntryModalOpen(true)}>
                {isLoadingLookups ? 'Loading academic data…' : '+ Manual Entry'}
              </Button>
            </>
          )
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-slate/15 bg-white p-4 sm:grid-cols-4">
        <Select placeholder="All courses" disabled={isLoadingLookups} options={lookups.courses} value={filters.course} onChange={(e) => updateFilter('course', e.target.value)} aria-label="Filter by course" />
        <Select placeholder="All sessions" disabled={isLoadingLookups} options={lookups.sessions} value={filters.session} onChange={(e) => updateFilter('session', e.target.value)} aria-label="Filter by session" />
        <Select placeholder="All semesters" disabled={isLoadingLookups} options={lookups.semesters} value={filters.semester} onChange={(e) => updateFilter('semester', e.target.value)} aria-label="Filter by semester" />
        <Select placeholder="All statuses" options={STATUS_OPTIONS} value={filters.status} onChange={(e) => updateFilter('status', e.target.value)} aria-label="Filter by status" />
      </div>

      <div className="rounded-xl border border-slate/15 bg-white">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : results.length === 0 ? (
          <EmptyState title="No results found" description="Try adjusting your filters, or enter a new result." />
        ) : (
          <>
            <DataTable
              columns={[
                { key: 'student', label: 'Student', render: (r) => `${r.student?.firstName} ${r.student?.lastName} (${r.student?.matricNumber})` },
                { key: 'course', label: 'Course', render: (r) => r.course?.code },
                { key: 'session', label: 'Session', render: (r) => r.session?.name },
                { key: 'semester', label: 'Semester', render: (r) => r.semester?.name },
                { key: 'score', label: 'Score' },
                { key: 'grade', label: 'Grade' },
                { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
              ]}
              rows={results}
              actions={(row) => (
                <div className="flex justify-end gap-2">
                  {canEnter && ['draft', 'rejected'].includes(row.status) && (
                    <Button variant="ghost" size="sm" onClick={() => submitResult(row)}>
                      Submit
                    </Button>
                  )}
                  {canEnter && ['draft'].includes(row.status) && (
                    <Button variant="ghost" size="sm" className="text-danger" onClick={() => setDeletingResult(row)}>
                      Delete
                    </Button>
                  )}
                  {canApprove && row.status === 'submitted' && (
                    <>
                      <Button variant="teal" size="sm" onClick={() => approveResult(row)}>
                        Approve
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => setRejectingResult(row)}>
                        Reject
                      </Button>
                    </>
                  )}
                  {row.status === 'rejected' && row.rejectionReason && (
                    <span className="text-xs text-danger" title={row.rejectionReason}>
                      Reason: {row.rejectionReason}
                    </span>
                  )}
                </div>
              )}
            />
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={setPage} />
          </>
        )}
      </div>

      <ManualEntryModal
        open={entryModalOpen}
        onClose={() => setEntryModalOpen(false)}
        lookups={lookups}
        onSaved={({ keepOpen = false } = {}) => {
          if (!keepOpen) setEntryModalOpen(false);
          loadResults();
        }}
      />

      <RejectModal open={!!rejectingResult} onClose={() => setRejectingResult(null)} onConfirm={confirmReject} />

      <ConfirmDialog
        open={!!deletingResult}
        onClose={() => setDeletingResult(null)}
        onConfirm={confirmDelete}
        isLoading={isDeleting}
        title="Delete Result"
        message="Are you sure you want to delete this draft result? This cannot be undone."
        confirmLabel="Delete"
      />
    </div>
  );
}
