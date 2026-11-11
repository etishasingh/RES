export type UserRole = 'freelancer' | 'client';

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  headline?: string;
  skills?: string[];
  organization?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  headline?: string;
  skills?: string[];
  organization?: string;
  createdAt: string;
  onboardingCompleted?: boolean;
}

export interface AuthResponse {
  user: UserProfile;
  token?: string;
  message: string;
}

export interface AuthServiceContract {
  register(payload: RegisterPayload): Promise<AuthResponse>;
  login(payload: LoginPayload): Promise<AuthResponse>;
}
