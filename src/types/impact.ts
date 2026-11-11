export interface ImpactInitiative {
  id: string;
  title: string;
  description: string;
  category: string;
  target_amount_cents: number;
  target_amount: number;
  allocated_amount_cents: number;
  allocated_amount: number;
  disbursed_amount_cents: number;
  disbursed_amount: number;
  progress_percentage: number;
  status: 'active' | 'funded' | 'completed' | 'paused';
  organization_name: string;
  verification_status: string;
  image_url?: string;
  evidence_url?: string;
  created_at: string;
  updated_at?: string;
}

export interface ImpactDisbursement {
  id: string;
  initiative_id: string;
  initiative_title?: string;
  amount_cents: number;
  amount: number;
  recipient: string;
  reference_id: string;
  verification_status: string;
  evidence_url?: string;
  notes?: string;
  disbursed_at: string;
}

export interface ImpactContribution {
  id: string;
  user_id: string;
  source_type: string;
  source_transaction_id: string;
  amount_cents: number;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
}

export interface ImpactBadge {
  id: string;
  user_id: string;
  badge_type: 'starter' | 'supporter' | 'champion' | 'leader';
  verified_contribution_total_cents: number;
  verified_contribution_total: number;
  earned_at: string;
  visibility: 'public' | 'private';
}

export interface ImpactOverview {
  total_allocated_cents: number;
  total_allocated: number;
  total_disbursed_cents: number;
  total_disbursed: number;
  available_balance_cents: number;
  available_balance: number;
  active_initiatives_count: number;
  verified_contributors_count: number;
  categories: string[];
  recent_disbursements: ImpactDisbursement[];
}

export interface UserContributionsData {
  user_id: string;
  verified_total_cents: number;
  verified_total: number;
  pending_total_cents: number;
  pending_total: number;
  contributions_count: number;
  contributions: ImpactContribution[];
  badges: ImpactBadge[];
}
