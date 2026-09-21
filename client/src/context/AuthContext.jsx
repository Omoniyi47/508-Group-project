import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { authApi } from '../api/authApi';
import { setAccessToken, setOnAuthFailure } from '../api/axiosClient';
import { AuthContext } from './authStateContext';

function clearStoredSession() {
  try {
    // Remove the old cache; the server's HttpOnly cookie restores the session.
    localStorage.removeItem('transcript_access_token');
    localStorage.removeItem('transcript_user');
  } catch {
    // Restricted storage must not prevent cookie-based sign-in.
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');
  const sessionRevision = useRef(0);

  const clearSession = useCallback(() => {
    sessionRevision.current += 1;
    setAccessToken(null);
    clearStoredSession();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  useEffect(() => {
    setOnAuthFailure(clearSession);
    return () => setOnAuthFailure(null);
  }, [clearSession]);

  useEffect(() => {
    let cancelled = false;
    const revision = sessionRevision.current;
    clearStoredSession();

    authApi
      .refresh()
      .then(({ data }) => {
        if (cancelled || revision !== sessionRevision.current) return;
        setAccessToken(data.data.accessToken);
        setUser(data.data.user);
        setStatus('authenticated');
      })
      .catch(() => {
        if (!cancelled && revision === sessionRevision.current) clearSession();
      });

    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  const login = useCallback(async (email, password) => {
    const revision = ++sessionRevision.current;
    setAccessToken(null);
    const { data } = await authApi.login(email, password);
    if (revision !== sessionRevision.current) return;
    setAccessToken(data.data.accessToken);
    setUser(data.data.user);
    setStatus('authenticated');
    return data.data.user;
  }, []);

  const logout = useCallback(async () => {
    const request = authApi.logout();
    clearSession();
    await request;
  }, [clearSession]);

  const value = useMemo(
    () => ({
      user,
      status,
      isAuthenticated: status === 'authenticated',
      isLoading: status === 'loading',
      hasRole: (...roles) => !!user && roles.includes(user.role),
      login,
      logout,
    }),
    [user, status, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
