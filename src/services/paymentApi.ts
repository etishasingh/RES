/**
 * PayPilot AI – Payment API Service.
 *
 * Interfaces with the backend payment router (/api/payments).
 * Authenticates via session cookie (credentials: 'include').
 */
import { apiFetch } from '../lib/api';

export interface ApiPaymentItem {
  id: string;
  project_id: string;
  project_title?: string;
  milestone_id?: string;
  milestone_title?: string;
  milestone_number?: number;
  milestone_amount_cents: number;
  tip_amount_cents: number;
  tip_cents: number;
  total_amount_cents: number;
  amount_cents: number;
  amount: number;
  currency: string;
  status: 'CREATED' | 'APPROVED' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | string;
  frontend_status: 'paid_sandbox' | 'pending_approval' | 'scheduled' | string;
  sandbox_reference: string;
  created_at: string;
  captured_at?: string | null;
}

export interface PaymentListResponse {
  payments: ApiPaymentItem[];
  items?: ApiPaymentItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary?: {
    totalPaidMinor: number;
    currency: string;
  };
}

export interface CreatePaymentPayload {
  projectId: string;
  milestoneId: string;
  tipCents?: number;
  currency?: string;
  idempotencyKey?: string;
}

export interface CreatePaymentResponse {
  payment_id: string;
  paypal_order_id: string;
  approval_url?: string | null;
  status: string;
  amount_cents: number;
  amount: number;
  fee_cents: number;
  net_cents: number;
  currency: string;
  project_id: string;
  milestone_id: string;
  created_at: string;
}

export interface CapturePaymentResponse {
  payment_id: string;
  paypal_order_id: string;
  paypal_capture_id: string;
  status: string;
  amount_cents: number;
  fee_cents: number;
  net_cents: number;
  currency: string;
  sandbox_reference: string;
  captured_at: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, options);

  if (!response.ok) {
    let message = `Payment API error (${response.status})`;
    try {
      const err = await response.json();
      message = err.detail || err.message || message;
    } catch {
      // Ignore
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export const paymentApi = {
  listPayments: (page = 1, limit = 20) =>
    request<PaymentListResponse>(`/api/payments?page=${page}&limit=${limit}`),

  getPaymentDetail: (paymentId: string) =>
    request<ApiPaymentItem>(`/api/payments/${paymentId}`),

  createPaymentOrder: (payload: CreatePaymentPayload) =>
    request<CreatePaymentResponse>('/api/payments', {
      method: 'POST',
      body: JSON.stringify({
        project_id: payload.projectId,
        milestone_id: payload.milestoneId,
        tip_cents: payload.tipCents ?? 0,
        currency: payload.currency || 'USD',
        idempotency_key: payload.idempotencyKey,
      }),
    }),

  capturePayment: (paymentId: string, paypalOrderId?: string) =>
    request<CapturePaymentResponse>(`/api/payments/${paymentId}/capture`, {
      method: 'POST',
      body: JSON.stringify({ paypal_order_id: paypalOrderId }),
    }),
};

