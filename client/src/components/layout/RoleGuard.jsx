import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';

export function RoleGuard({ allowedRoles }) {
  const { hasRole } = useAuth();

  if (!hasRole(...allowedRoles)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
