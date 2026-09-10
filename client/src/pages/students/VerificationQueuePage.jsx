import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { verificationApi } from '../../api/verificationApi';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { Spinner } from '../../components/common/Spinner';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';

function studentLabel(student) {
  return student ? `${student.firstName} ${student.lastName} (${student.matricNumber})` : 'a record that no longer exists';
}

function StudentSummary({ student }) {
  if (!student) {
    return (
      <div className="rounded-lg border border-slate/15 p-3">
        <p className="text-sm text-slate">This student record no longer exists.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate/15 p-3">
      <p className="font-medium text-navy">
        {student.firstName} {student.lastName}
      </p>
      <p className="text-xs text-slate">Matric: {student.matricNumber}</p>
      <p className="text-xs text-slate">Department: {student.department?.name || '—'}</p>
    </div>
  );
}

export default function VerificationQueuePage() {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [resolvingItem, setResolvingItem] = useState(null);
  const [keepChoice, setKeepChoice] = useState('matchedStudent');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await verificationApi.list({ status: 'pending', limit: 50 });
      setItems(res.data.data);
    } catch {
      toast.error('Failed to load verification queue');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openResolve = (item) => {
    setResolvingItem(item);
    setKeepChoice('matchedStudent');
    setNotes('');
  };

  const submitResolution = async (action) => {
    setIsSubmitting(true);
    try {
      await verificationApi.resolve(resolvingItem._id, { action, keep: keepChoice, notes: notes || undefined });
      toast.success(action === 'merge' ? 'Records merged' : 'Marked as distinct students');
      setResolvingItem(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to resolve this item');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Duplicate Verification Queue"
        description="Student records flagged as likely duplicates, pending manual review."
      />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState title="No pending duplicates" description="Nothing needs review right now." />
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((item) => (
            <div key={item._id} className="rounded-xl border border-slate/15 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="rounded-full bg-warning px-2 py-0.5 text-xs font-medium text-navy">
                  {Math.round(item.confidenceScore * 100)}% match confidence
                </span>
                <Button size="sm" onClick={() => openResolve(item)}>
                  Review
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <StudentSummary student={item.student} />
                <StudentSummary student={item.matchedStudent} />
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!resolvingItem}
        onClose={() => setResolvingItem(null)}
        title="Resolve Duplicate"
        footer={
          <>
            <Button variant="secondary" onClick={() => setResolvingItem(null)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="teal" isLoading={isSubmitting} onClick={() => submitResolution('distinct')}>
              These are different people
            </Button>
            <Button variant="danger" isLoading={isSubmitting} onClick={() => submitResolution('merge')}>
              Merge as duplicate
            </Button>
          </>
        }
      >
        {resolvingItem && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <StudentSummary student={resolvingItem.student} />
              <StudentSummary student={resolvingItem.matchedStudent} />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-navy">If merging, which record should be kept?</p>
              <div className="flex gap-4 text-sm text-navy">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="keep"
                    checked={keepChoice === 'matchedStudent'}
                    onChange={() => setKeepChoice('matchedStudent')}
                  />
                  Keep {studentLabel(resolvingItem.matchedStudent)}
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="keep" checked={keepChoice === 'student'} onChange={() => setKeepChoice('student')} />
                  Keep {studentLabel(resolvingItem.student)}
                </label>
              </div>
            </div>

            <Input label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        )}
      </Modal>
    </div>
  );
}
