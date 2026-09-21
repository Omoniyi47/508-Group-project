import axios from 'axios';

const API_BASE_URL = 'https://five08-group-project.onrender.com/api';

let accessToken = null;
let onAuthFailure = null;
let sessionVersion = 0;
let refreshPromise = null;

export function setAccessToken(token) {
  accessToken = token;
  sessionVersion += 1;
  refreshPromise = null;
}

export function setOnAuthFailure(callback) {
  onAuthFailure = callback;
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// Vercel (and Vite in development) forwards /api to Render. Auth cookies are
// therefore first-party, even when the browser blocks third-party cookies.
// This instance has no response interceptor: a failed refresh is never retried.
export const sessionClient = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

function attachAccessToken(config) {
  config._sessionVersion = sessionVersion;
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
}

apiClient.interceptors.request.use(attachAccessToken);
sessionClient.interceptors.request.use(attachAccessToken);

// Share refresh across reload recovery and concurrent expired-token requests.
export function refreshSession() {
  if (refreshPromise) return refreshPromise;
  const version = sessionVersion;
  const request = sessionClient.post('/auth/refresh')
    .then((response) => {
      if (version !== sessionVersion) throw new axios.CanceledError('Session changed during refresh');
      accessToken = response.data.data.accessToken;
      return response;
    })
    .finally(() => {
      if (refreshPromise === request) refreshPromise = null;
    });
  refreshPromise = request;
  return request;
}

export async function logoutSession() {
  // Let an in-flight rotation finish so logout revokes the newest cookie.
  // Otherwise a late refresh response could replace the cookie after logout.
  const pending = refreshPromise;
  if (pending) await pending.catch(() => {});
  return sessionClient.post('/auth/logout');
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;

    if (response?.status !== 401 || !config || config._retried || /\/auth\/(login|refresh|logout)/.test(config.url || '')) {
      return Promise.reject(error);
    }
    if (config._sessionVersion !== sessionVersion) return Promise.reject(error);

    config._retried = true;
    const version = sessionVersion;

    // Another response may already have refreshed this request's expired token.
    if (accessToken && config.headers.Authorization !== `Bearer ${accessToken}`) {
      config.headers.Authorization = `Bearer ${accessToken}`;
      return apiClient(config);
    }

    try {
      const { data } = await refreshSession();
      if (version !== sessionVersion) throw new axios.CanceledError('Session changed during refresh');
      config.headers.Authorization = `Bearer ${data.data.accessToken}`;
      return apiClient(config);
    } catch (refreshError) {
      if (version === sessionVersion && [401, 403].includes(refreshError.response?.status)) {
        setAccessToken(null);
        if (onAuthFailure) onAuthFailure();
      }
      return Promise.reject(refreshError);
    }
  }
);
