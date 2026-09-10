import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../../context/useAuth';
import { studentApi } from '../../api/studentApi';
import { verificationApi } from '../../api/verificationApi';
import { transcriptApi } from '../../api/transcriptApi';
import { Spinner } from '../../components/common/Spinner';
import { Button } from '../../components/common/Button';
import { StatCard } from '../../components/common/StatCard';

const STAT_CARDS = [
  { key: 'students', label: 'Total Students', to: '/students', tone: 'teal' },
  { key: 'pendingVerifications', label: 'Pending Duplicate Reviews', to: '/verification-queue', tone: 'warning' },
  { key: 'awaitingMyVerification', label: 'Requests Awaiting My Verification', to: '/transcript-requests', tone: 'warning' },
  { key: 'awaitingHodApproval', label: 'Awaiting HOD Approval', to: '/transcript-requests', tone: 'neutral' },
];

export default function TranscriptOfficerDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [students, verifications, requested, verified] = await Promise.all([
          studentApi.list({ limit: 1 }),
          verificationApi.list({ limit: 1 }),
          transcriptApi.listRequests({ limit: 1, status: 'requested' }),
          transcriptApi.listRequests({ limit: 1, status: 'verified' }),
        ]);
        if (cancelled) return;
        setStats({
          students: students.data.meta.total,
          pendingVerifications: verifications.data.meta.total,
          awaitingMyVerification: requested.data.meta.total,
          awaitingHodApproval: verified.data.meta.total,
        });
      } catch {
        if (!cancelled) toast.error('Failed to load dashboard data');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Welcome back, {user?.name?.split(' ')[0]}</h1>
        <p className="mt-1 text-sm text-slate">Transcript Officer — cross-department record verification and export.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {STAT_CARDS.map((card) => (
          <StatCard key={card.key} value={stats[card.key]} label={card.label} to={card.to} tone={card.tone} />
        ))}
      </div>

      <div className="rounded-xl border border-slate/15 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-navy">Quick Actions</h2>
        <div className="flex flex-wrap gap-2">
          <Link to="/verification-queue">
            <Button>Review duplicate students</Button>
          </Link>
          <Link to="/transcript-requests">
            <Button variant="secondary">Manage transcript requests</Button>
          </Link>
          <Link to="/students">
            <Button variant="secondary">Search students</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
