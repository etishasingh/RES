import type {
  FreelancerProject,
  JourneyEntry,
  LearningRoadmapData,
  Milestone,
  MilestoneStatus,
  AIReviewResult,
  EvaluationResult,
} from '../types/freelancer';
import { projectService, type ApiProject, type ApiSubmission } from './projectService';

export function mapApiProjectToFreelancerProject(
  p: ApiProject,
  submissions?: ApiSubmission[]
): FreelancerProject {
  const milestoneDeadlines = Array.isArray(p.milestones)
    ? p.milestones
        .map((m) => m.due_date)
        .filter((d): d is string => Boolean(d))
    : [];
  const deadline = milestoneDeadlines.length > 0
    ? [...milestoneDeadlines].sort().reverse()[0]
    : 'Not set';

  const mappedMilestones: Milestone[] = Array.isArray(p.milestones)
    ? p.milestones.map((m, index) => {
        const sub = submissions?.find((s) => s.milestone_id === m.id);
        const evalResult = sub?.evaluation_result as EvaluationResult | undefined;
        return {
          id: m.id,
          number: index + 1,
          title: m.title,
          amount: Number(m.amount) || 0,
          dueDate: m.due_date || 'Not set',
          status: (m.status === 'submitted' ? 'under_review' : m.status) as MilestoneStatus,
          acceptanceCriteria: Array.isArray(m.acceptance_criteria)
            ? m.acceptance_criteria
            : Array.isArray((m as any).acceptanceCriteria)
            ? (m as any).acceptanceCriteria
            : [],
          submissionNotes: sub?.notes || undefined,
          submittedAt: sub?.submitted_at
            ? new Date(sub.submitted_at).toLocaleDateString()
            : m.updated_at
            ? new Date(m.updated_at).toLocaleDateString()
            : undefined,
          aiReview: evalResult,
          modelScore: evalResult?.overall_score ?? (evalResult as any)?.overallScore,
          paymentReference: m.payment_reference ?? null,
          paidAt: m.paid_at ?? null,
        };
      })
    : [];

  const milestonesSum = Array.isArray(p.milestones)
    ? p.milestones.reduce((sum, m) => sum + (Number(m.amount) || 0), 0)
    : 0;

  return {
    id: p.id,
    client: 'Client',
    clientAvatarText: 'CL',
    title: p.title,
    discipline: 'Engineering',
    brief: p.description,
    totalBudget: p.budget_max ?? p.budget_min ?? milestonesSum,
    deadline,
    matchScore: 95,
    matchExplanation: 'Assigned project contract.',
    requiredSkills: Array.isArray(p.skills) ? p.skills : [],
    milestones: mappedMilestones,
    status: p.status === 'completed' ? 'completed' : 'active',
    readOnly: p.status === 'completed',
  };
}

export const freelancerService = {
  async evaluate(payload: {
    client_request: string;
    acceptance_criteria: string[];
    deliverable_text: string;
    work_category: string;
    milestone_id?: string;
    project_id?: string;
  }): Promise<EvaluationResult> {
    const response = await fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const error = new Error(`Failed to evaluate deliverable: ${response.status}`);
      (error as any).status = response.status;
      throw error;
    }
    const data: EvaluationResult = await response.json();
    return data;
  },

  async getProjects(): Promise<FreelancerProject[]> {
    try {
      const projects = await projectService.assigned();
      return projects.map((p) => mapApiProjectToFreelancerProject(p));
    } catch {
      return [];
    }
  },

  async getProjectById(id: string): Promise<FreelancerProject | null> {
    try {
      const [project, submissions] = await Promise.all([
        projectService.get(id),
        projectService.submissions(id).catch(() => []),
      ]);
      return mapApiProjectToFreelancerProject(project, submissions);
    } catch {
      return null;
    }
  },

  async getJourneyEntries(): Promise<JourneyEntry[]> {
    const { reviews } = await projectService.journey();
    return reviews.map((review) => ({ id: review.id, projectId: review.project_id, client: 'Client', projectTitle: 'Project', startDate: '', completedDate: review.created_at.slice(0, 10), amount: 0, rating: (review.final_score ?? review.client_score ?? 0) / 20, feedback: review.feedback || '' }));
  },

  async getLearningData(): Promise<LearningRoadmapData> {
    const response = await fetch('/api/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ top_k: 5 }),
    });
    if (!response.ok) {
      const error = new Error(`Failed to fetch learning data: ${response.status}`);
      (error as any).status = response.status;
      throw error;
    }
    const data = await response.json();

    // skill_gaps from the API is { skill: count } — flatten to an array
    const skillGaps = Object.entries(data.skill_gaps || {}).map(
      ([skill, demandCount]) => ({ skill, demandCount: demandCount as number }),
    );

    const roadmap = data.learning_roadmap || {};

    return {
      opportunities: data.opportunities || [],
      skillGaps,
      courses: data.courses || [],
      milestones: roadmap.milestones || [],
      totalStudyHours: roadmap.total_study_hours ?? 0,
      totalEstimatedWeeks: roadmap.total_estimated_weeks ?? 0,
    };
  },


  async submitMilestoneWork(
    _projectId: string,
    milestoneId: string,
    notes: string,
    customReview?: AIReviewResult
  ): Promise<Milestone | null> {
    await projectService.submit(milestoneId, { deliverable_url: null, deliverable_text: notes, deliverable_metadata: null, notes, evaluation_result: (customReview as Record<string, unknown> | undefined) || null });
    return null;
  },
};
