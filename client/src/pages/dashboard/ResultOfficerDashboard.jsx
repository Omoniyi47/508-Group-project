import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../../context/useAuth';
import { studentApi } from '../../api/studentApi';
import { resultApi } from '../../api/resultApi';
import { Spinner } from '../../components/common/Spinner';
import { Button } from '../../components/common/Button';
import { StatCard } from '../../components/common/StatCard';

const STAT_CARDS = [
  { key: 'students', label: 'Students in My Department', to: '/students', tone: 'teal' },
  { key: 'draft', label: 'My Draft Results', to: '/results?status=draft', tone: 'neutral' },
  { key: 'submitted', label: 'Awaiting HOD Approval', to: '/results?status=submitted', tone: 'warning' },
  { key: 'rejected', label: 'Rejected — Needs Correction', to: '/results?status=rejected', tone: 'danger' },
];

export default function ResultOfficerDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [students, draft, submitted, rejected] = await Promise.all([
          studentApi.list({ limit: 1 }),
          resultApi.list({ limit: 1, status: 'draft' }),
          resultApi.list({ limit: 1, status: 'submitted' }),
          resultApi.list({ limit: 1, status: 'rejected' }),
        ]);
        if (cancelled) return;
        setStats({
          students: students.data.meta.total,
          draft: draft.data.meta.total,
          submitted: submitted.data.meta.total,
          rejected: rejected.data.meta.total,
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
        <p className="mt-1 text-sm text-slate">
          Department Result Officer — {user?.department?.name || 'your department'}.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {STAT_CARDS.map((card) => (
          <StatCard key={card.key} value={stats[card.key]} label={card.label} to={card.to} tone={card.tone} />
        ))}
      </div>

      {stats.rejected > 0 && (
        <div className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          You have {stats.rejected} result{stats.rejected === 1 ? '' : 's'} rejected by your HOD that need correction and resubmission.
        </div>
      )}

      <div className="rounded-xl border border-slate/15 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-navy">Quick Actions</h2>
        <div className="flex flex-wrap gap-2">
          <Link to="/results">
            <Button>Enter or review results</Button>
          </Link>
          <Link to="/results/upload">
            <Button variant="secondary">Upload CSV / Excel</Button>
          </Link>
          <Link to="/students">
            <Button variant="secondary">Manage students</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
