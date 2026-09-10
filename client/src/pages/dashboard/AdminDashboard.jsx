import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { userApi } from '../../api/userApi';
import { studentApi } from '../../api/studentApi';
import { departmentApi } from '../../api/departmentApi';
import { courseApi } from '../../api/courseApi';
import { verificationApi } from '../../api/verificationApi';
import { resultApi } from '../../api/resultApi';
import { auditLogApi } from '../../api/auditLogApi';
import { Spinner } from '../../components/common/Spinner';
import { Button } from '../../components/common/Button';
import { StatCard } from '../../components/common/StatCard';

const STAT_CARDS = [
  { key: 'users', label: 'Total Users', to: '/users', tone: 'brand' },
  { key: 'students', label: 'Total Students', to: '/students', tone: 'teal' },
  { key: 'departments', label: 'Departments', to: '/departments', tone: 'neutral' },
  { key: 'courses', label: 'Courses', to: '/courses', tone: 'neutral' },
  { key: 'pendingVerifications', label: 'Pending Duplicate Reviews', to: '/verification-queue', tone: 'warning' },
  { key: 'pendingApprovals', label: 'Results Awaiting Approval', to: '/results', tone: 'warning' },
];

const QUICK_ACTIONS = [
  { label: 'Create a new user', to: '/users', variant: 'primary' },
  { label: 'Manage departments', to: '/departments', variant: 'secondary' },
  { label: 'Review duplicate students', to: '/verification-queue', variant: 'secondary' },
  { label: 'Configure grading rules', to: '/grading-rules', variant: 'secondary' },
  { label: 'View audit trail', to: '/audit-trail', variant: 'secondary' },
  { label: 'System settings', to: '/settings', variant: 'secondary' },
  { label: 'Create a backup', to: '/backups', variant: 'secondary' },
];

function formatAction(log) {
  const who = log.actor?.name || log.actorEmail || 'System';
  return `${who} — ${log.action.replace(/_/g, ' ')} (${log.module})`;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load({ refresh = false } = {}) {
      if (refresh) setIsRefreshing(true);
      try {
        const [users, students, departments, courses, verifications, approvals, logs] = await Promise.all([
          userApi.list({ limit: 1 }),
          studentApi.list({ limit: 1 }),
          departmentApi.list({ limit: 1 }),
          courseApi.list({ limit: 1 }),
          verificationApi.list({ limit: 1 }),
          resultApi.list({ limit: 1, status: 'submitted' }),
          auditLogApi.list({ limit: 6 }),
        ]);

        if (cancelled) return;
        setStats({
          users: users.data.meta.total,
          students: students.data.meta.total,
          departments: departments.data.meta.total,
          courses: courses.data.meta.total,
          pendingVerifications: verifications.data.meta.total,
          pendingApprovals: approvals.data.meta.total,
        });
        setActivity(logs.data.data);
        setLastUpdated(new Date());
      } catch {
        if (!cancelled) toast.error('Failed to load dashboard data');
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshDashboard = async () => {
    setIsRefreshing(true);
    try {
      const [users, students, departments, courses, verifications, approvals, logs] = await Promise.all([
        userApi.list({ limit: 1 }),
        studentApi.list({ limit: 1 }),
        departmentApi.list({ limit: 1 }),
        courseApi.list({ limit: 1 }),
        verificationApi.list({ limit: 1 }),
        resultApi.list({ limit: 1, status: 'submitted' }),
        auditLogApi.list({ limit: 6 }),
      ]);
      setStats({
        users: users.data.meta.total,
        students: students.data.meta.total,
        departments: departments.data.meta.total,
        courses: courses.data.meta.total,
        pendingVerifications: verifications.data.meta.total,
        pendingApprovals: approvals.data.meta.total,
      });
      setActivity(logs.data.data);
      setLastUpdated(new Date());
    } catch {
      toast.error('Could not refresh dashboard data');
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo">Academic records console</p>
          <h1 className="mt-1 text-2xl font-semibold text-navy">Administrator Dashboard</h1>
          <p className="mt-1 text-sm text-slate">System-wide overview, approvals, and data stewardship tools.</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && <span className="text-xs text-slate">Updated {lastUpdated.toLocaleTimeString()}</span>}
          <Button variant="secondary" size="sm" isLoading={isRefreshing} onClick={refreshDashboard}>
            Refresh data
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {STAT_CARDS.map((card) => (
          <StatCard key={card.key} value={stats[card.key]} label={card.label} to={card.to} tone={card.tone} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate/15 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-navy">Recent Activity</h2>
              <p className="mt-1 text-xs text-slate">A traceable record of recent system actions.</p>
            </div>
            <Link to="/audit-trail" className="text-xs font-medium text-indigo hover:underline">
              View audit trail
            </Link>
          </div>
          {activity.length === 0 ? (
            <p className="text-sm text-slate">No activity recorded yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {activity.map((log) => (
                <li key={log._id} className="flex flex-col gap-1 border-b border-slate/10 pb-3 text-sm last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-navy">{formatAction(log)}</span>
                  <span className="shrink-0 text-xs text-slate">{new Date(log.createdAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-slate/15 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-navy">Quick Actions</h2>
          <div className="flex flex-col gap-2">
            {QUICK_ACTIONS.map((action) => (
              <Link key={action.to} to={action.to}>
                <Button variant={action.variant} className="w-full justify-start">
                  {action.label}
                </Button>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
