import { useAuth } from '../../context/useAuth';
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
  return Dashboard ? <Dashboard /> : null;
}
