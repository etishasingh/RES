import type {
  SpotlightPackage,
  SpotlightPurchase,
  TargetSpotlightInfo,
  ActiveSpotlightsResponse,
} from '../types/spotlight';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/spotlight${path}`, {
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

export const spotlightService = {
  getPackages: (targetType?: 'proposal' | 'project') =>
    request<SpotlightPackage[]>(targetType ? `/packages?target_type=${targetType}` : '/packages'),

  purchase: (data: {
    target_type: 'proposal' | 'project';
    target_id: string;
    package_id: string;
    payment_reference?: string;
  }) =>
    request<SpotlightPurchase>('/purchase', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getMyPurchases: () => request<SpotlightPurchase[]>('/my-purchases'),

  getActive: (targetType?: 'proposal' | 'project') =>
    request<ActiveSpotlightsResponse>(targetType ? `/active?target_type=${targetType}` : '/active'),

  checkTarget: (targetType: 'proposal' | 'project', targetId: string) =>
    request<TargetSpotlightInfo>(`/target/${targetType}/${targetId}`),

  getSettings: () => request<any>('/settings'),

  updateSettings: (data: any) =>
    request<any>('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};
