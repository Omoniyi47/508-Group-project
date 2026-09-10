import { Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { RoleGuard } from './components/layout/RoleGuard';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { ROLES } from './constants/roles';
import LoginPage from './pages/auth/LoginPage';
import DashboardHome from './pages/dashboard/DashboardHome';
import UsersPage from './pages/users/UsersPage';
import FacultiesPage from './pages/academics/FacultiesPage';
import DepartmentsPage from './pages/academics/DepartmentsPage';
import SessionsPage from './pages/academics/SessionsPage';
import SemestersPage from './pages/academics/SemestersPage';
import LevelsPage from './pages/academics/LevelsPage';
import GradingRulesPage from './pages/academics/GradingRulesPage';
import CoursesPage from './pages/academics/CoursesPage';
import StudentsPage from './pages/students/StudentsPage';
import VerificationQueuePage from './pages/students/VerificationQueuePage';
import ResultsPage from './pages/results/ResultsPage';
import UploadWizardPage from './pages/results/UploadWizardPage';
import TranscriptPreviewPage from './pages/transcripts/TranscriptPreviewPage';
import TranscriptRequestsPage from './pages/transcripts/TranscriptRequestsPage';
import AuditTrailPage from './pages/audit/AuditTrailPage';
import SystemSettingsPage from './pages/settings/SystemSettingsPage';
import BackupsPage from './pages/backups/BackupsPage';
import NotificationsPage from './pages/notifications/NotificationsPage';
import NotFound from './pages/NotFound';

function LoginRoute() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <LoginPage />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<DashboardHome />} />
          <Route path="/courses" element={<CoursesPage />} />
          <Route path="/students" element={<StudentsPage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />

          <Route element={<RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.TRANSCRIPT_OFFICER]} />}>
            <Route path="/verification-queue" element={<VerificationQueuePage />} />
          </Route>

          <Route element={<RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.RESULT_OFFICER, ROLES.TRANSCRIPT_OFFICER, ROLES.HOD]} />}>
            <Route path="/transcripts/:studentId" element={<TranscriptPreviewPage />} />
            <Route path="/transcript-requests" element={<TranscriptRequestsPage />} />
          </Route>

          <Route element={<RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.RESULT_OFFICER]} />}>
            <Route path="/results/upload" element={<UploadWizardPage />} />
          </Route>

          <Route element={<RoleGuard allowedRoles={[ROLES.ADMIN]} />}>
            <Route path="/users" element={<UsersPage />} />
            <Route path="/faculties" element={<FacultiesPage />} />
            <Route path="/departments" element={<DepartmentsPage />} />
            <Route path="/sessions" element={<SessionsPage />} />
            <Route path="/semesters" element={<SemestersPage />} />
            <Route path="/levels" element={<LevelsPage />} />
            <Route path="/grading-rules" element={<GradingRulesPage />} />
            <Route path="/audit-trail" element={<AuditTrailPage />} />
            <Route path="/settings" element={<SystemSettingsPage />} />
            <Route path="/backups" element={<BackupsPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster richColors position="top-right" offset={{ top: 80 }} />
      <AppRoutes />
    </AuthProvider>
  );
}
