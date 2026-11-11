import type {
  ClientProject,
  ClientHistoryItem,
  PaymentTransaction,
  DirectoryFreelancer,
  NewProjectPayload,
} from '../types/client';
import type { Milestone, MilestoneStatus } from '../types/freelancer';
import { projectService, type ApiProject } from './projectService';

export function mapApiProjectToClientProject(
  p: ApiProject,
  freelancerMap?: Map<string, DirectoryFreelancer>
): ClientProject {
  const milestonesSum = Array.isArray(p.milestones)
    ? p.milestones.reduce((sum, m) => sum + (Number(m.amount) || 0), 0)
    : 0;

  const budget = p.budget_max ?? p.budget_min ?? milestonesSum;

  // Sum the amount of milestones the client has approved or paid via PayPal Sandbox.
  const acceptedMilestoneValue = Array.isArray(p.milestones)
    ? p.milestones
        .filter((m) => m.status === 'accepted' || m.status === 'paid')
        .reduce((sum, m) => sum + (Number(m.amount) || 0), 0)
    : 0;

  const milestoneDeadlines = Array.isArray(p.milestones)
    ? p.milestones
        .map((m) => m.due_date)
        .filter((d): d is string => Boolean(d))
    : [];
  const deadline = milestoneDeadlines.length > 0
    ? [...milestoneDeadlines].sort().reverse()[0]
    : 'Not set';

  const mappedMilestones: Milestone[] = Array.isArray(p.milestones)
    ? p.milestones.map((m, index) => ({
        id: m.id,
        number: index + 1,
        title: m.title,
        amount: Number(m.amount) || 0,
        dueDate: m.due_date || 'Not set',
        status: m.status as MilestoneStatus,
        acceptanceCriteria: Array.isArray(m.acceptance_criteria) ? m.acceptance_criteria : [],
        submittedAt: m.updated_at ? new Date(m.updated_at).toLocaleDateString() : undefined,
        paymentReference: m.payment_reference ?? null,
        paidAt: m.paid_at ?? null,
      }))
    : [];

  let assignedFreelancer = undefined;
  if (p.freelancer_id) {
    const found = freelancerMap?.get(p.freelancer_id);
    const name = found?.name || (p as any).freelancer_name || 'Assigned Specialist';
    const avatarText = name
      .split(' ')
      .map((part: string) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'FL';
    const rate = found?.hourly_rate
      ? `$${found.hourly_rate}/hr`
      : p.hourly_rate
      ? `$${p.hourly_rate}/hr`
      : 'Fixed scope';

    assignedFreelancer = {
      id: p.freelancer_id,
      name,
      avatarText,
      rate,
    };
  }

  return {
    id: p.id,
    title: p.title,
    description: p.description,
    skills: Array.isArray(p.skills) ? p.skills : [],
    budget,
    budget_min: p.budget_min ?? null,
    budget_max: p.budget_max ?? null,
    deadline,
    assignedFreelancer,
    totalPaidSoFar: acceptedMilestoneValue,
    status: p.status as ClientProject['status'],
    milestones: mappedMilestones,
  };
}

export const clientService = {
  async getClientProjects(): Promise<ClientProject[]> {
    const [projects, freelancers] = await Promise.all([
      projectService.mine(),
      clientService.getFreelancers().catch(() => []),
    ]);
    const freelancerMap = new Map<string, DirectoryFreelancer>();
    freelancers.forEach((f) => freelancerMap.set(f.id, f));

    return projects.map((p) => mapApiProjectToClientProject(p, freelancerMap));
  },

  async getClientProjectById(id: string): Promise<ClientProject | null> {
    try {
      const [project, freelancers] = await Promise.all([
        projectService.get(id),
        clientService.getFreelancers().catch(() => []),
      ]);
      const freelancerMap = new Map<string, DirectoryFreelancer>();
      freelancers.forEach((f) => freelancerMap.set(f.id, f));
      return mapApiProjectToClientProject(project, freelancerMap);
    } catch {
      return null;
    }
  },

  async createProject(payload: NewProjectPayload): Promise<ClientProject> {
    const created = await projectService.create({
      title: payload.title,
      description: payload.description,
      skills: payload.skills,
      budget_min: payload.budget,
      budget_max: payload.budget,
      status: 'open',
      milestones: payload.milestones.map((m) => ({
        title: m.title,
        description: null,
        amount: m.amount,
        due_date: m.dueDate || null,
        acceptance_criteria: m.acceptanceCriteria,
      })),
    });
    return mapApiProjectToClientProject(created);
  },

  async getFreelancers(query?: {
    q?: string;
    skill?: string;
    availability?: 'available' | 'limited' | 'unavailable';
    limit?: number;
  }): Promise<DirectoryFreelancer[]> {
    const params = new URLSearchParams();
    if (query?.limit) params.set('limit', String(query.limit));
    else params.set('limit', '100');
    if (query?.q?.trim()) params.set('q', query.q.trim());
    if (query?.skill?.trim() && query.skill !== 'All') params.set('skill', query.skill.trim());
    if (query?.availability) params.set('availability', query.availability);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`/api/freelancers${queryString}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.detail || 'The freelancer directory is unavailable right now.');
    }
    return response.json() as Promise<DirectoryFreelancer[]>;
  },

  async getClientHistory(): Promise<ClientHistoryItem[]> {
    return Promise.resolve([]);
  },

  async getPaymentTransactions(): Promise<PaymentTransaction[]> {
    return Promise.resolve([]);
  },

  async inviteFreelancer(projectId: string, freelancerId: string): Promise<void> {
    await projectService.invite(projectId, freelancerId);
  },
};
