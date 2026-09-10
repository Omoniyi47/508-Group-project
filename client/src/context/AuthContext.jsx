import { useCallback, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/authApi';
import { setAccessToken, setOnAuthFailure } from '../api/axiosClient';
import { AuthContext } from './authStateContext';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'authenticated' | 'unauthenticated'

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  useEffect(() => {
    setOnAuthFailure(clearSession);
  }, [clearSession]);

  useEffect(() => {
    let cancelled = false;

    authApi
      .refresh()
      .then(({ data }) => {
        if (cancelled) return;
        setAccessToken(data.data.accessToken);
        setUser(data.data.user);
        setStatus('authenticated');
      })
      .catch(() => {
        if (!cancelled) setStatus('unauthenticated');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await authApi.login(email, password);
    setAccessToken(data.data.accessToken);
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
