import type {
  ImpactOverview,
  ImpactInitiative,
  ImpactDisbursement,
  ImpactBadge,
  UserContributionsData,
} from '../types/impact';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/impact${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail || `Request failed with status ${response.status}.`);
  }
  return response.json() as Promise<T>;
}

export const impactService = {
  getOverview: () => request<ImpactOverview>('/overview'),
  getInitiatives: (category?: string) =>
    request<ImpactInitiative[]>(category ? `/initiatives?category=${encodeURIComponent(category)}` : '/initiatives'),
  getInitiative: (id: string) => request<ImpactInitiative & { disbursements: ImpactDisbursement[] }>(`/initiatives/${id}`),
  getMyContributions: () => request<UserContributionsData>('/my-contributions'),
  getMyBadges: () => request<ImpactBadge[]>('/my-badges'),
  updateBadgeVisibility: (badgeType: string, visibility: 'public' | 'private') =>
    request<ImpactBadge>('/badge-visibility', {
      method: 'PUT',
      body: JSON.stringify({ badge_type: badgeType, visibility }),
    }),
  createInitiative: (data: {
    title: string;
    description: string;
    category: string;
    target_amount_cents: number;
    organization_name: string;
    image_url?: string;
    evidence_url?: string;
  }) =>
    request<ImpactInitiative>('/initiatives', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  recordDisbursement: (data: {
    initiative_id: string;
    amount_cents: number;
    recipient: string;
    reference_id: string;
    evidence_url?: string;
    notes?: string;
  }) =>
    request<ImpactDisbursement>('/disbursements', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getLedger: (limit = 50) => request<any[]>(`/ledger?limit=${limit}`),
  getSettings: () => request<any>('/settings'),
  updateSettings: (data: any) =>
    request<any>('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};
