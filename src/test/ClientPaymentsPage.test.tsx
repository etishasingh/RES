import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClientPaymentsPage } from '../components/client/ClientPaymentsPage';
import { paymentApi } from '../services/paymentApi';

vi.mock('../services/paymentApi', () => ({
  paymentApi: {
    listPayments: vi.fn(),
  },
}));

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('ClientPaymentsPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    vi.mocked(paymentApi.listPayments).mockReturnValue(new Promise(() => {}));
    renderWithRouter(<ClientPaymentsPage />);
    expect(screen.getByText(/loading payment ledger/i)).toBeInTheDocument();
  });

  it('renders empty state when no transactions exist', async () => {
    vi.mocked(paymentApi.listPayments).mockResolvedValue({
      payments: [],
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 1,
    });

    renderWithRouter(<ClientPaymentsPage />);

    await waitFor(() => {
      expect(screen.getByText(/no transactions yet/i)).toBeInTheDocument();
      expect(screen.getByText(/view active projects/i)).toBeInTheDocument();
    });
  });

  it('renders real transaction ledger with settled payments and calculations', async () => {
    vi.mocked(paymentApi.listPayments).mockResolvedValue({
      payments: [
        {
          id: 'pay-tx-101',
          project_id: 'proj-123',
          project_title: 'Full-Stack Escrow Architecture',
          milestone_id: 'm-1',
          milestone_title: 'Smart Scaffolding & Security',
          milestone_number: 1,
          milestone_amount_cents: 100000,
          tip_amount_cents: 10000,
          tip_cents: 10000,
          total_amount_cents: 110000,
          amount_cents: 110000,
          amount: 1100,
          currency: 'USD',
          status: 'COMPLETED',
          frontend_status: 'paid_sandbox',
          sandbox_reference: 'SANDBOX-CAP78901',
          created_at: '2026-11-05T10:00:00Z',
          captured_at: '2026-11-05T10:05:00Z',
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
      summary: {
        totalPaidMinor: 110000,
        currency: 'USD',
      },
    });

    renderWithRouter(<ClientPaymentsPage />);

    await waitFor(() => {
      expect(screen.getByText('Full-Stack Escrow Architecture')).toBeInTheDocument();
      expect(screen.getByText('Smart Scaffolding & Security')).toBeInTheDocument();
      expect(screen.getByText('SANDBOX-CAP78901')).toBeInTheDocument();
    });

    expect(screen.getByText('Paid (Sandbox)')).toBeInTheDocument();
  });

  it('handles load errors and provides a retry mechanism', async () => {
    vi.mocked(paymentApi.listPayments).mockRejectedValue(new Error('Network error loading payments'));

    renderWithRouter(<ClientPaymentsPage />);

    await waitFor(() => {
      expect(screen.getByText(/network error loading payments/i)).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    expect(retryBtn).toBeInTheDocument();

    vi.mocked(paymentApi.listPayments).mockResolvedValue({
      payments: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 1,
    });

    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText(/no transactions yet/i)).toBeInTheDocument();
    });
  });
});

