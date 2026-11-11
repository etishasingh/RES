export type MilestoneStatus =
  | 'not_started'
  | 'in_progress'
  | 'submitted'
  | 'under_review'
  | 'accepted'
  | 'paid';

export interface Milestone {
  id: string;
  number: number;
  title: string;
  amount: number;
  dueDate: string;
  status: MilestoneStatus;
  acceptanceCriteria: string[];
  submissionNotes?: string;
  submittedAt?: string;
  aiReview?: AIReviewResult;
  modelScore?: number;
  clientScore?: number;
  finalScore?: number;
  scoreWeights?: { model: number; client: number };
  paymentReference?: string | null;
  paidAt?: string | null;
}

export type RequirementAssessmentStatus =
  | 'satisfied'
  | 'partially_satisfied'
  | 'not_satisfied'
  | 'unverified';

export interface EvaluationAssessment {
  criterion_id: string;
  description: string;
  status: RequirementAssessmentStatus;
  evidence: string;
  explanation: string;
  criterion?: string;
  detail?: string;
}

export type RequirementAssessment = EvaluationAssessment;

export interface EvaluationResult {
  overall_score: number; // 0-100
  dimension_scores?: Record<string, number>;
  requirement_assessments: EvaluationAssessment[];
  evidence_coverage?: number;
  missing_requirements: string[];
  improvement_suggestions: string[];
  confidence: number;
  evaluation_method?: string;
  limitations: string[];
  // Scoring fields
  modelScore?: number;
  clientScore?: number;
  finalScore?: number;
  scoreWeights?: { model: number; client: number };
  // Backwards compatibility / UI helper properties
  overallScore?: number;
  requirementAssessments?: EvaluationAssessment[];
  missingRequirements?: string[];
  improvementSuggestions?: string[];
  reviewedAt?: string;
}

export type AIReviewResult = EvaluationResult;

export type ProjectDiscipline = 'Design' | 'Engineering' | 'Writing';

export interface FreelancerProject {
  id: string;
  client: string;
  clientAvatarText: string;
  title: string;
  discipline: ProjectDiscipline;
  brief: string;
  totalBudget: number;
  deadline: string;
  matchScore: number;
  matchExplanation: string;
  requiredSkills: string[];
  milestones: Milestone[];
  status: 'invitation' | 'active' | 'completed';
  readOnly?: boolean;
}

export interface JourneyEntry {
  id: string;
  projectId: string;
  client: string;
  projectTitle: string;
  startDate: string;
  completedDate: string;
  amount: number;
  rating: number;
  feedback: string;
}

// ── Types matching the real POST /api/recommend response ──────────────────────

/** skill_gaps from the API is a dict {skill_name: demand_count} */
export interface SkillGapEntry {
  skill: string;
  demandCount: number;
}

/** Each element of the top-level `opportunities` array */
export interface OpportunityMatch {
  opportunity_id: string;
  title: string;
  organization_name: string;
  opportunity_type: string;
  overall_match_score: number;
  skills_matched: string[];
  skills_missing: string[];
  experience_compatibility: string;
  work_arrangement: string;
  listed_compensation: string;
  deadline: string;
  availability_status: string;
  application_url: string;
  explanation: string;
  improvement_suggestions: string;
}

/** Each element of the top-level `courses` array */
export interface RecommendedCourse {
  course_id: string;
  title: string;
  platform: string;
  provider_institution: string;
  skills_taught: string[];
  missing_skills_addressed: string[];
  relevance_score: number;
  difficulty_level: string;
  workload_hours: number;
  duration_weeks: number;
  price_inr: number;
  rating: number;
  credential_type: string;
  course_url: string;
  explanation: string;
}

/** Each element of learning_roadmap.milestones */
export interface RoadmapMilestone {
  phase: string;
  target_skill: string;
  opportunity_demand: string;
  recommended_course: string;
  platform: string;
  course_url: string;
  workload_hours: number;
  estimated_weeks_at_pace: number;
  cumulative_study_hours: number;
  projected_impact: string;
}

/** Aggregated shape returned by the service layer to LearningPage */
export interface LearningRoadmapData {
  opportunities: OpportunityMatch[];
  skillGaps: SkillGapEntry[];
  courses: RecommendedCourse[];
  milestones: RoadmapMilestone[];
  totalStudyHours: number;
  totalEstimatedWeeks: number;
}
