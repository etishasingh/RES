export interface SpotlightPackage {
  id: string;
  name: string;
  price_cents: number;
  price: number;
  currency: string;
  duration_hours: number;
  target_type: 'proposal' | 'project' | 'both';
  description: string;
  active: boolean;
}

export interface SpotlightPurchase {
  id: string;
  user_id: string;
  target_type: 'proposal' | 'project';
  target_id: string;
  package_id: string;
  package_name?: string;
  amount_cents: number;
  amount: number;
  currency: string;
  payment_status: 'COMPLETED' | 'PENDING' | 'FAILED' | 'REFUNDED';
  payment_reference?: string;
  purchased_at: string;
  starts_at: string;
  expires_at: string;
  is_active: boolean;
  remaining_seconds: number;
  impact_allocated_cents?: number;
  fairness_notice?: string;
}

export interface TargetSpotlightInfo {
  target_type: 'proposal' | 'project';
  target_id: string;
  is_spotlight_active: boolean;
  purchase?: SpotlightPurchase | null;
  fairness_notice?: string;
}

export interface ActiveSpotlightsResponse {
  active_items: SpotlightPurchase[];
  count: number;
  fairness_notice: string;
}
