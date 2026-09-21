import { StrictMode } from 'react';
import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from './AuthContext';
import { useAuth } from './useAuth';
import { sessionClient, setAccessToken, setOnAuthFailure } from '../api/axiosClient';

const originalAdapter = sessionClient.defaults.adapter;
const session = { data: { accessToken: 'session-token', user: { name: 'Staff Member', role: 'admin' } } };
const response = (config, data = session) => ({ config, data, status: 200, statusText: 'OK', headers: {} });
function unauthorized(config) {
  return new axios.AxiosError('No cookie', 'ERR_BAD_RESPONSE', config, {}, { ...response(config), status: 401 });
}
function SessionView() {
  const auth = useAuth();
  return <>
    <p data-testid="status">{auth.status}</p>
    {auth.isAuthenticated && <p>Dashboard for {auth.user.name}</p>}
    <button onClick={() => auth.login('staff@test.edu', 'test-password').catch(() => {})}>Sign in</button>
    <button onClick={() => auth.logout().catch(() => {})}>Sign out</button>
  </>;
}
function renderSession(strict = false) {
  const app = <AuthProvider><SessionView /></AuthProvider>;
  return render(strict ? <StrictMode>{app}</StrictMode> : app);
}

beforeEach(() => { localStorage.clear(); setAccessToken(null); setOnAuthFailure(null); });
afterEach(() => {
  vi.restoreAllMocks();
  sessionClient.defaults.adapter = originalAdapter;
  setAccessToken(null);
  setOnAuthFailure(null);
});

describe('session restoration after reload', () => {
  it('waits for cookie restoration before showing protected content, ignoring stale cached users', async () => {
    localStorage.setItem('transcript_access_token', 'expired-token');
    localStorage.setItem('transcript_user', JSON.stringify({ name: 'Outdated User', role: 'admin' }));
    let finish;
    sessionClient.defaults.adapter = (config) => new Promise((resolve) => { finish = () => resolve(response(config)); });
    renderSession();
    expect(screen.getByTestId('status')).toHaveTextContent('loading');
    expect(screen.queryByText(/Dashboard for/)).not.toBeInTheDocument();
    await waitFor(() => expect(finish).toBeTypeOf('function'));
    await act(async () => finish());
    expect(await screen.findByText('Dashboard for Staff Member')).toBeInTheDocument();
    expect(localStorage.getItem('transcript_access_token')).toBeNull();
    expect(localStorage.getItem('transcript_user')).toBeNull();
  });

  it('restores a logged-in session on a new mount with no stored access token', async () => {
    let cookiePresent = false;
    const adapter = vi.fn(async (config) => {
      if (config.url === '/auth/login') cookiePresent = true;
      if (config.url === '/auth/refresh' && !cookiePresent) throw unauthorized(config);
      return response(config);
    });
    sessionClient.defaults.adapter = adapter;
    const user = userEvent.setup();
    const first = renderSession();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Dashboard for Staff Member')).toBeInTheDocument();
    first.unmount();
    setAccessToken(null); // A real page reload loses the JavaScript access token.
    renderSession();
    expect(await screen.findByText('Dashboard for Staff Member')).toBeInTheDocument();
    expect(localStorage.getItem('transcript_access_token')).toBeNull();
    expect(adapter.mock.calls.filter(([config]) => config.url === '/auth/refresh')).toHaveLength(2);
  });

  it('uses one refresh during React Strict Mode effect replay', async () => {
    const adapter = vi.fn(async (config) => response(config));
    sessionClient.defaults.adapter = adapter;
    renderSession(true);
    expect(await screen.findByText('Dashboard for Staff Member')).toBeInTheDocument();
    expect(adapter).toHaveBeenCalledOnce();
  });

  it('allows cookie restoration when localStorage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('Storage blocked'); });
    sessionClient.defaults.adapter = async (config) => response(config);
    renderSession();
    expect(await screen.findByText('Dashboard for Staff Member')).toBeInTheDocument();
  });

  it('returns to sign-in once when the refresh cookie has expired', async () => {
    const adapter = vi.fn(async (config) => { throw unauthorized(config); });
    sessionClient.defaults.adapter = adapter;
    renderSession(true);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));
    expect(adapter).toHaveBeenCalledOnce();
    expect(screen.queryByText(/Dashboard for/)).not.toBeInTheDocument();
  });

  it('does not restore a pending session after the user signs out', async () => {
    let finishRefresh;
    sessionClient.defaults.adapter = (config) => config.url === '/auth/refresh'
      ? new Promise((resolve) => { finishRefresh = () => resolve(response(config)); })
      : Promise.resolve(response(config));
    const user = userEvent.setup();
    renderSession();
    await waitFor(() => expect(finishRefresh).toBeTypeOf('function'));
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    await act(async () => finishRefresh());
    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
    expect(screen.queryByText(/Dashboard for/)).not.toBeInTheDocument();
  });
});
