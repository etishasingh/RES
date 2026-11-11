import type { PaymentTransaction } from '../types/client';

export interface PayPalConfig {
  configured: boolean;
  clientId: string | null;
  mode: 'sandbox';
  currency: string;
}

export interface CreateOrderResponse {
  orderId: string;
  paymentId: string;
  amount: number;
  currency: string;
}

export interface CaptureOrderResponse {
  status: 'paid_sandbox';
  orderId: string;
  captureId: string | null;
  milestoneId: string;
  payment: PaymentTransaction;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/payments${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail || `Payment request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

export const paymentService = {
  getConfig: () => request<PayPalConfig>('/config'),

  createMilestoneOrder: (milestoneId: string) =>
    request<CreateOrderResponse>(`/milestones/${encodeURIComponent(milestoneId)}/create-order`, {
      method: 'POST',
    }),

  captureOrder: (orderId: string) =>
    request<CaptureOrderResponse>(`/orders/${encodeURIComponent(orderId)}/capture`, {
      method: 'POST',
    }),

  listMyPayments: async (): Promise<PaymentTransaction[]> => {
    const data = await request<{ payments: PaymentTransaction[] }>('/mine');
    return Array.isArray(data.payments) ? data.payments : [];
  },
};

