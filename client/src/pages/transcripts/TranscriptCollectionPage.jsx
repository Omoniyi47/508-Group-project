import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { transcriptApi } from '../../api/transcriptApi';
import { studentApi } from '../../api/studentApi';
import { useAuth } from '../../context/useAuth';
import { ROLES } from '../../constants/roles';
import { entryModeLabel } from '../../constants/student';
import { retrievalLabel, transcriptProcessLabel } from '../../constants/transcript';
import { PageHeader } from '../../components/common/PageHeader';
import { StudentPicker } from '../../components/common/StudentPicker';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Spinner } from '../../components/common/Spinner';
import { TranscriptProcess } from '../../components/common/TranscriptProcess';

function StudentSummary({ student }) {
  return <dl className="my-4 grid gap-3 rounded-lg bg-off-white p-4 text-sm sm:grid-cols-2">
    {[
      ['Student', `${student.firstName} ${student.lastName}`], ['Matric number', student.matricNumber],
      ['Department', student.department?.name], ['Entry session', student.entrySession?.name],
      ['Current level', student.currentLevel?.name], ['Mode of entry', entryModeLabel(student.modeOfEntry)],
    ].map(([label, value]) => <div key={label}><dt className="text-slate">{label}</dt><dd className="font-medium text-navy">{value || 'Not recorded'}</dd></div>)}
  </dl>;
}

export default function TranscriptCollectionPage() {
  const [params, setParams] = useSearchParams();
  const requestId = params.get('request');
  const studentId = params.get('student');
  const { hasRole } = useAuth();
  const canProcess = hasRole(ROLES.ADMIN, ROLES.TRANSCRIPT_OFFICER);
  const canApprove = hasRole(ROLES.ADMIN, ROLES.HOD);
  const [step, setStep] = useState(1);
  const [student, setStudent] = useState(null);
  const [method, setMethod] = useState('online');
  const [purpose, setPurpose] = useState('');
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [collector, setCollector] = useState('');
  const [reference, setReference] = useState('');
  const [handedOver, setHandedOver] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setRequest(null);
    setStudent(null);
    setStep(1);
    setCollector(''); setReference(''); setHandedOver(false);
    async function load() {
      try {
        if (requestId) {
          const res = await transcriptApi.getRequest(requestId);
          if (!cancelled) { setRequest(res.data.data); setStudent(res.data.data.student); }
        } else if (studentId) {
          const res = await studentApi.getById(studentId);
          if (!cancelled) setStudent(res.data.data);
        }
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || 'Unable to load this record. Please retry.');
      } finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [requestId, studentId, refresh]);

  const run = async (action, message) => {
    setBusy(true);
    try { await action(); toast.success(message); setRefresh((value) => value + 1); }
    catch (err) { toast.error(err.response?.data?.message || 'Unable to complete this action. Please retry.'); }
    finally { setBusy(false); }
  };
  const submit = async () => {
    setBusy(true);
    try {
      const res = await transcriptApi.createRequest(student._id, purpose, method);
      setParams({ request: res.data.data._id });
      toast.success('Transcript request submitted');
    } catch (err) { toast.error(err.response?.data?.message || 'Unable to submit the request'); }
    finally { setBusy(false); }
  };

  return <div>
    <PageHeader title="Transcript Collection" description="Follow each step from student information to transcript retrieval."
      actions={<Link className="font-medium text-indigo hover:underline" to="/transcript-requests">All transcript requests</Link>} />
    {loading ? <Spinner /> : error ? <div role="alert" className="rounded-xl bg-white p-5"><p>{error}</p><Button onClick={() => setRefresh((value) => value + 1)}>Retry</Button></div> : request ? (
      <section className="rounded-xl border border-slate/15 bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold text-navy">Request progress</h2><span className="text-sm font-semibold text-indigo">{transcriptProcessLabel(request)}</span></div>
        <p className="mt-2 text-sm text-slate">{retrievalLabel(request.retrievalMethod)} · Reference: {request.issueSerial || request._id}</p>
        {student && <StudentSummary student={student} />}
        <TranscriptProcess request={request} />
        <div className="mb-5 rounded-lg bg-off-white p-4 text-sm text-slate">
          <h3 className="font-semibold text-navy">Retrieval</h3>
          <p>{request.releasedAt ? `Completed: ${new Date(request.releasedAt).toLocaleString()}` : request.retrievalMethod === 'manual' ? 'After approval, prepare the printed transcript, check the collector?s identity, and confirm handover below.' : 'After approval, download the official PDF or Excel file below.'}</p>
        </div>
        {request.status === 'rejected' && <div role="status" className="mb-4 rounded-lg bg-danger/5 p-4 text-danger">Request rejected: {request.rejectionReason}. Correct the records before starting a new request.</div>}
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" disabled={busy} onClick={() => setRefresh((value) => value + 1)}>Refresh progress</Button>
          {student && <Link className="font-medium text-indigo hover:underline" to={`/transcripts/${student._id}`}>Review transcript</Link>}
          {canProcess && request.status === 'requested' && <Button isLoading={busy} onClick={() => run(() => transcriptApi.verifyRequest(request._id), 'Records verified')}>Mark records verified</Button>}
          {canApprove && request.status === 'verified' && <Button isLoading={busy} onClick={() => run(() => transcriptApi.approveRequest(request._id), 'Transcript approved')}>Approve transcript</Button>}
          {['approved', 'released'].includes(request.status) && <>
            <Button isLoading={busy} onClick={() => run(() => transcriptApi.downloadPdf(request._id), 'PDF downloaded')}>{request.retrievalMethod === 'manual' ? 'Download PDF for printing' : 'Download official PDF'}</Button>
            <Button variant="secondary" isLoading={busy} onClick={() => run(() => transcriptApi.downloadExcel(request._id), 'Excel downloaded')}>Download Excel</Button>
          </>}
          {canProcess && ['rejected', 'released'].includes(request.status) && student && <Link to={`/transcript-collection?student=${student._id}`} className="font-medium text-indigo hover:underline" onClick={() => setStep(1)}>Start another request</Link>}
        </div>
        {request.retrievalMethod === 'manual' && request.status === 'approved' && canProcess && <form className="mt-6 space-y-4 border-t border-slate/15 pt-5" onSubmit={(event) => { event.preventDefault(); if (handedOver) run(() => transcriptApi.collectRequest(request._id, { collectedByName: collector.trim(), collectionReference: reference.trim() }), 'Physical collection confirmed'); }}>
          <h3 className="font-semibold text-navy">Confirm physical collection</h3>
          <p className="text-sm text-slate">Complete this after the printed transcript has been handed to the collector. Downloading for printing does not confirm collection.</p>
          <Input label="Collector’s full name" required minLength={2} maxLength={150} value={collector} onChange={(event) => setCollector(event.target.value)} />
          <Input label="Collection receipt / reference" required minLength={3} maxLength={150} value={reference} onChange={(event) => setReference(event.target.value)} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={handedOver} onChange={(event) => setHandedOver(event.target.checked)} />I have checked the collector’s identity and handed over the transcript.</label>
          <Button type="submit" isLoading={busy} disabled={!handedOver || collector.trim().length < 2 || reference.trim().length < 3}>Confirm collection</Button>
        </form>}
        {request.retrievalMethod === 'manual' && request.status === 'released' && <p className="mt-5 rounded-lg bg-teal/5 p-4 text-sm text-navy">Collected by {request.collectedByName || 'Not recorded'} · Receipt: {request.collectionReference || 'Not recorded'}</p>}
      </section>
    ) : !canProcess ? <p className="rounded-xl bg-white p-5">A transcript officer can start a request. Open <Link className="text-indigo underline" to="/transcript-requests">Transcript Requests</Link> to track an existing request.</p> : (
      <section className="mx-auto max-w-3xl rounded-xl border border-slate/15 bg-white p-5 sm:p-7">
        <ol className="mb-6 grid grid-cols-3 gap-3 text-sm" aria-label="New transcript request steps">{['Student information', 'Retrieval method', 'Review and submit'].map((label, index) => <li key={label} aria-current={step === index + 1 ? 'step' : undefined} className={`border-b-2 pb-3 ${step === index + 1 ? 'border-indigo font-semibold text-indigo' : 'border-slate/15 text-slate'}`}>{index + 1}. {label}</li>)}</ol>
        {step === 1 && <>
          <h2 className="mb-4 text-lg font-semibold text-navy">Select and check student information</h2>
          <StudentPicker value={student?._id || ''} onChange={(_id, selected) => setStudent(selected)} floating={false} />
          {student && <StudentSummary student={student} />}
          <p className="my-4 text-sm text-slate">Check the matric number, department and entry details. Update incorrect details in <Link to="/students" className="text-indigo underline">Student Information</Link> before continuing.</p>
          <Button disabled={!student} onClick={() => setStep(2)}>Continue to retrieval method</Button>
        </>}
        {step === 2 && <>
          <fieldset className="space-y-3"><legend className="mb-4 text-lg font-semibold text-navy">How will the transcript be retrieved?</legend>
            {[['online', 'Online retrieval', 'Download the approved official transcript as a PDF or Excel file.'], ['manual', 'Manual retrieval', 'Collect a printed transcript in person. An officer records the handover.']].map(([value, label, detail]) => <label key={value} className={`flex cursor-pointer gap-3 rounded-lg border p-4 ${method === value ? 'border-indigo bg-indigo/5' : 'border-slate/20'}`}><input type="radio" name="retrievalMethod" value={value} checked={method === value} onChange={() => setMethod(value)} /><span><span className="block font-medium text-navy">{label}</span><span className="text-sm text-slate">{detail}</span></span></label>)}
          </fieldset>
          <div className="my-4"><Input label="Purpose (optional)" value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="e.g. Postgraduate application" /></div>
          <div className="flex gap-3"><Button variant="secondary" onClick={() => setStep(1)}>Back</Button><Button onClick={() => setStep(3)}>Review request</Button></div>
        </>}
        {step === 3 && student && <>
          <h2 className="text-lg font-semibold text-navy">Review before submitting</h2><StudentSummary student={student} />
          <p className="font-medium text-navy">{retrievalLabel(method)}</p><p className="my-2 text-sm text-slate">Purpose: {purpose || 'Not specified'}</p>
          <p className="my-4 text-sm text-slate">Next: record verification, department approval, then {method === 'manual' ? 'physical collection and handover confirmation' : 'online download'}. You can track progress from Transcript Requests.</p>
          <div className="flex gap-3"><Button variant="secondary" disabled={busy} onClick={() => setStep(2)}>Back</Button><Button isLoading={busy} onClick={submit}>Submit transcript request</Button></div>
        </>}
      </section>
    )}
  </div>;
}
