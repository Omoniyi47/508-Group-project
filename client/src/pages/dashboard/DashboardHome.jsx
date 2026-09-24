import { useAuth } from '../../context/useAuth';
import { Link } from 'react-router-dom';
import { ROLES } from '../../constants/roles';
import AdminDashboard from './AdminDashboard';
import ResultOfficerDashboard from './ResultOfficerDashboard';
import HodDashboard from './HodDashboard';
import TranscriptOfficerDashboard from './TranscriptOfficerDashboard';

const DASHBOARDS_BY_ROLE = {
  [ROLES.ADMIN]: AdminDashboard,
  [ROLES.RESULT_OFFICER]: ResultOfficerDashboard,
  [ROLES.HOD]: HodDashboard,
  [ROLES.TRANSCRIPT_OFFICER]: TranscriptOfficerDashboard,
};

export default function DashboardHome() {
  const { user } = useAuth();
  const Dashboard = DASHBOARDS_BY_ROLE[user?.role];
  return Dashboard ? <>
    <nav aria-label="Transcript workflow" className="mb-6 grid gap-3 sm:grid-cols-3">
      {[
        ['/students', 'Student Information', 'Check student details and mode of entry.'],
        ['/transcript-requests', 'Transcript Requests', 'Track verification, approval and retrieval.'],
        ['/transcript-collection', 'Step-by-step Collection', 'Request online download or manual collection.'],
      ].map(([to, title, description]) => <Link key={to} to={to} className="rounded-xl border border-indigo/20 bg-white p-4 hover:bg-indigo/5"><h2 className="font-semibold text-indigo">{title}</h2><p className="mt-1 text-sm text-slate">{description}</p></Link>)}
    </nav>
    <Dashboard />
  </> : null;
}
