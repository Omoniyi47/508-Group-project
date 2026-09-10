import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { useAuth } from '../../context/useAuth';
import { studentApi } from '../../api/studentApi';
import { resultApi } from '../../api/resultApi';
import { transcriptApi } from '../../api/transcriptApi';
import { Spinner } from '../../components/common/Spinner';
import { Button } from '../../components/common/Button';
import { StatCard } from '../../components/common/StatCard';

const STAT_CARDS = [
  { key: 'students', label: 'Students in My Department', to: '/students', tone: 'teal' },
  { key: 'pendingResults', label: 'Results Awaiting My Approval', to: '/results?status=submitted', tone: 'warning' },
  { key: 'pendingTranscripts', label: 'Transcripts Awaiting My Approval', to: '/transcript-requests', tone: 'warning' },
];

function GradeChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { grade, count } = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate/20 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-navy">Grade {grade}</p>
      <p className="text-slate">{count} approved result{count === 1 ? '' : 's'}</p>
    </div>
  );
}

export default function HodDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [gradeData, setGradeData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [students, pendingResults, pendingTranscripts, distribution] = await Promise.all([
          studentApi.list({ limit: 1 }),
          resultApi.list({ limit: 1, status: 'submitted' }),
          transcriptApi.listRequests({ limit: 1, status: 'verified' }),
          resultApi.gradeDistribution(),
        ]);
        if (cancelled) return;
        setStats({
          students: students.data.meta.total,
          pendingResults: pendingResults.data.meta.total,
          pendingTranscripts: pendingTranscripts.data.meta.total,
        });
        setGradeData(distribution.data.data);
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

  const hasApprovedResults = gradeData.some((d) => d.count > 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Welcome back, {user?.name?.split(' ')[0]}</h1>
        <p className="mt-1 text-sm text-slate">Head of Department — {user?.department?.name || 'your department'}.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {STAT_CARDS.map((card) => (
          <StatCard key={card.key} value={stats[card.key]} label={card.label} to={card.to} tone={card.tone} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate/15 bg-white p-5 lg:col-span-2">
          <h2 className="mb-1 text-sm font-semibold text-navy">Grade Distribution</h2>
          <p className="mb-4 text-xs text-slate">Approved results in your department, by letter grade.</p>
          {!hasApprovedResults ? (
            <p className="py-8 text-center text-sm text-slate">No approved results yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={gradeData} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#64748B" strokeOpacity={0.12} vertical={false} />
                <XAxis dataKey="grade" tickLine={false} axisLine={{ stroke: '#64748B', strokeOpacity: 0.3 }} tick={{ fill: '#64748B', fontSize: 12 }} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#64748B', fontSize: 12 }} width={28} />
                <Tooltip content={<GradeChartTooltip />} cursor={{ fill: '#4F46E5', fillOpacity: 0.06 }} />
                <Bar dataKey="count" fill="#4F46E5" radius={[4, 4, 0, 0]} maxBarSize={48}>
                  <LabelList dataKey="count" position="top" style={{ fill: '#0F172A', fontSize: 12, fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border border-slate/15 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-navy">Quick Actions</h2>
          <div className="flex flex-col gap-2">
            <Link to="/results?status=submitted">
              <Button className="w-full justify-start">Review pending results</Button>
            </Link>
            <Link to="/transcript-requests">
              <Button variant="secondary" className="w-full justify-start">
                Review transcript requests
              </Button>
            </Link>
            <Link to="/students">
              <Button variant="secondary" className="w-full justify-start">
                View department students
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
