import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { NAV_ITEMS } from '../../routes/navConfig';
import { ROLE_LABELS } from '../../constants/roles';
import { Button } from '../common/Button';
import { NotificationBell } from './NotificationBell';

function SidebarContent({ items, onNavigate }) {
  return (
    <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-1 px-3 py-4">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive ? 'bg-indigo text-white' : 'text-slate-200 text-off-white/80 hover:bg-white/10'
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

export function DashboardLayout() {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const items = NAV_ITEMS.filter((item) => item.roles.some((role) => hasRole(role)));

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-off-white">
      <aside className="app-sidebar hidden w-64 flex-col md:flex">
        <div className="flex h-16 items-center gap-2 border-b border-white/10 px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo text-sm font-bold text-white">TR</div>
          <span className="text-sm font-semibold text-white">Transcript Records</span>
        </div>
        <SidebarContent items={items} />
        <div className="border-t border-white/10 px-4 py-3 text-xs text-off-white/60">
          <span className="mr-2 inline-block h-2 w-2 rounded-full bg-teal" />
          Secure staff workspace
        </div>
      </aside>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileNavOpen(false)} aria-hidden="true" />
          <aside className="app-sidebar relative flex w-64 flex-col">
            <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
              <span className="text-sm font-semibold text-white">Transcript System</span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close navigation menu"
                className="text-white/70 hover:text-white"
              >
                ✕
              </button>
            </div>
            <SidebarContent items={items} onNavigate={() => setMobileNavOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate/20 bg-white px-4 md:px-6">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation menu"
            className="text-navy md:hidden"
          >
            ☰
          </button>

          <div className="ml-auto flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-medium text-teal">Secure session</p>
              <p className="text-xs text-slate">Academic records portal</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-navy">{user?.name}</p>
              <p className="text-xs text-slate">{ROLE_LABELS[user?.role] || user?.role}</p>
            </div>
            <NotificationBell />
            <Button variant="secondary" size="sm" onClick={handleLogout}>
              Sign out
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
