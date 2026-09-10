import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { transcriptApi } from '../../api/transcriptApi';
import { courseApi } from '../../api/courseApi';
import { resultApi } from '../../api/resultApi';
import { useAuth } from '../../context/useAuth';
import { ROLES } from '../../constants/roles';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/common/Button';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Spinner } from '../../components/common/Spinner';
import { EmptyState } from '../../components/common/EmptyState';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { CurriculumChecklist } from '../../components/common/CurriculumChecklist';

const REQUEST_STEPS = [
  { key: 'requested', label: 'Requested' },
  { key: 'verified', label: 'Verified' },
  { key: 'approved', label: 'Approved' },
  { key: 'released', label: 'Released' },
];

function RequestProgress({ status }) {
  if (!status) return null;
  if (status === 'rejected') {
    return <p className="mt-3 text-xs font-medium text-danger">This request needs attention before it can be approved.</p>;
  }

  const currentIndex = REQUEST_STEPS.findIndex((step) => step.key === status);
  return (
    <ol className="mt-4 grid grid-cols-2 gap-y-3 sm:grid-cols-4" aria-label="Transcript request progress">
      {REQUEST_STEPS.map((step, index) => {
        const complete = index <= currentIndex;
        return (
          <li key={step.key} className="flex items-center gap-2 text-xs">
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${complete ? 'bg-teal text-white' : 'bg-slate/15 text-slate'}`}>
              {complete ? '✓' : index + 1}
            </span>
            <span className={complete ? 'font-medium text-navy' : 'text-slate'}>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function SemesterTable({ semester }) {
  return (
    <div className="mb-6 break-inside-avoid rounded-lg border border-slate/15">
      <div className="border-b border-slate/15 bg-off-white px-4 py-2">
        <h3 className="text-sm font-semibold text-indigo">
          {semester.level.name} Level &mdash; {semester.semester.name} Semester &mdash; {semester.session.name}
        </h3>
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-slate">
            <th className="px-4 py-2">Code</th>
            <th className="px-4 py-2">Title</th>
            <th className="px-4 py-2 text-center">Units</th>
            <th className="px-4 py-2 text-center">Score</th>
            <th className="px-4 py-2 text-center">Grade</th>
            <th className="px-4 py-2 text-center">Point</th>
          </tr>
        </thead>
        <tbody>
          {semester.courses.map((c) => (
            <tr key={c.course._id} className="border-t border-slate/10">
              <td className="px-4 py-2">{c.course.code}</td>
              <td className="px-4 py-2">{c.course.title}</td>
              <td className="px-4 py-2 text-center">{c.course.creditUnit}</td>
              <td className="px-4 py-2 text-center">{c.score}</td>
              <td className="px-4 py-2 text-center font-medium">{c.grade}</td>
              <td className="px-4 py-2 text-center">{c.gradePoint.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-slate/15 px-4 py-2 text-right text-sm text-slate">
        Semester GPA: <strong className="text-navy">{semester.semesterGpa.toFixed(2)}</strong> &nbsp;|&nbsp; Credit Units:{' '}
        <strong className="text-navy">{semester.semesterCreditUnits}</strong> &nbsp;|&nbsp; Cumulative GPA:{' '}
        <strong className="text-navy">{semester.cumulativeGpa.toFixed(2)}</strong>
      </div>
    </div>
  );
}

function StudentTimeline({ student, history, requests }) {
  const events = [
    { date: student.createdAt, title: 'Student record created', detail: `${student.entrySession?.name || 'Entry session'} entry record` },
    ...history.semesters.map((semester) => ({ date: semester.session?.startDate, title: `${semester.level?.name} level result history`, detail: `${semester.semester?.name} Semester - GPA ${semester.semesterGpa.toFixed(2)}` })),
    ...(student.graduationSession ? [{ date: student.graduationSession?.startDate, title: 'Graduation session recorded', detail: student.graduationSession.name }] : []),
    ...requests.map((request) => ({ date: request.releasedAt || request.approvedAt || request.verifiedAt || request.createdAt, title: `Transcript ${request.status}`, detail: request.issueSerial || request.purpose || 'Official transcript workflow' })),
  ]
    .filter((event) => event.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <section className="mb-6 rounded-xl border border-slate/15 bg-white p-5">
      <h2 className="text-base font-semibold text-navy">Student Academic Timeline</h2>
      <ol className="mt-4 border-l border-indigo/25 pl-4">
        {events.map((event, index) => (
          <li key={`${event.title}-${index}`} className="relative pb-4 last:pb-0">
            <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-indigo ring-4 ring-white" />
            <p className="text-sm font-medium capitalize text-navy">{event.title}</p>
            <p className="text-xs text-slate">{new Date(event.date).toLocaleDateString()} - {event.detail}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

async function loadAll(list, params) {
  const first = await list({ ...params, page: 1, limit: 100 });
  const remaining = await Promise.all(
    Array.from({ length: Math.max(0, (first.data.meta?.totalPages || 1) - 1) }, (_, index) => list({ ...params, page: index + 2, limit: 100 }))
  );
  return [first.data.data, ...remaining.map((response) => response.data.data)].flat();
}

export default function TranscriptPreviewPage() {
  const { studentId } = useParams();
  const { hasRole } = useAuth();
  const canRequest = hasRole(ROLES.ADMIN, ROLES.TRANSCRIPT_OFFICER);
  const canApprove = hasRole(ROLES.ADMIN, ROLES.HOD);

  const [data, setData] = useState(null);
  const [activeRequest, setActiveRequest] = useState(null);
  const [requestHistory, setRequestHistory] = useState([]);
  const [curriculum, setCurriculum] = useState({ courses: [], results: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [requestPurpose, setRequestPurpose] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const [previewRes, requestsRes] = await Promise.all([
        transcriptApi.getPreview(studentId),
        transcriptApi.listRequests({ student: studentId, limit: 100 }),
      ]);
      setData(previewRes.data.data);
      setActiveRequest(requestsRes.data.data[0] || null);
      setRequestHistory(requestsRes.data.data);
      const [courses, results] = await Promise.all([
        loadAll(courseApi.list, { department: previewRes.data.data.student.department?._id, isActive: true, isUndergraduate: true }),
        loadAll(resultApi.list, { student: studentId }),
      ]);
      setCurriculum({ courses, results });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load transcript');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const handleRequest = async () => {
    setBusy(true);
    try {
      await transcriptApi.createRequest(studentId, requestPurpose.trim() || undefined);
      toast.success('Transcript request created');
      setRequestModalOpen(false);
      setRequestPurpose('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to create request');
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    setBusy(true);
    try {
      await transcriptApi.verifyRequest(activeRequest._id);
      toast.success('Marked as verified');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to verify');
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = async () => {
    setBusy(true);
    try {
      await transcriptApi.approveRequest(activeRequest._id);
      toast.success('Transcript approved');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to approve');
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    setBusy(true);
    try {
      await transcriptApi.rejectRequest(activeRequest._id, rejectReason);
      toast.success('Request rejected');
      setRejectModalOpen(false);
      setRejectReason('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to reject');
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async (fn, label, refreshRequestStatus = false) => {
    setBusy(true);
    try {
      await fn();
      // The API changes an approved official request to Released on its first
      // export. Reload it so the progress tracker completes step four without
      // requiring the officer to refresh the browser manually.
      if (refreshRequestStatus) await load();
      toast.success(`${label} download started`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Download failed');
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!data) return <EmptyState title="Transcript unavailable" />;

  const { student, history } = data;
  const canExport = activeRequest && ['approved', 'released'].includes(activeRequest.status);

  return (
    <div>
      <PageHeader
        title={`${student.firstName} ${student.lastName}`}
        description={`${student.matricNumber} · ${student.department?.name}`}
        actions={
          <>
            <Button variant="secondary" isLoading={busy} onClick={() => handleDownload(() => transcriptApi.downloadPreviewPdf(studentId), 'Unofficial PDF')}>
              Unofficial PDF
            </Button>
            {canExport && (
              <>
                <Button variant="secondary" isLoading={busy} onClick={() => handleDownload(() => transcriptApi.downloadPdf(activeRequest._id), 'Official PDF', true)}>
                  Download PDF
                </Button>
                <Button variant="secondary" isLoading={busy} onClick={() => handleDownload(() => transcriptApi.downloadExcel(activeRequest._id), 'Official Excel', true)}>
                  Download Excel
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="mb-6 rounded-xl border border-slate/15 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate">Transcript Request Status</p>
            {activeRequest ? <StatusBadge status={activeRequest.status} /> : <span className="text-sm text-slate">No request yet</span>}
          </div>
          <div className="flex gap-2">
            {canRequest && !activeRequest && (
              <Button isLoading={busy} onClick={() => setRequestModalOpen(true)}>
                Request Official Transcript
              </Button>
            )}
            {canRequest && activeRequest?.status === 'requested' && (
              <Button isLoading={busy} onClick={handleVerify}>
                Mark as Verified
              </Button>
            )}
            {canApprove && activeRequest?.status === 'verified' && (
              <>
                <Button variant="teal" isLoading={busy} onClick={handleApprove}>
                  Approve
                </Button>
                <Button variant="danger" isLoading={busy} onClick={() => setRejectModalOpen(true)}>
                  Reject
                </Button>
              </>
            )}
          </div>
        </div>
        {activeRequest?.status === 'rejected' && (
          <p className="text-sm text-danger">Rejected: {activeRequest.rejectionReason}</p>
        )}
        <RequestProgress status={activeRequest?.status} />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 rounded-xl border border-slate/15 bg-white p-5 sm:grid-cols-4">
        <div>
          <p className="text-xs text-slate">Entry Session</p>
          <p className="font-medium text-navy">{student.entrySession?.name}</p>
        </div>
        <div>
          <p className="text-xs text-slate">Current Level</p>
          <p className="font-medium text-navy">{student.currentLevel?.name}</p>
        </div>
        <div>
          <p className="text-xs text-slate">Graduation Session</p>
          <p className="font-medium text-navy">{student.graduationSession?.name || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-slate">Status</p>
          <p className="font-medium capitalize text-navy">{student.status}</p>
        </div>
      </div>

      <StudentTimeline student={student} history={history} requests={requestHistory} />

      {history.semesters.length === 0 ? (
        <EmptyState title="No approved results yet" description="This student has no approved results on file." />
      ) : (
        history.semesters.map((semester) => <SemesterTable key={`${semester.session._id}-${semester.semester._id}`} semester={semester} />)
      )}

      <div className="rounded-xl border-2 border-indigo bg-white p-6 text-center">
        <p className="text-3xl font-bold text-indigo">{history.cgpa.toFixed(2)}</p>
        <p className="mt-1 font-semibold text-navy">{history.classification || 'Not yet classified'}</p>
        <p className="mt-1 text-sm text-slate">Total Credit Units Earned: {history.totalCreditUnits}</p>
        <p className={`mt-1 text-sm font-medium ${history.specialElectiveUnitsRemaining > 0 ? 'text-warning' : 'text-success'}`}>
          Special electives: {history.specialElectiveCreditUnits} / {history.specialElectiveRequiredUnits} units
          {history.specialElectiveUnitsRemaining > 0 ? ` (${history.specialElectiveUnitsRemaining} remaining)` : ' (requirement met)'}
        </p>
      </div>

      {history.failedCourses.length > 0 && (
        <div className="mt-6 rounded-xl border border-danger/30 bg-danger/5 p-5">
          <h3 className="mb-2 text-sm font-semibold text-danger">Outstanding / Failed Courses</h3>
          <ul className="flex flex-col gap-1 text-sm text-navy">
            {history.failedCourses.map((f) => (
              <li key={f.course._id}>
                {f.course.code} - {f.course.title} ({f.session.name}, {f.semester.name}) &mdash; Grade {f.grade}
              </li>
            ))}
          </ul>
        </div>
      )}

      <CurriculumChecklist courses={curriculum.courses} results={curriculum.results} />

      <Modal
        open={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
        title="Request Official Transcript"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRequestModalOpen(false)}>
              Cancel
            </Button>
            <Button isLoading={busy} onClick={handleRequest}>
              Submit request
            </Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-slate">The request will be verified, approved, and then made available for official PDF or Excel export.</p>
        <Input label="Purpose (optional)" value={requestPurpose} onChange={(e) => setRequestPurpose(e.target.value)} placeholder="e.g. Postgraduate application" />
      </Modal>

      <Modal
        open={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Reject Transcript Request"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejectModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" isLoading={busy} onClick={handleReject} disabled={rejectReason.trim().length < 3}>
              Reject
            </Button>
          </>
        }
      >
        <Input label="Reason" required value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
      </Modal>
    </div>
  );
}
