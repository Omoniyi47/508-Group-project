import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RoleGuard } from './RoleGuard';
import { useAuth } from '../../context/useAuth';

vi.mock('../../context/useAuth', () => ({
  useAuth: vi.fn(),
}));

function renderWithGuard(allowedRoles) {
  return render(
    <MemoryRouter initialEntries={['/admin-only']}>
      <Routes>
        <Route element={<RoleGuard allowedRoles={allowedRoles} />}>
          <Route path="/admin-only" element={<div>Protected Content</div>} />
        </Route>
        <Route path="/dashboard" element={<div>Dashboard Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('RoleGuard', () => {
  it('renders the protected route when the user has an allowed role', () => {
    useAuth.mockReturnValue({ hasRole: (role) => role === 'admin' });

    renderWithGuard(['admin']);

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('redirects to the dashboard when the user does not have an allowed role', () => {
    useAuth.mockReturnValue({ hasRole: () => false });

    renderWithGuard(['admin']);

    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });
});
