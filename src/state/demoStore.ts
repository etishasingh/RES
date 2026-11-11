/**
 * demoStore.ts
 * In-memory demo state store for the active session.
 * Label: Demo State (Session-only in-memory storage; no payments are faked).
 */
import { useSyncExternalStore } from 'react';
import type {
  FreelancerProject,
  Milestone,
  AIReviewResult,
  JourneyEntry,
} from '../types/freelancer';
import type {
  ClientProject,
  ClientHistoryItem,
  PaymentTransaction,
  FreelancerDirectoryItem,
  NewProjectPayload,
} from '../types/client';
import { computeFinalScore } from '../lib/scoring';
import {
  INITIAL_PROJECTS,
  SAMPLE_JOURNEY_ENTRIES,
} from '../data/sample/freelancer';
import {
  INITIAL_CLIENT_PROJECTS,
  INITIAL_CLIENT_HISTORY,
  INITIAL_PAYMENT_TRANSACTIONS,
  SAMPLE_FREELANCERS,
} from '../data/sample/client';

export interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'caution';
  text: string;
}

interface DemoStoreState {
  projects: FreelancerProject[];
  journeyEntries: JourneyEntry[];
  clientProjects: ClientProject[];
  clientHistory: ClientHistoryItem[];
  clientPayments: PaymentTransaction[];
  freelancers: FreelancerDirectoryItem[];
  toasts: ToastMessage[];
}

let state: DemoStoreState = {
  projects: INITIAL_PROJECTS,
  journeyEntries: SAMPLE_JOURNEY_ENTRIES,
  clientProjects: INITIAL_CLIENT_PROJECTS,
  clientHistory: INITIAL_CLIENT_HISTORY,
  clientPayments: INITIAL_PAYMENT_TRANSACTIONS,
  freelancers: SAMPLE_FREELANCERS,
  toasts: [],
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export const demoStore = {
  getState(): DemoStoreState {
    return state;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  showToast(text: string, type: 'success' | 'info' | 'caution' = 'info') {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newToast: ToastMessage = { id, type, text };
    state = {
      ...state,
      toasts: [...state.toasts, newToast],
    };
    notify();

    setTimeout(() => {
      state = {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== id),
      };
      notify();
    }, 4500);
  },

  dismissToast(id: string) {
    state = {
      ...state,
      toasts: state.toasts.filter((t) => t.id !== id),
    };
    notify();
  },

  // ── Freelancer Actions ──
  acceptInvitation(projectId: string): FreelancerProject | null {
    const target = state.projects.find((p) => p.id === projectId);
    if (!target) return null;

    const updatedProjects = state.projects.map((p) => {
      if (p.id !== projectId) return p;
      const updatedMilestones: Milestone[] = p.milestones.map((m, idx) => ({
        ...m,
        status: idx === 0 ? 'in_progress' : 'not_started',
      }));
      return {
        ...p,
        status: 'active' as const,
        milestones: updatedMilestones,
      };
    });

    state = { ...state, projects: updatedProjects };
    notify();

    this.showToast(
      `Invitation accepted for "${target.title}". Project moved to your Active workspace.`,
      'success'
    );

    return state.projects.find((p) => p.id === projectId) || null;
  },

  declineInvitation(projectId: string): void {
    const target = state.projects.find((p) => p.id === projectId);
    const title = target?.title || 'Project';

    state = {
      ...state,
      projects: state.projects.filter((p) => p.id !== projectId),
    };
    notify();

    this.showToast(`Invitation declined for "${title}". Brief removed from your invitations list.`, 'info');
  },

  submitMilestone(
    projectId: string,
    milestoneId: string,
    notes: string,
    customReview?: AIReviewResult
  ): Milestone | null {
    let updatedMilestone: Milestone | null = null;

    const review: AIReviewResult | undefined = customReview
      ? {
          ...customReview,
          reviewedAt: customReview.reviewedAt || 'Just now',
        }
      : undefined;

    const rawModelScore = review ? (review.overall_score ?? review.overallScore) : undefined;
    const modelScore = typeof rawModelScore === 'number' ? Math.round(rawModelScore) : undefined;

    // Update freelancer projects
    const updatedProjects = state.projects.map((project) => {
      if (project.id !== projectId) return project;

      const updatedMilestones = project.milestones.map((m) => {
        if (m.id !== milestoneId) return m;

        updatedMilestone = {
          ...m,
          status: 'under_review' as const,
          submissionNotes: notes,
          submittedAt: 'Today',
          aiReview: review,
          modelScore,
          clientScore: undefined,
          finalScore: undefined,
          scoreWeights: undefined,
        };
        return updatedMilestone;
      });

      return { ...project, milestones: updatedMilestones };
    });

    // Mirror to client projects so client can review submitted work
    const updatedClientProjects = state.clientProjects.map((cp) => {
      if (cp.id !== projectId) return cp;
      const updatedMilestones = cp.milestones.map((m) => {
        if (m.id !== milestoneId) return m;
        return {
          ...m,
          status: 'under_review' as const,
          submissionNotes: notes,
          submittedAt: 'Today',
          aiReview: review,
          modelScore,
          clientScore: undefined,
          finalScore: undefined,
          scoreWeights: undefined,
        };
      });
      return { ...cp, milestones: updatedMilestones, status: 'in_review' as const };
    });

    state = {
      ...state,
      projects: updatedProjects,
      clientProjects: updatedClientProjects,
    };
    notify();

    if (review) {
      this.showToast(
        'Work submitted successfully. AI evaluation generated below. Client makes the final approval decision.',
        'success'
      );
    } else {
      this.showToast(
        'Work submitted successfully. Client makes the final approval decision.',
        'info'
      );
    }

    return updatedMilestone;
  },

  // ── Client Actions ──
  createProject(payload: NewProjectPayload): ClientProject {
    const newId = `proj-${Date.now().toString().slice(-4)}`;
    const newMilestones: Milestone[] = payload.milestones.map((m, idx) => ({
      id: `m-${newId}-${idx + 1}`,
      number: idx + 1,
      title: m.title,
      amount: m.amount,
      dueDate: m.dueDate,
      status: 'not_started',
      acceptanceCriteria: m.acceptanceCriteria,
    }));

    const newProject: ClientProject = {
      id: newId,
      title: payload.title,
      description: payload.description,
      skills: payload.skills,
      budget: payload.budget,
      deadline: payload.deadline,
      totalPaidSoFar: 0,
      status: 'drafting',
      milestones: newMilestones,
    };

    state = {
      ...state,
      clientProjects: [newProject, ...state.clientProjects],
    };
    notify();

    this.showToast(
      `Project "${newProject.title}" created successfully and added to your projects directory.`,
      'success'
    );

    return newProject;
  },

  acceptClientMilestone(projectId: string, milestoneId: string): void {
    const targetProject = state.clientProjects.find((p) => p.id === projectId);
    const targetMilestone = targetProject?.milestones.find((m) => m.id === milestoneId);

    const updatedClientProjects = state.clientProjects.map((p) => {
      if (p.id !== projectId) return p;
      const updatedMilestones = p.milestones.map((m) => {
        if (m.id !== milestoneId) return m;
        return {
          ...m,
          status: 'accepted' as const,
        };
      });
      return { ...p, milestones: updatedMilestones };
    });

    // Mirror to freelancer side as well
    const updatedFreelancerProjects = state.projects.map((p) => {
      if (p.id !== projectId) return p;
      const updatedMilestones = p.milestones.map((m) => {
        if (m.id !== milestoneId) return m;
        return { ...m, status: 'accepted' as const };
      });
      return { ...p, milestones: updatedMilestones };
    });

    state = {
      ...state,
      clientProjects: updatedClientProjects,
      projects: updatedFreelancerProjects,
    };
    notify();

    const title = targetMilestone?.title || 'Milestone';
    this.showToast(
      `"${title}" accepted. You can proceed with sandbox payment authorization when ready.`,
      'success'
    );
  },

  requestChangesClientMilestone(
    projectId: string,
    milestoneId: string,
    feedbackNotes: string = 'Revisions requested by client.'
  ): void {
    const updatedClientProjects = state.clientProjects.map((p) => {
      if (p.id !== projectId) return p;
      const updatedMilestones = p.milestones.map((m) => {
        if (m.id !== milestoneId) return m;
        return {
          ...m,
          status: 'in_progress' as const,
          submissionNotes: `Feedback: ${feedbackNotes}\n(Previous submission returned for revision)`,
        };
      });
      return { ...p, milestones: updatedMilestones, status: 'active' as const };
    });

    const updatedFreelancerProjects = state.projects.map((p) => {
      if (p.id !== projectId) return p;
      const updatedMilestones = p.milestones.map((m) => {
        if (m.id !== milestoneId) return m;
        return {
          ...m,
          status: 'in_progress' as const,
          submissionNotes: `Feedback: ${feedbackNotes}\n(Previous submission returned for revision)`,
        };
      });
      return { ...p, milestones: updatedMilestones, status: 'active' as const };
    });

    state = {
      ...state,
      clientProjects: updatedClientProjects,
      projects: updatedFreelancerProjects,
    };
    notify();

    this.showToast('Revisions requested. Freelancer notified to adjust deliverables.', 'caution');
  },

  recordClientScore(projectId: string, milestoneId: string, clientScore: number): Milestone | null {
    let updatedMilestone: Milestone | null = null;

    // Find current milestone to check if it has a modelScore
    const currentProject =
      state.clientProjects.find((p) => p.id === projectId) ||
      state.projects.find((p) => p.id === projectId);
    const currentMilestone = currentProject?.milestones.find((m) => m.id === milestoneId);

    const rawModelScore =
      currentMilestone?.modelScore ??
      currentMilestone?.aiReview?.overall_score ??
      currentMilestone?.aiReview?.overallScore;

    const hasModelScore = typeof rawModelScore === 'number' && !isNaN(rawModelScore);

    let finalScore: number | undefined = undefined;
    let weights: { model: number; client: number } | undefined = undefined;

    if (hasModelScore) {
      const result = computeFinalScore(rawModelScore, clientScore);
      finalScore = result.finalScore;
      weights = result.weights;
    }

    const updateMilestoneObj = (m: Milestone): Milestone => {
      const updatedReview = m.aiReview
        ? {
            ...m.aiReview,
            modelScore: hasModelScore ? rawModelScore : undefined,
            clientScore,
            finalScore,
            scoreWeights: weights,
          }
        : undefined;

      const updated = {
        ...m,
        modelScore: hasModelScore ? rawModelScore : undefined,
        clientScore,
        finalScore,
        scoreWeights: weights,
        aiReview: updatedReview,
      };
      updatedMilestone = updated;
      return updated;
    };

    const updatedClientProjects = state.clientProjects.map((cp) => {
      if (cp.id !== projectId) return cp;
      return {
        ...cp,
        milestones: cp.milestones.map((m) => (m.id === milestoneId ? updateMilestoneObj(m) : m)),
      };
    });

    const updatedProjects = state.projects.map((p) => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        milestones: p.milestones.map((m) => (m.id === milestoneId ? updateMilestoneObj(m) : m)),
      };
    });

    state = {
      ...state,
      clientProjects: updatedClientProjects,
      projects: updatedProjects,
    };
    notify();

    this.showToast('Your score has been saved for this milestone.', 'success');
    return updatedMilestone;
  },

  inviteFreelancer(_freelancerId: string, freelancerName: string): void {
    this.showToast(
      `Invitation sent to ${freelancerName}. They will receive the brief in their dashboard.`,
      'success'
    );
  },

  getProjectById(id: string): FreelancerProject | undefined {
    return state.projects.find((p) => p.id === id);
  },

  getClientProjectById(id: string): ClientProject | undefined {
    return state.clientProjects.find((p) => p.id === id);
  },
};

export function useDemoStore() {
  const current = useSyncExternalStore(
    demoStore.subscribe,
    demoStore.getState,
    demoStore.getState
  );

  return {
    ...current,
    acceptInvitation: (id: string) => demoStore.acceptInvitation(id),
    declineInvitation: (id: string) => demoStore.declineInvitation(id),
    submitMilestone: (
      projectId: string,
      milestoneId: string,
      notes: string,
      review?: AIReviewResult
    ) => demoStore.submitMilestone(projectId, milestoneId, notes, review),
    createProject: (payload: NewProjectPayload) => demoStore.createProject(payload),
    recordClientScore: (projectId: string, milestoneId: string, score: number) =>
      demoStore.recordClientScore(projectId, milestoneId, score),
    acceptClientMilestone: (projectId: string, milestoneId: string) =>
      demoStore.acceptClientMilestone(projectId, milestoneId),
    requestChangesClientMilestone: (projectId: string, milestoneId: string, notes?: string) =>
      demoStore.requestChangesClientMilestone(projectId, milestoneId, notes),
    inviteFreelancer: (id: string, name: string) => demoStore.inviteFreelancer(id, name),
    showToast: (text: string, type?: 'success' | 'info' | 'caution') =>
      demoStore.showToast(text, type),
    dismissToast: (id: string) => demoStore.dismissToast(id),
    getProjectById: (id: string) => demoStore.getProjectById(id),
    getClientProjectById: (id: string) => demoStore.getClientProjectById(id),
  };
}
