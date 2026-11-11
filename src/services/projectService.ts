export type ProjectStatus = 'draft' | 'open' | 'invited' | 'assigned' | 'active' | 'in_review' | 'completed' | 'cancelled';
export type MilestoneStatus = 'not_started' | 'in_progress' | 'submitted' | 'under_review' | 'accepted' | 'paid' | 'rejected' | 'cancelled';

export interface ApiMilestone {
  id: string; project_id: string; title: string; description: string | null; acceptance_criteria: string[];
  amount: number; status: MilestoneStatus; due_date: string | null; payment_reference?: string | null; paid_at?: string | null;
  created_at: string; updated_at: string;
}
export interface ApiProject {
  id: string; client_id?: string; freelancer_id?: string | null; title: string; description: string; skills: string[];
  budget_min: number | null; budget_max: number | null; hourly_rate: number | null; currency: string;
  pricing_type: 'fixed' | 'hourly' | 'negotiable' | null; status: ProjectStatus; created_at: string; updated_at: string;
  milestones: ApiMilestone[];
}
export interface ApiInvitation { id: string; project_id: string; client_id: string; freelancer_id: string; status: string; created_at: string; updated_at: string; project: ApiProject | null; }
export interface ApiProjectRequest {
  id: string;
  project_id: string;
  freelancer_id: string;
  client_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  message: string | null;
  created_at: string;
  updated_at: string;
  project?: {
    id: string;
    title: string;
    description: string;
    skills: string[];
    budget_min: number | null;
    budget_max: number | null;
    status: string;
  } | null;
  freelancer?: {
    id: string;
    name: string;
    email: string;
    avatarText: string;
    headline: string;
    skills: string[];
    rating: number | null;
    completed_projects: number;
    hourly_rate: number | null;
  } | null;
}
export interface ApiSubmission { id: string; milestone_id: string; freelancer_id: string; deliverable_url: string | null; deliverable_text: string | null; deliverable_metadata: Record<string, unknown> | null; notes: string | null; evaluation_result: Record<string, unknown> | null; status: string; submitted_at: string; created_at: string; updated_at: string; }
export interface ApiReview { id: string; project_id: string; milestone_id: string | null; client_id: string; freelancer_id: string; client_score: number | null; model_score: number | null; final_score: number | null; feedback: string | null; evaluation_result: Record<string, unknown> | null; created_at: string; updated_at: string; }
export interface JourneyResponse { projects: ApiProject[]; reviews: ApiReview[]; }

type CreateProject = Omit<Partial<ApiProject>, 'id' | 'client_id' | 'freelancer_id' | 'created_at' | 'updated_at' | 'milestones'> & { title: string; description: string; milestones: Array<Pick<ApiMilestone, 'title' | 'description' | 'acceptance_criteria' | 'amount' | 'due_date'>> };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/projects${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) }, ...init });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail || `Request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

export const projectService = {
  create: (body: CreateProject) => request<ApiProject>('', { method: 'POST', body: JSON.stringify(body) }),
  mine: () => request<ApiProject[]>('/mine'),
  open: () => request<ApiProject[]>('/open'),
  assigned: () => request<ApiProject[]>('/assigned'),
  get: (id: string) => request<ApiProject>(`/${id}`),
  update: (id: string, body: Partial<CreateProject>) => request<ApiProject>(`/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  invite: (projectId: string, freelancerId: string) => request<ApiInvitation>(`/${projectId}/invitations`, { method: 'POST', body: JSON.stringify({ freelancer_id: freelancerId }) }),
  projectInvitations: (projectId: string) => request<ApiInvitation[]>(`/${projectId}/invitations`),
  invitations: () => request<ApiInvitation[]>('/invitations'),
  acceptInvitation: (id: string) => request<ApiInvitation>(`/invitations/${id}/accept`, { method: 'POST' }),
  declineInvitation: (id: string) => request<ApiInvitation>(`/invitations/${id}/decline`, { method: 'POST' }),
  submit: (milestoneId: string, body: Pick<ApiSubmission, 'deliverable_url' | 'deliverable_text' | 'deliverable_metadata' | 'notes' | 'evaluation_result'>) => request<ApiSubmission>(`/milestones/${milestoneId}/submissions`, { method: 'POST', body: JSON.stringify(body) }),
  submissions: (projectId: string) => request<ApiSubmission[]>(`/${projectId}/submissions`),
  review: (submissionId: string, body: { client_score: number; feedback?: string; decision: 'accepted' | 'changes_requested' | 'rejected' }) => request<{ review: ApiReview; submission: ApiSubmission }>(`/submissions/${submissionId}/review`, { method: 'POST', body: JSON.stringify(body) }),
  journey: () => request<JourneyResponse>('/journey'),
  requestToWork: (projectId: string, message?: string) =>
    request<ApiProjectRequest>(`/${projectId}/requests`, { method: 'POST', body: JSON.stringify({ message }) }),
  getMyRequest: (projectId: string) =>
    request<ApiProjectRequest | null>(`/${projectId}/my-request`).catch(() => null),
  myRequests: () => request<ApiProjectRequest[]>('/requests/mine'),
  incomingRequests: () => request<ApiProjectRequest[]>('/requests/incoming'),
  acceptRequest: (requestId: string) =>
    request<ApiProjectRequest>(`/requests/${requestId}/accept`, { method: 'POST' }),
  declineRequest: (requestId: string) =>
    request<ApiProjectRequest>(`/requests/${requestId}/decline`, { method: 'POST' }),
};

export function projectBudget(project: ApiProject): number {
  return project.budget_max ?? project.budget_min ?? project.milestones.reduce((total, milestone) => total + milestone.amount, 0);
}

/**
 * Returns the paid Sandbox amount for a review's milestone without double-counting
 * across multiple reviews on the same milestone.
 */
export function paidAmountForReview(
  project: ApiProject | undefined,
  review: ApiReview,
  countedMilestones: Set<string>
): number {
  if (!project || !review.milestone_id || countedMilestones.has(review.milestone_id)) {
    return 0;
  }
  const milestone = project.milestones.find((m) => m.id === review.milestone_id);
  if (!milestone || milestone.status !== 'paid') {
    return 0;
  }
  countedMilestones.add(milestone.id);
  return Number(milestone.amount) || 0;
}
