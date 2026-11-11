import type { Milestone } from './freelancer';

export interface FreelancerDirectoryItem {
  id: string;
  name: string;
  avatarText: string;
  headline: string;
  skills: string[];
  availability: 'Available' | 'Part-time' | 'Booked';
  hourlyRate: number; // USD / hr
  rating: number; // 0 - 5.0
  projectsCompleted: number;
}

export interface DirectoryFreelancer {
  id: string;
  name: string;
  headline: string;
  skills: string[];
  experience_level: string | null;
  availability_status: 'available' | 'limited' | 'unavailable' | null;
  hourly_rate: number | null;
  location: string | null;
  rating: number | null;
  completed_projects: number;
}

export interface ClientProject {
  id: string;
  title: string;
  description: string;
  skills: string[];
  budget: number;
  budget_min?: number | null;
  budget_max?: number | null;
  deadline: string;
  assignedFreelancer?: {
    id: string;
    name: string;
    avatarText: string;
    rate: string;
  };
  totalPaidSoFar: number;
  status: 'active' | 'in_review' | 'completed' | 'drafting' | 'open' | 'invited' | 'assigned' | 'cancelled' | string;
  milestones: Milestone[];
}

export interface ClientHistoryItem {
  id: string;
  projectId: string;
  title: string;
  milestoneTitle?: string;
  freelancerName: string;
  freelancerAvatar: string;
  startDate: string;
  completedDate: string;
  totalPaid: number;
  milestoneAmount?: number;
  isPaid?: boolean;
  status?: string;
  ratingGiven: number;
  feedbackSummary: string;
}

export interface PaymentTransaction {
  id: string;
  projectId: string;
  projectTitle: string;
  milestoneTitle: string;
  milestoneNumber: number;
  amount: number;
  date: string;
  status: 'paid_sandbox' | 'pending_approval' | 'scheduled';
  sandboxReference: string;
}

export interface NewMilestoneInput {
  title: string;
  amount: number;
  dueDate: string;
  acceptanceCriteria: string[];
}

export interface NewProjectPayload {
  title: string;
  description: string;
  skills: string[];
  budget: number;
  deadline: string;
  milestones: NewMilestoneInput[];
}
