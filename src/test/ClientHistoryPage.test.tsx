import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClientHistoryPage } from '../components/client/ClientHistoryPage';
import { projectService } from '../services/projectService';

vi.mock('../services/projectService', () => ({
  projectService: {
    journey: vi.fn(),
  },
  paidAmountForReview: vi.fn(() => 0),
  projectBudget: vi.fn(() => 0),
}));

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('ClientHistoryPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    vi.mocked(projectService.journey).mockReturnValue(new Promise(() => {}));
    renderWithRouter(<ClientHistoryPage />);
    expect(screen.getByText(/loading engagement history/i)).toBeInTheDocument();
  });

  it('renders empty state when no historical projects exist', async () => {
    vi.mocked(projectService.journey).mockResolvedValue({
      projects: [],
      reviews: [],
    });

    renderWithRouter(<ClientHistoryPage />);

    await waitFor(() => {
      expect(screen.getByText(/no completed projects yet/i)).toBeInTheDocument();
    });
  });

  it('renders real freelancer name, dynamic initials avatar, and separates paid total', async () => {
    vi.mocked(projectService.journey).mockResolvedValue({
      projects: [
        {
          id: 'proj-456',
          title: 'PayPal Ledger Integration',
          freelancer_name: 'Alice Engineer',
          freelancer_headline: 'Staff Full-Stack AI Engineer',
          created_at: '2026-11-03T09:00:00Z',
          milestones: [],
        } as any,
      ],
      reviews: [
        {
          id: 'rev-2',
          project_id: 'proj-456',
          freelancer_name: 'Alice Engineer',
          milestone_title: 'Server-Side PayPal Capture',
          final_score: 95,
          feedback: 'Exemplary execution.',
          paid_amount: 1500,
          is_paid: true,
          milestone_amount: 1500,
          created_at: '2026-11-04T15:00:00Z',
        } as any,
      ],
    });

    renderWithRouter(<ClientHistoryPage />);

    await waitFor(() => {
      expect(screen.getByText('Alice Engineer')).toBeInTheDocument();
      expect(screen.getByText('AE')).toBeInTheDocument(); // Dynamic avatar initials
      expect(screen.getByText('PayPal Ledger Integration')).toBeInTheDocument();
    });

    // Check confirmed paid badge
    expect(screen.getByText('Paid (Sandbox)')).toBeInTheDocument();
  });
});
