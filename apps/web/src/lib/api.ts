import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE = import.meta.env['VITE_API_URL'] ?? 'http://localhost:3001';

/** Shared axios instance — all API calls must use this. */
export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

/** Dynamic import to avoid circular dependency with store */
let getAccessToken: (() => string | null) | null = null;
let setAccessTokenFn: ((token: string) => void) | null = null;
let logoutFn: (() => void) | null = null;

/**
 * Called once from App.tsx to wire the store into the interceptor.
 * Avoids circular dependency between api.ts and auth.store.ts.
 */
export function initApiAuth(
  getToken: () => string | null,
  setToken: (t: string) => void,
  logout: () => void
): void {
  getAccessToken = getToken;
  setAccessTokenFn = setToken;
  logoutFn = logout;
}

// Request interceptor: attach Bearer token
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken?.();
  if (token && config.headers) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

// Response interceptor: on 401, attempt silent refresh then retry
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

/** Notify all queued requests once the new token is obtained. */
function onRefreshed(token: string): void {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (!originalRequest || error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }
    // Never try to refresh if the failing request IS the refresh endpoint —
    // that would cause an infinite redirect loop on session expiry.
    if (originalRequest.url?.includes('/auth/refresh')) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve) => {
        refreshSubscribers.push((token: string) => {
          originalRequest.headers.set('Authorization', `Bearer ${token}`);
          resolve(api(originalRequest));
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const { data } = await axios.post<{ accessToken: string }>(
        `${API_BASE}/auth/refresh`,
        {},
        { withCredentials: true }
      );
      setAccessTokenFn?.(data.accessToken);
      onRefreshed(data.accessToken);
      originalRequest.headers.set('Authorization', `Bearer ${data.accessToken}`);
      return api(originalRequest);
    } catch {
      logoutFn?.();
      // Session fully expired — redirect to login with reason so the page can show a message
      window.location.href = '/login?reason=session_expired';
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  }
);
