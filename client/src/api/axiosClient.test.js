import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { apiClient, sessionClient, refreshSession, setAccessToken, setOnAuthFailure } from './axiosClient';
import { authApi } from './authApi';

const originalApiAdapter = apiClient.defaults.adapter;
const originalSessionAdapter = sessionClient.defaults.adapter;
const refreshed = { data: { accessToken: 'renewed-token', user: { name: 'Staff', role: 'admin' } } };
const response = (config, data = {}) => ({ config, data, status: 200, statusText: 'OK', headers: {} });
function failure(config, status) {
  return new axios.AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, {}, { ...response(config), status });
}

beforeEach(() => { setAccessToken(null); setOnAuthFailure(null); });
afterEach(() => {
  setAccessToken(null);
  setOnAuthFailure(null);
  apiClient.defaults.adapter = originalApiAdapter;
  sessionClient.defaults.adapter = originalSessionAdapter;
});

describe('session requests', () => {
  it('sends login, refresh, and logout through the same-origin cookie proxy', async () => {
    const adapter = vi.fn(async (config) => response(config, refreshed));
    sessionClient.defaults.adapter = adapter;
    await authApi.login('staff@test.edu', 'test-password');
    await authApi.refresh();
    await authApi.logout();
    expect(adapter.mock.calls.map(([config]) => sessionClient.getUri(config))).toEqual([
      '/api/auth/login', '/api/auth/refresh', '/api/auth/logout',
    ]);
    expect(adapter.mock.calls.every(([config]) => config.withCredentials)).toBe(true);
    expect(apiClient.defaults.baseURL).toBe('https://five08-group-project.onrender.com/api');
  });

  it('shares one refresh between reload recovery and simultaneous expired requests', async () => {
    setAccessToken('expired-token');
    let finishRefresh;
    const adapter = vi.fn((config) => new Promise((resolve) => { finishRefresh = () => resolve(response(config, refreshed)); }));
    sessionClient.defaults.adapter = adapter;
    apiClient.defaults.adapter = async (config) => {
      if (config.headers.Authorization !== 'Bearer renewed-token') throw failure(config, 401);
      return response(config, { success: true });
    };
    const restore = refreshSession();
    const requests = [apiClient.get('/students'), apiClient.get('/courses')];
    await waitFor(() => expect(adapter).toHaveBeenCalledOnce());
    finishRefresh();
    await expect(restore).resolves.toMatchObject({ data: refreshed });
    const results = await Promise.all(requests);
    expect(results.every((res) => res.data.success)).toBe(true);
    expect(adapter).toHaveBeenCalledOnce();
  });

  it('does not refresh again when refresh itself returns 401', async () => {
    const adapter = vi.fn(async (config) => { throw failure(config, 401); });
    sessionClient.defaults.adapter = adapter;
    await expect(authApi.refresh()).rejects.toMatchObject({ response: { status: 401 } });
    expect(adapter).toHaveBeenCalledOnce();
  });

  it('ends an expired session once when simultaneous requests cannot refresh', async () => {
    setAccessToken('expired-token');
    const onFailure = vi.fn();
    setOnAuthFailure(onFailure);
    apiClient.defaults.adapter = async (config) => { throw failure(config, 401); };
    const adapter = vi.fn(async (config) => { throw failure(config, 401); });
    sessionClient.defaults.adapter = adapter;
    await Promise.allSettled([apiClient.get('/students'), apiClient.get('/courses')]);
    expect(adapter).toHaveBeenCalledOnce();
    expect(onFailure).toHaveBeenCalledOnce();
  });

  it('does not clear a session for a temporary refresh network/server failure', async () => {
    setAccessToken('existing-token');
    const onFailure = vi.fn();
    setOnAuthFailure(onFailure);
    apiClient.defaults.adapter = async (config) => { throw failure(config, 401); };
    sessionClient.defaults.adapter = async (config) => { throw failure(config, 503); };
    await expect(apiClient.get('/students')).rejects.toMatchObject({ response: { status: 503 } });
    expect(onFailure).not.toHaveBeenCalled();
    apiClient.defaults.adapter = async (config) => response(config, { authorization: config.headers.Authorization });
    expect((await apiClient.get('/students')).data.authorization).toBe('Bearer existing-token');
  });

  it('reuses the renewed token for a late 401 from an older request', async () => {
    setAccessToken('expired-token');
    let rejectOldRequest;
    apiClient.defaults.adapter = async (config) => {
      if (config.headers.Authorization === 'Bearer renewed-token') return response(config);
      return new Promise((_, reject) => { rejectOldRequest = () => reject(failure(config, 401)); });
    };
    const adapter = vi.fn(async (config) => response(config, refreshed));
    sessionClient.defaults.adapter = adapter;
    const oldRequest = apiClient.get('/students');
    await waitFor(() => expect(rejectOldRequest).toBeTypeOf('function'));
    await refreshSession();
    rejectOldRequest();
    await expect(oldRequest).resolves.toMatchObject({ status: 200 });
    expect(adapter).toHaveBeenCalledOnce();
  });

  it('ignores a refresh response that finishes after logout', async () => {
    let finishRefresh;
    sessionClient.defaults.adapter = (config) => new Promise((resolve) => { finishRefresh = () => resolve(response(config, refreshed)); });
    const pending = refreshSession();
    const rejected = expect(pending).rejects.toMatchObject({ code: 'ERR_CANCELED' });
    await waitFor(() => expect(finishRefresh).toBeTypeOf('function'));
    setAccessToken(null);
    finishRefresh();
    await rejected;
    apiClient.defaults.adapter = async (config) => response(config, { authorization: config.headers.Authorization });
    expect((await apiClient.get('/students')).data.authorization).toBeUndefined();
  });

  it('waits for cookie rotation before sending logout so a late cookie cannot restore the session', async () => {
    let finishRefresh;
    const adapter = vi.fn((config) => config.url === '/auth/refresh'
      ? new Promise((resolve) => { finishRefresh = () => resolve(response(config, refreshed)); })
      : Promise.resolve(response(config)));
    sessionClient.defaults.adapter = adapter;
    const pending = refreshSession();
    const signout = authApi.logout();
    const rejected = expect(pending).rejects.toMatchObject({ code: 'ERR_CANCELED' });
    setAccessToken(null);
    await waitFor(() => expect(finishRefresh).toBeTypeOf('function'));
    expect(adapter).toHaveBeenCalledOnce();
    finishRefresh();
    await rejected;
    await signout;
    expect(adapter.mock.calls.map(([config]) => config.url)).toEqual(['/auth/refresh', '/auth/logout']);
  });

  it('does not let an older failed refresh clear a newly signed-in session', async () => {
    setAccessToken('old-token');
    const onFailure = vi.fn();
    setOnAuthFailure(onFailure);
    let rejectRefresh;
    apiClient.defaults.adapter = async (config) => { throw failure(config, 401); };
    sessionClient.defaults.adapter = (config) => new Promise((_, reject) => { rejectRefresh = () => reject(failure(config, 401)); });
    const oldRequest = apiClient.get('/students');
    const rejected = expect(oldRequest).rejects.toMatchObject({ response: { status: 401 } });
    await waitFor(() => expect(rejectRefresh).toBeTypeOf('function'));
    setAccessToken('new-login-token');
    rejectRefresh();
    await rejected;
    expect(onFailure).not.toHaveBeenCalled();
    apiClient.defaults.adapter = async (config) => response(config, { authorization: config.headers.Authorization });
    expect((await apiClient.get('/students')).data.authorization).toBe('Bearer new-login-token');
  });
});
