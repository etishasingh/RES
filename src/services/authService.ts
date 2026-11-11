/**
 * authService – thin wrapper around /api/auth endpoints.
 * Used directly by SignInForm and SignUpForm before AuthContext updates.
 * After a successful call the response cookie is set server-side.
 */
import type { AuthServiceContract, AuthResponse, LoginPayload, RegisterPayload } from '../types/auth';

export class AuthService implements AuthServiceContract {
  private readonly baseUrl: string;

  constructor(baseUrl = '/api/auth') {
    this.baseUrl = baseUrl;
  }

  async register(payload: RegisterPayload): Promise<AuthResponse> {
    if (!payload.email || !payload.password || !payload.name) {
      throw new Error('Please complete all required fields.');
    }

    const res = await fetch(`${this.baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include',
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.detail || `Registration failed (${res.status}).`);
    }

    return res.json();
  }

  async login(payload: LoginPayload): Promise<AuthResponse> {
    if (!payload.email || !payload.password) {
      throw new Error('Please provide both email and password.');
    }

    const res = await fetch(`${this.baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include',
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.detail || `Sign in failed (${res.status}).`);
    }

    return res.json();
  }
}

export const authService = new AuthService();
