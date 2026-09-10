import axios from 'axios';

const API_BASE_URL = 'https://five08-group-project.onrender.com/api';

let accessToken = null;
let onAuthFailure = null;

export function setAccessToken(token) {
  accessToken = token;
}

export function setOnAuthFailure(callback) {
  onAuthFailure = callback;
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// Separate, interceptor-free instance for the refresh call itself, to avoid recursive 401 handling.
const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let refreshPromise = null;

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;

    if (response?.status !== 401 || config._retried || config.url?.includes('/auth/login')) {
      return Promise.reject(error);
    }

    config._retried = true;

    try {
      refreshPromise ??= refreshClient.post('/auth/refresh').finally(() => {
        refreshPromise = null;
      });
      const { data } = await refreshPromise;
      setAccessToken(data.data.accessToken);
      config.headers.Authorization = `Bearer ${data.data.accessToken}`;
      return apiClient(config);
    } catch (refreshError) {
      setAccessToken(null);
      if (onAuthFailure) onAuthFailure();
      return Promise.reject(refreshError);
    }
  }
);
