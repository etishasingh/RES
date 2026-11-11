import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JourneyPage } from '../components/freelancer/JourneyPage';
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

describe('JourneyPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    vi.mocked(projectService.journey).mockReturnValue(new Promise(() => {}));
    renderWithRouter(<JourneyPage />);
    expect(screen.getByText(/loading your delivery history/i)).toBeInTheDocument();
  });

  it('renders empty state when no journey items exist', async () => {
    vi.mocked(projectService.journey).mockResolvedValue({
      projects: [],
      reviews: [],
    });

    renderWithRouter(<JourneyPage />);

    await waitFor(() => {
      expect(screen.getByText(/no completed milestones yet/i)).toBeInTheDocument();
    });
  });

  it('renders real client and milestone data, separating accepted value from confirmed paid', async () => {
    vi.mocked(projectService.journey).mockResolvedValue({
      projects: [
        {
          id: 'proj-123',
          title: 'Autonomous AI Escrow System',
          client_name: 'Acme Corp Client',
          client_organization: 'Acme Global',
          created_at: '2026-11-01T10:00:00Z',
          milestones: [
            {
              id: 'm-1',
              title: 'Smart Scaffolding & Security',
              amount: 1000,
              status: 'accepted',
              order: 0,
            },
          ],
        } as any,
      ],
      reviews: [
        {
          id: 'rev-1',
          project_id: 'proj-123',
          milestone_id: 'm-1',
          milestone_title: 'Smart Scaffolding & Security',
          client_name: 'Acme Corp Client',
          client_organization: 'Acme Global',
          deliverable_text: 'Completed authentication security hardening.',
          final_score: 92,
          client_score: 92,
          ai_score: 92,
          feedback: 'Superb work on Milestone 1!',
          decision: 'accepted',
          paid_amount: 0,
          is_paid: false,
          milestone_amount: 1000,
          created_at: '2026-11-02T12:00:00Z',
        } as any,
      ],
    });

    renderWithRouter(<JourneyPage />);

    await waitFor(() => {
      expect(screen.getByText('Autonomous AI Escrow System')).toBeInTheDocument();
      expect(screen.getByText('Acme Global')).toBeInTheDocument();
      expect(screen.getByText(/Smart Scaffolding & Security/)).toBeInTheDocument();
    });

    // Verify Financial Invariant: Uncaptured accepted milestone shows Awaiting Settlement
    expect(screen.getByText(/awaiting settlement/i)).toBeInTheDocument();
  });
});
