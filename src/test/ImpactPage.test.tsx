import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImpactPage } from '../components/impact/ImpactPage';
import { impactService } from '../services/impactService';

vi.mock('../services/impactService', () => ({
  impactService: {
    getOverview: vi.fn(),
    getInitiatives: vi.fn(),
    getMyContributions: vi.fn(),
    createInitiative: vi.fn(),
    recordDisbursement: vi.fn(),
    updateBadgeVisibility: vi.fn(),
  },
}));

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('ImpactPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    vi.mocked(impactService.getOverview).mockReturnValue(new Promise(() => {}));
    vi.mocked(impactService.getInitiatives).mockReturnValue(new Promise(() => {}));
    vi.mocked(impactService.getMyContributions).mockReturnValue(new Promise(() => {}));

    renderWithRouter(<ImpactPage />);
    expect(screen.getByText(/loading verified social impact metrics/i)).toBeInTheDocument();
  });

  it('renders overview metrics and active initiatives', async () => {
    vi.mocked(impactService.getOverview).mockResolvedValue({
      total_allocated_cents: 250000,
      total_allocated: 2500.0,
      total_disbursed_cents: 80000,
      total_disbursed: 800.0,
      available_balance_cents: 170000,
      available_balance: 1700.0,
      active_initiatives_count: 2,
      verified_contributors_count: 14,
      categories: ['digital_literacy', 'women_empowerment'],
      recent_disbursements: [
        {
          id: 'disb-1',
          initiative_id: 'init-1',
          amount_cents: 80000,
          amount: 800.0,
          recipient: 'Rural Digital Center',
          reference_id: 'REF-001',
          verification_status: 'verified',
          disbursed_at: '2026-11-01T10:00:00Z',
        },
      ],
    });

    vi.mocked(impactService.getInitiatives).mockResolvedValue([
      {
        id: 'init-1',
        title: 'Rural Digital Literacy Hub',
        description: 'Providing open-source computers to regional schools.',
        category: 'digital_literacy',
        target_amount_cents: 500000,
        target_amount: 5000.0,
        allocated_amount_cents: 250000,
        allocated_amount: 2500.0,
        disbursed_amount_cents: 80000,
        disbursed_amount: 800.0,
        progress_percentage: 50.0,
        status: 'active',
        organization_name: 'Digital Frontier Foundation',
        verification_status: 'verified',
        created_at: '2026-10-01T00:00:00Z',
      },
    ]);

    vi.mocked(impactService.getMyContributions).mockResolvedValue({
      user_id: 'test-user-id',
      verified_total_cents: 15000,
      verified_total: 150.0,
      pending_total_cents: 0,
      pending_total: 0.0,
      contributions_count: 1,
      contributions: [],
      badges: [
        {
          id: 'b-1',
          user_id: 'test-user-id',
          badge_type: 'starter',
          verified_contribution_total_cents: 15000,
          verified_contribution_total: 150.0,
          earned_at: '2026-11-05T00:00:00Z',
          visibility: 'public',
        },
      ],
    });

    renderWithRouter(<ImpactPage />);

    await waitFor(() => {
      expect(screen.getByText('Social Impact Fund')).toBeInTheDocument();
      expect(screen.getByText('$2,500')).toBeInTheDocument();
      expect(screen.getAllByText('$800').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Rural Digital Literacy Hub')).toBeInTheDocument();
      expect(screen.getByText('Rural Digital Center')).toBeInTheDocument();
    });
  });
});
