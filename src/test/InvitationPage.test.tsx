import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InvitationPage } from '../components/freelancer/InvitationPage';
import { projectService } from '../services/projectService';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../services/projectService', () => ({
  projectService: {
    invitations: vi.fn(),
    acceptInvitation: vi.fn(),
    declineInvitation: vi.fn(),
    get: vi.fn().mockResolvedValue(null),
    getMyRequest: vi.fn().mockResolvedValue(null),
  },
}));

const renderInvitationRoute = (projectId: string) => {
  return render(
    <MemoryRouter initialEntries={[`/freelancer/invitation/${projectId}`]}>
      <Routes>
        <Route path="/freelancer/invitation/:id" element={<InvitationPage />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('InvitationPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    vi.mocked(projectService.invitations).mockReturnValue(new Promise(() => {}));
    renderInvitationRoute('proj-999');
    expect(screen.getByText(/retrieving invitation details/i)).toBeInTheDocument();
  });

  it('renders invitation details with real client name and milestones', async () => {
    vi.mocked(projectService.invitations).mockResolvedValue([
      {
        id: 'inv-101',
        project_id: 'proj-999',
        freelancer_id: 'fl-1',
        status: 'pending',
        client_name: 'Acme Partner',
        client_organization: 'Acme Corp',
        project: {
          id: 'proj-999',
          title: 'Full-Stack Escrow Architecture',
          description: 'Deploying PayPal sandbox and backend ledger.',
          budget_min: 2000,
          budget_max: 3000,
          skills: ['React', 'FastAPI'],
          milestones: [
            {
              id: 'm-1',
              title: 'API Hardening',
              description: 'Secure session cookies',
              amount: 1000,
              due_date: '2026-12-01',
              status: 'not_started',
              order: 0,
            },
          ],
        },
      } as any,
    ]);

    renderInvitationRoute('proj-999');

    await waitFor(() => {
      const titles = screen.getAllByText('Full-Stack Escrow Architecture');
      expect(titles.length).toBeGreaterThan(0);
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
      expect(screen.getByText('Deploying PayPal sandbox and backend ledger.')).toBeInTheDocument();
    });
  });

  it('handles acceptance failure gracefully and displays error banner', async () => {
    vi.mocked(projectService.invitations).mockResolvedValue([
      {
        id: 'inv-101',
        project_id: 'proj-999',
        status: 'pending',
        client_name: 'Acme Partner',
        client_organization: 'Acme Corp',
        project: {
          id: 'proj-999',
          title: 'Full-Stack Escrow Architecture',
          description: 'Brief info',
          budget_min: 1000,
          budget_max: 1000,
          skills: [],
          milestones: [
            {
              id: 'm-1',
              title: 'Deliverable 1',
              amount: 1000,
              due_date: '2026-12-01',
              status: 'not_started',
              order: 0,
            },
          ],
        },
      } as any,
    ]);

    vi.mocked(projectService.acceptInvitation).mockRejectedValue(
      new Error('Invitation expired or already accepted')
    );

    renderInvitationRoute('proj-999');

    await waitFor(() => {
      const titles = screen.getAllByText('Full-Stack Escrow Architecture');
      expect(titles.length).toBeGreaterThan(0);
    });

    const acceptButton = screen.getByRole('button', { name: /accept invitation/i });
    fireEvent.click(acceptButton);

    await waitFor(() => {
      expect(screen.getByText(/invitation expired or already accepted/i)).toBeInTheDocument();
    });

    // Button should be re-enabled after failure (not stuck in processing)
    expect(acceptButton).not.toBeDisabled();
  });
});
