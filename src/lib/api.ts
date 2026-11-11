/**
 * PayPilot AI – Centralized API Client Configuration
 * Supports both local development (via Vite proxy) and production deployment on Render.
 */

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL;

export const API_BASE_URL =
  rawBaseUrl !== undefined && rawBaseUrl.trim() !== ''
    ? rawBaseUrl.trim().replace(/\/+$/, '')
    : '';

const TOKEN_KEY = 'paypilot_auth_token';

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Ignore localStorage errors in private browsing
  }
}

export function getApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (!API_BASE_URL) {
    return cleanPath;
  }
  return `${API_BASE_URL}${cleanPath}`;
}

export function getAuthHeaders(customHeaders?: HeadersInit): Headers {
  const headers = new Headers(customHeaders);
  if (!headers.has('Content-Type') && !(customHeaders instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getAuthToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return headers;
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = getApiUrl(path);
  const headers = getAuthHeaders(init?.headers);

  return fetch(url, {
    ...init,
    headers,
    credentials: 'include',
  });
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.detail || `API request failed with status ${res.status}`);
  }
  return res.json() as Promise<T>;
}

