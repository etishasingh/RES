/**
 * profileService – calls /api/profile/me for read and PATCH.
 * Uses the authenticated API; profile data is never shared through localStorage.
 */
import type {
  FreelancerProfile,
  ProfileResponse,
  ProfileServiceContract,
  ProfileUpdatePayload,
} from '../types/profile';

const emptyProfile = (data: Partial<FreelancerProfile> = {}): FreelancerProfile => ({
  id: '', name: '', email: '', headline: '', skills: [], skill_proficiency: {},
  experience_level: 'beginner', experience_years: 0, primary_role: '', desired_role: '',
  career_goals: [], preferred_work_type: [], remote_preference: 'Remote-first', budget: 0,
  available_hours_per_week: 0, onboardingCompleted: false, updatedAt: new Date().toISOString(),
  hourly_rate: 0, availability_status: 'unavailable', bio: '', location: '', ...data,
});

export const EMPTY_PROFILE: FreelancerProfile = emptyProfile();

export class ProfileService implements ProfileServiceContract {
  private readonly baseUrl: string;

  constructor(baseUrl = '/api/profile') {
    this.baseUrl = baseUrl;
  }

  async getProfile(): Promise<FreelancerProfile> {
    try {
      const res = await fetch(`${this.baseUrl}/me`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const p = data.profile || {};
        return emptyProfile({ ...p, id: data.id ?? '', name: data.name ?? '', email: data.email ?? '', headline: data.headline ?? p.headline ?? '', onboardingCompleted: data.onboardingCompleted ?? false });
      }
    } catch {
      // Network error – fall through to localStorage
    }

    throw new Error('Unable to load the authenticated profile.');
  }

  async updateProfile(payload: ProfileUpdatePayload): Promise<ProfileResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        return {
          profile: emptyProfile(data.profile || {}),
          message: 'Profile updated.',
          source: 'api',
        };
      }
    } catch {
      // Fall through
    }

    throw new Error('Unable to save the authenticated profile.');
  }

  async completeOnboarding(profile: FreelancerProfile): Promise<ProfileResponse> {
    const finalized: FreelancerProfile = { ...profile, onboardingCompleted: true, updatedAt: new Date().toISOString() };
    const payload = {
      headline: profile.headline,
      skills: profile.skills,
      skill_proficiency: profile.skill_proficiency,
      experience_level: profile.experience_level,
      experience_years: profile.experience_years,
      primary_role: profile.primary_role,
      desired_role: profile.desired_role,
      career_goals: profile.career_goals,
      preferred_work_type: profile.preferred_work_type,
      remote_preference: profile.remote_preference,
      budget: profile.budget,
      available_hours_per_week: profile.available_hours_per_week,
      hourly_rate: profile.hourly_rate,
      availability_status: profile.availability_status,
      bio: profile.bio,
      location: profile.location,
      onboarding_completed: true,
      onboardingCompleted: true,
    };
    try {
      const res = await fetch(`${this.baseUrl}/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });
      if (res.ok) {
        return { profile: finalized, message: 'Onboarding complete.', source: 'api' };
      }
    } catch { /* ignore */ }

    throw new Error('Unable to complete onboarding.');
  }
}

export const profileService = new ProfileService();
