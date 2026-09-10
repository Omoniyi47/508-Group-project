import { useCallback, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/authApi';
import { setAccessToken, setOnAuthFailure } from '../api/axiosClient';
import { AuthContext } from './authStateContext';

const ACCESS_TOKEN_KEY = 'transcript_access_token';
const USER_KEY = 'transcript_user';

function readStoredSession() {
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  const storedUser = localStorage.getItem(USER_KEY);

  if (!accessToken || !storedUser) return null;

  try {
    return { accessToken, user: JSON.parse(storedUser) };
  } catch {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

function persistSession(accessToken, user) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearStoredSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function AuthProvider({ children }) {
  const storedSession = readStoredSession();
  const [user, setUser] = useState(storedSession?.user ?? null);
  const [status, setStatus] = useState(storedSession ? 'authenticated' : 'loading');

  const clearSession = useCallback(() => {
    setAccessToken(null);
    clearStoredSession();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  useEffect(() => {
    setOnAuthFailure(clearSession);
  }, [clearSession]);

  useEffect(() => {
    let cancelled = false;

    if (storedSession) setAccessToken(storedSession.accessToken);

    authApi
      .refresh()
      .then(({ data }) => {
        if (cancelled) return;
        setAccessToken(data.data.accessToken);
        persistSession(data.data.accessToken, data.data.user);
        setUser(data.data.user);
        setStatus('authenticated');
      })
      .catch(() => {
        if (!cancelled && !storedSession) setStatus('unauthenticated');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await authApi.login(email, password);
    setAccessToken(data.data.accessToken);
    persistSession(data.data.accessToken, data.data.user);
    setUser(data.data.user);
    setStatus('authenticated');
    return data.data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearSession();
    }
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
