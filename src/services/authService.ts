/**
 * authService – wrapper around /api/auth endpoints.
 * Used directly by SignInForm and SignUpForm before AuthContext updates.
 * Saves auth token for cross-origin Bearer authentication fallback.
 */
import type { AuthServiceContract, AuthResponse, LoginPayload, RegisterPayload } from '../types/auth';
import { apiFetch, setAuthToken } from '../lib/api';

export class AuthService implements AuthServiceContract {
  private readonly baseUrl: string;

  constructor(baseUrl = '/api/auth') {
    this.baseUrl = baseUrl;
  }

  async register(payload: RegisterPayload): Promise<AuthResponse> {
    if (!payload.email || !payload.password || !payload.name) {
      throw new Error('Please complete all required fields.');
    }

    const res = await apiFetch(`${this.baseUrl}/register`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.detail || `Registration failed (${res.status}).`);
    }

    const data = await res.json();
    if (data.token) {
      setAuthToken(data.token);
    }
    return data;
  }

  async login(payload: LoginPayload): Promise<AuthResponse> {
    if (!payload.email || !payload.password) {
      throw new Error('Please provide both email and password.');
    }

    const res = await apiFetch(`${this.baseUrl}/login`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.detail || `Sign in failed (${res.status}).`);
    }

    const data = await res.json();
    if (data.token) {
      setAuthToken(data.token);
    }
    return data;
  }
}

export const authService = new AuthService();
