/**
 * AuthContext – provides current user and auth actions to the entire app.
 * Calls /api/auth/me on mount to rehydrate from cookie or Bearer token.
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { UserProfile, LoginPayload, RegisterPayload } from '../types/auth';
import { apiFetch, setAuthToken } from '../lib/api';

// ── types ────────────────────────────────────────────────────────────────────

interface AuthState {
  user: UserProfile | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (payload: LoginPayload) => Promise<UserProfile>;
  register: (payload: RegisterPayload) => Promise<UserProfile>;
  logout: () => Promise<void>;
  setUser: (user: UserProfile | null) => void;
}

// ── context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ── helpers ──────────────────────────────────────────────────────────────────

async function apiPost(path: string, body: unknown): Promise<Response> {
  return apiFetch(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

async function fetchUserProfile(baseUser: UserProfile): Promise<UserProfile> {
  const userWithProfile = { ...baseUser };
  if (baseUser.role === 'freelancer') {
    try {
      const pRes = await apiFetch('/api/profile/me');
      if (pRes.ok) {
        const pData = await pRes.json();
        (userWithProfile as unknown as { onboardingCompleted?: boolean }).onboardingCompleted =
          pData.onboardingCompleted ?? false;
      }
    } catch {
      // Ignore
    }
  }
  return userWithProfile;
}

// ── provider ─────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  // Rehydrate from cookie or Bearer token on first mount
  useEffect(() => {
    apiFetch('/api/auth/me')
      .then(async (res) => {
        if (res.ok) {
          const { user } = await res.json();
          const enriched = await fetchUserProfile(user);
          setState({ user: enriched, loading: false });
        } else {
          setAuthToken(null);
          setState({ user: null, loading: false });
        }
      })
      .catch(() => setState({ user: null, loading: false }));
  }, []);

  const login = useCallback(async (payload: LoginPayload): Promise<UserProfile> => {
    const res = await apiPost('/api/auth/login', payload);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.detail || `Sign in failed (${res.status}).`);
    }
    const data = await res.json();
    if (data.token) {
      setAuthToken(data.token);
    }
    const { user } = data;
    const enriched = await fetchUserProfile(user);
    setState({ user: enriched, loading: false });
    return enriched;
  }, []);

  const register = useCallback(async (payload: RegisterPayload): Promise<UserProfile> => {
    const res = await apiPost('/api/auth/register', payload);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.detail || `Registration failed (${res.status}).`);
    }
    const data = await res.json();
    if (data.token) {
      setAuthToken(data.token);
    }
    const { user } = data;
    const enriched = { ...user, onboardingCompleted: false };
    setState({ user: enriched, loading: false });
    return enriched;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setAuthToken(null);
      setState({ user: null, loading: false });
    }
  }, []);

  const setUser = useCallback((user: UserProfile | null) => {
    setState({ user, loading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
