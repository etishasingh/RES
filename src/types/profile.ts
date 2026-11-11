/**
 * PayPilot AI — Freelancer Profile Types & Contracts
 * Aligned with ProofFlow Hybrid Recommendation Engine schema
 */

export type ExperienceLevel =
  | 'beginner'
  | 'junior'
  | 'intermediate'
  | 'senior'
  | 'expert';

export type SkillProficiencyLevel =
  | 'Basic'
  | 'Beginner'
  | 'Intermediate'
  | 'Advanced'
  | 'Expert';

export type RemotePreference =
  | 'Remote-first'
  | 'Hybrid'
  | 'On-site';

export interface FreelancerProfile {
  id: string;
  name: string;
  email: string;
  headline: string;
  skills: string[];
  skill_proficiency: Record<string, SkillProficiencyLevel>;
  experience_level: ExperienceLevel;
  experience_years: number;
  primary_role: string;
  desired_role: string;
  career_goals: string[];
  preferred_work_type: string[];
  remote_preference: RemotePreference;
  budget: number; // Maximum learning budget in INR
  available_hours_per_week: number;
  onboardingCompleted: boolean;
  updatedAt: string;
  hourly_rate: number;
  availability_status: 'available' | 'limited' | 'unavailable';
  bio: string;
  location: string;
}

export type ProfileUpdatePayload = Partial<FreelancerProfile>;

export interface ProfileResponse {
  profile: FreelancerProfile;
  message: string;
  source: 'demo_mock' | 'api';
}

export interface ProfileServiceContract {
  getProfile(): Promise<FreelancerProfile>;
  updateProfile(payload: ProfileUpdatePayload): Promise<ProfileResponse>;
  completeOnboarding(payload: FreelancerProfile): Promise<ProfileResponse>;
}
