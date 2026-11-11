import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpotlightModal } from '../components/spotlight/SpotlightModal';
import { spotlightService } from '../services/spotlightService';

vi.mock('../services/spotlightService', () => ({
  spotlightService: {
    getPackages: vi.fn(),
    purchase: vi.fn(),
  },
}));

describe('SpotlightModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders package options and fairness guarantee notice', async () => {
    vi.mocked(spotlightService.getPackages).mockResolvedValue([
      {
        id: 'pkg_quick',
        name: 'Quick Spotlight',
        price_cents: 1900,
        price: 19.0,
        currency: 'USD',
        duration_hours: 2,
        target_type: 'both',
        description: '2 hours prominence',
        active: true,
      },
      {
        id: 'pkg_featured',
        name: 'Featured Spotlight',
        price_cents: 4900,
        price: 49.0,
        currency: 'USD',
        duration_hours: 6,
        target_type: 'both',
        description: '6 hours prominence',
        active: true,
      },
    ]);

    render(
      <SpotlightModal
        isOpen={true}
        onClose={vi.fn()}
        targetType="project"
        targetId="proj-123"
        targetTitle="Distributed Neural Mesh"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Boost Project Visibility')).toBeInTheDocument();
      expect(screen.getByText('Quick Spotlight')).toBeInTheDocument();
      expect(screen.getAllByText('Featured Spotlight').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Platform Fairness Guarantee/i)).toBeInTheDocument();
      expect(screen.getByText(/never/i)).toBeInTheDocument();
    });
  });

  it('handles successful simulated purchase', async () => {
    vi.mocked(spotlightService.getPackages).mockResolvedValue([
      {
        id: 'pkg_quick',
        name: 'Quick Spotlight',
        price_cents: 1900,
        price: 19.0,
        currency: 'USD',
        duration_hours: 2,
        target_type: 'both',
        description: '2 hours prominence',
        active: true,
      },
    ]);

    vi.mocked(spotlightService.purchase).mockResolvedValue({
      id: 'spot-123',
      user_id: 'test-user-id',
      target_type: 'project',
      target_id: 'proj-123',
      package_id: 'pkg_quick',
      amount_cents: 1900,
      amount: 19.0,
      currency: 'USD',
      payment_status: 'COMPLETED',
      purchased_at: '2026-11-10T12:00:00Z',
      starts_at: '2026-11-10T12:00:00Z',
      expires_at: '2026-11-10T14:00:00Z',
      is_active: true,
      remaining_seconds: 7200,
    });

    const onPurchased = vi.fn();

    render(
      <SpotlightModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={onPurchased}
        targetType="project"
        targetId="proj-123"
        targetTitle="Distributed Neural Mesh"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Pay \$19 via Sandbox/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Pay \$19 via Sandbox/i));

    await waitFor(() => {
      expect(spotlightService.purchase).toHaveBeenCalledWith({
        target_type: 'project',
        target_id: 'proj-123',
        package_id: 'pkg_quick',
        payment_reference: expect.stringContaining('SANDBOX-SPOTLIGHT-'),
      });
      expect(screen.getByText('Spotlight Active!')).toBeInTheDocument();
      expect(onPurchased).toHaveBeenCalled();
    });
  });
});
