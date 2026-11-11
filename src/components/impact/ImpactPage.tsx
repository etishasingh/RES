import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ClientHeader } from '../shared/ClientHeader';
import { FreelancerHeader } from '../shared/FreelancerHeader';
import { impactService } from '../../services/impactService';
import type {
  ImpactOverview,
  ImpactInitiative,
  UserContributionsData,
} from '../../types/impact';

export const ImpactPage: React.FC = () => {
  const { user } = useAuth();
  const [overview, setOverview] = useState<ImpactOverview | null>(null);
  const [initiatives, setInitiatives] = useState<ImpactInitiative[]>([]);
  const [userImpact, setUserImpact] = useState<UserContributionsData | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Admin Modal States
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminTab, setAdminTab] = useState<'initiative' | 'disbursement'>('initiative');
  const [newInitTitle, setNewInitTitle] = useState('');
  const [newInitOrg, setNewInitOrg] = useState('');
  const [newInitCategory, setNewInitCategory] = useState('digital_literacy');
  const [newInitTarget, setNewInitTarget] = useState(5000);
  const [newInitDesc, setNewInitDesc] = useState('');
  const [disbInitId, setDisbInitId] = useState('');
  const [disbAmount, setDisbAmount] = useState(500);
  const [disbRecipient, setDisbRecipient] = useState('');
  const [disbRef, setDisbRef] = useState('');
  const [adminSuccess, setAdminSuccess] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [ovData, initsData] = await Promise.all([
        impactService.getOverview(),
        impactService.getInitiatives(),
      ]);
      setOverview(ovData);
      setInitiatives(initsData);
      if (initsData.length > 0) {
        setDisbInitId(initsData[0].id);
      }

      if (user) {
        try {
          const uData = await impactService.getMyContributions();
          setUserImpact(uData);
        } catch {
          // Non-blocking if unauthenticated
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load PayPilot Impact data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleToggleBadgeVisibility = async (badgeType: string, currentVisibility: string) => {
    const nextVis = currentVisibility === 'public' ? 'private' : 'public';
    try {
      await impactService.updateBadgeVisibility(badgeType, nextVis);
      if (user) {
        const uData = await impactService.getMyContributions();
        setUserImpact(uData);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to toggle badge visibility.');
    }
  };

  const handleCreateInitiative = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await impactService.createInitiative({
        title: newInitTitle,
        organization_name: newInitOrg,
        category: newInitCategory,
        target_amount_cents: Math.round(newInitTarget * 100),
        description: newInitDesc,
      });
      setAdminSuccess('Initiative created successfully!');
      setNewInitTitle('');
      setNewInitOrg('');
      setNewInitDesc('');
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create initiative.');
    }
  };

  const handleRecordDisbursement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await impactService.recordDisbursement({
        initiative_id: disbInitId,
        amount_cents: Math.round(disbAmount * 100),
        recipient: disbRecipient,
        reference_id: disbRef || `DISB-AUDIT-${Date.now()}`,
      });
      setAdminSuccess('Disbursement recorded and verified successfully!');
      setDisbRecipient('');
      setDisbRef('');
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to record disbursement.');
    }
  };

  const filteredInitiatives =
    selectedCategory === 'all'
      ? initiatives
      : initiatives.filter((i) => i.category === selectedCategory);

  const categoryLabels: Record<string, string> = {
    all: 'All Initiatives',
    digital_literacy: 'Digital Literacy',
    women_empowerment: 'Women in Tech',
    rural_skills: 'Rural Skills',
    environmental_sustainability: 'Clean Energy',
    community_development: 'Community Dev',
  };

  // Select header based on user role
  const isFreelancer = user?.role === 'freelancer';
  const isAdminOrClient = user?.role === 'client' || (user as any)?.is_admin;

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#1E293B]">
      {isFreelancer ? (
        <FreelancerHeader
          title="PayPilot Impact"
          subtitle="Verifiable social contributions funded by transparent platform revenue."
          breadcrumbs={[
            { label: 'Dashboard', path: '/freelancer/dashboard' },
            { label: 'Impact' },
          ]}
        />
      ) : (
        <ClientHeader
          title="PayPilot Impact"
          subtitle="Verifiable social contributions funded by transparent platform revenue."
          breadcrumbs={[
            { label: 'Dashboard', path: '/client/dashboard' },
            { label: 'Impact' },
          ]}
        />
      )}

      <main className="max-w-[1280px] mx-auto px-4 sm:px-8 py-8 space-y-10">
        {/* Loading and Error states */}
        {isLoading && (
          <div className="py-8 text-center text-[#455A6A]">
            <div className="animate-spin h-8 w-8 border-4 border-deepBlue border-t-transparent rounded-full mx-auto mb-2" />
            <p className="text-sm font-medium">Loading verified social impact metrics...</p>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-[#FAF3E7] border border-[#E8D2AC] text-[#874E0E] text-sm">
            {error}
          </div>
        )}

        {/* SECTION 1: Platform Overview Cards */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-semibold tracking-wider uppercase text-deepBlue/70">
                Transparent Platform Revenue Allocation
              </span>
              <h2 className="font-display text-2xl sm:text-3xl text-deepBlue">
                Social Impact Fund
              </h2>
            </div>
            {isAdminOrClient && (
              <button
                type="button"
                onClick={() => {
                  setShowAdminModal(true);
                  setAdminSuccess(null);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-deepBlue text-[#FDFBF7] text-xs font-semibold hover:bg-[#002B45] transition-colors self-start sm:self-auto cursor-pointer shadow-sm"
              >
                <span>⚙️</span> Manage Initiatives & Disbursements
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#003C5F]/15 shadow-sm space-y-1">
              <span className="text-[11px] font-medium text-[#455A6A] uppercase tracking-wider">
                Total Allocated
              </span>
              <p className="font-display text-xl sm:text-2xl text-deepBlue font-bold">
                ${overview?.total_allocated.toLocaleString() || '0.00'}
              </p>
              <span className="text-[10px] text-[#24543A] block">From 30% fee split & spotlight</span>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#003C5F]/15 shadow-sm space-y-1">
              <span className="text-[11px] font-medium text-[#455A6A] uppercase tracking-wider">
                Total Disbursed
              </span>
              <p className="font-display text-xl sm:text-2xl text-emerald-700 font-bold">
                ${overview?.total_disbursed.toLocaleString() || '0.00'}
              </p>
              <span className="text-[10px] text-[#455A6A] block">Audited releases</span>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#003C5F]/15 shadow-sm space-y-1">
              <span className="text-[11px] font-medium text-[#455A6A] uppercase tracking-wider">
                Available Fund
              </span>
              <p className="font-display text-xl sm:text-2xl text-amber-700 font-bold">
                ${overview?.available_balance.toLocaleString() || '0.00'}
              </p>
              <span className="text-[10px] text-amber-800/80 block">Undisbursed capital</span>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#003C5F]/15 shadow-sm space-y-1">
              <span className="text-[11px] font-medium text-[#455A6A] uppercase tracking-wider">
                Active Causes
              </span>
              <p className="font-display text-xl sm:text-2xl text-deepBlue font-bold">
                {overview?.active_initiatives_count || 0}
              </p>
              <span className="text-[10px] text-[#455A6A] block">Verified initiatives</span>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#003C5F]/15 shadow-sm space-y-1 col-span-2 lg:col-span-1">
              <span className="text-[11px] font-medium text-[#455A6A] uppercase tracking-wider">
                Contributors
              </span>
              <p className="font-display text-xl sm:text-2xl text-deepBlue font-bold">
                {overview?.verified_contributors_count || 0}
              </p>
              <span className="text-[10px] text-[#455A6A] block">Clients & freelancers</span>
            </div>
          </div>
        </section>

        {/* SECTION 2: User Impact Dashboard (if authenticated) */}
        {user && (
          <section className="p-6 rounded-2xl bg-[#F6F3EC] border border-[#003C5F]/15 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] uppercase tracking-wider font-semibold text-deepBlue/70">
                  Your Impact Portfolio
                </span>
                <h3 className="font-display text-xl text-deepBlue">
                  {user.name}’s Verified Contributions
                </h3>
              </div>
              <div className="text-right">
                <span className="text-[11px] uppercase tracking-wider text-[#455A6A]">
                  Total Generated
                </span>
                <p className="font-display text-2xl text-deepBlue font-bold">
                  ${userImpact?.verified_total.toLocaleString() || '0.00'}
                </p>
              </div>
            </div>

            {/* Badges showcase */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#455A6A]">
                Earned Reputation Badges
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { type: 'starter', label: 'Impact Starter', min: '$100+' },
                  { type: 'supporter', label: 'Impact Supporter', min: '$500+' },
                  { type: 'champion', label: 'Impact Champion', min: '$2,000+' },
                  { type: 'leader', label: 'Impact Leader', min: '$5,000+' },
                ].map((tier) => {
                  const earned = userImpact?.badges.find((b) => b.badge_type === tier.type);
                  return (
                    <div
                      key={tier.type}
                      className={`p-3.5 rounded-xl border text-left transition-all ${
                        earned
                          ? 'bg-white border-[#F59E0B]/40 shadow-sm ring-1 ring-[#F59E0B]/20'
                          : 'bg-white/40 border-[#003C5F]/10 opacity-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-lg">{earned ? '🎖️' : '🔒'}</span>
                        {earned && (
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleBadgeVisibility(earned.badge_type, earned.visibility)
                            }
                            className="text-[10px] uppercase font-semibold text-[#455A6A] hover:text-deepBlue"
                            title="Click to toggle Public / Private visibility"
                          >
                            {earned.visibility}
                          </button>
                        )}
                      </div>
                      <p className="mt-2 text-xs font-semibold text-deepBlue">{tier.label}</p>
                      <span className="text-[10px] text-[#455A6A]">{tier.min}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* SECTION 3: Verified Initiatives Showcase */}
        <section className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-semibold tracking-wider uppercase text-deepBlue/70">
                Verified Social Causes
              </span>
              <h3 className="font-display text-2xl text-deepBlue">Active Initiatives</h3>
            </div>

            {/* Category tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
              {['all', 'digital_literacy', 'women_empowerment', 'environmental_sustainability', 'rural_skills'].map(
                (cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-deepBlue text-[#FDFBF7]'
                        : 'bg-white border border-[#003C5F]/15 text-[#455A6A] hover:text-deepBlue'
                    }`}
                  >
                    {categoryLabels[cat] || cat}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {filteredInitiatives.map((init) => (
              <div
                key={init.id}
                className="bg-white rounded-2xl border border-[#003C5F]/15 p-5 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#003C5F]/5 text-deepBlue font-medium text-[11px] border border-[#003C5F]/10">
                      {categoryLabels[init.category] || init.category}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#24543A]">
                      <span>✓</span> Verified Partner
                    </span>
                  </div>

                  <div>
                    <h4 className="font-display text-lg text-deepBlue leading-tight font-bold">
                      {init.title}
                    </h4>
                    <p className="text-xs text-[#455A6A] font-medium mt-0.5">
                      {init.organization_name}
                    </p>
                  </div>

                  <p className="text-xs text-[#455A6A] line-clamp-3 leading-relaxed">
                    {init.description}
                  </p>
                </div>

                <div className="space-y-3 pt-3 border-t border-[#003C5F]/10">
                  {/* Progress bar */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-deepBlue mb-1">
                      <span>${init.allocated_amount.toLocaleString()} allocated</span>
                      <span>Target: ${init.target_amount.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#F6F3EC] overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-deepBlue to-emerald-600 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(init.progress_percentage, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#455A6A]">
                    <span>Disbursed: ${init.disbursed_amount.toLocaleString()}</span>
                    {init.evidence_url && (
                      <a
                        href={init.evidence_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-deepBlue font-medium hover:underline inline-flex items-center gap-0.5"
                      >
                        Audit Report ↗
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 4: Verified Disbursements Ledger Table */}
        <section className="space-y-4">
          <div>
            <span className="text-[11px] font-semibold tracking-wider uppercase text-deepBlue/70">
              Auditable Proof of Payout
            </span>
            <h3 className="font-display text-2xl text-deepBlue">Recent Verified Disbursements</h3>
          </div>

          <div className="bg-white rounded-2xl border border-[#003C5F]/15 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#1E293B]">
                <thead className="bg-[#F6F3EC] text-[#455A6A] uppercase text-[10px] tracking-wider border-b border-[#003C5F]/10">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Date</th>
                    <th className="py-3 px-4 font-semibold">Recipient & Purpose</th>
                    <th className="py-3 px-4 font-semibold">Amount</th>
                    <th className="py-3 px-4 font-semibold">Audit Reference</th>
                    <th className="py-3 px-4 font-semibold">Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#003C5F]/10">
                  {overview?.recent_disbursements && overview.recent_disbursements.length > 0 ? (
                    overview.recent_disbursements.map((d) => (
                      <tr key={d.id} className="hover:bg-[#FDFBF7]/50 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap text-[#455A6A]">
                          {new Date(d.disbursed_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-deepBlue">{d.recipient}</p>
                          {d.notes && <p className="text-[11px] text-[#455A6A]">{d.notes}</p>}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-bold text-emerald-800">
                          ${d.amount.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-[#455A6A]">
                          {d.reference_id}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full bg-[#EAF5EF] text-[#24543A] text-[10px] font-semibold border border-[#B2DAC3]">
                            Verified
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-[#455A6A]">
                        No disbursements recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      {/* Admin Operations Modal */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-[#003C5F]/15 overflow-hidden">
            <div className="bg-deepBlue text-[#FDFBF7] p-5 flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">PayPilot Impact Administration</h3>
              <button
                type="button"
                onClick={() => setShowAdminModal(false)}
                className="text-[#FDFBF7]/70 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Tab switch */}
            <div className="flex border-b border-[#003C5F]/10 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setAdminTab('initiative')}
                className={`flex-1 py-3 text-center transition-colors ${
                  adminTab === 'initiative'
                    ? 'border-b-2 border-deepBlue text-deepBlue bg-[#F6F3EC]'
                    : 'text-[#455A6A] hover:bg-[#FDFBF7]'
                }`}
              >
                Create Initiative
              </button>
              <button
                type="button"
                onClick={() => setAdminTab('disbursement')}
                className={`flex-1 py-3 text-center transition-colors ${
                  adminTab === 'disbursement'
                    ? 'border-b-2 border-deepBlue text-deepBlue bg-[#F6F3EC]'
                    : 'text-[#455A6A] hover:bg-[#FDFBF7]'
                }`}
              >
                Record Disbursement
              </button>
            </div>

            <div className="p-6">
              {adminSuccess && (
                <div className="mb-4 p-3 rounded-lg bg-[#EAF5EF] border border-[#B2DAC3] text-[#24543A] text-xs">
                  {adminSuccess}
                </div>
              )}

              {adminTab === 'initiative' ? (
                <form onSubmit={handleCreateInitiative} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-[#455A6A] font-semibold mb-1">Title</label>
                    <input
                      type="text"
                      required
                      value={newInitTitle}
                      onChange={(e) => setNewInitTitle(e.target.value)}
                      placeholder="e.g. Solar Computing Labs"
                      className="w-full px-3 py-2 rounded-lg border border-[#003C5F]/20"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[#455A6A] font-semibold mb-1">Organization</label>
                      <input
                        type="text"
                        required
                        value={newInitOrg}
                        onChange={(e) => setNewInitOrg(e.target.value)}
                        placeholder="Organization name"
                        className="w-full px-3 py-2 rounded-lg border border-[#003C5F]/20"
                      />
                    </div>
                    <div>
                      <label className="block text-[#455A6A] font-semibold mb-1">Target ($)</label>
                      <input
                        type="number"
                        min="100"
                        required
                        value={newInitTarget}
                        onChange={(e) => setNewInitTarget(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-[#003C5F]/20"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[#455A6A] font-semibold mb-1">Category</label>
                    <select
                      value={newInitCategory}
                      onChange={(e) => setNewInitCategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[#003C5F]/20 bg-white"
                    >
                      <option value="digital_literacy">Digital Literacy</option>
                      <option value="women_empowerment">Women in Tech</option>
                      <option value="environmental_sustainability">Clean Energy</option>
                      <option value="rural_skills">Rural Skills</option>
                      <option value="community_development">Community Dev</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[#455A6A] font-semibold mb-1">Description</label>
                    <textarea
                      required
                      rows={3}
                      value={newInitDesc}
                      onChange={(e) => setNewInitDesc(e.target.value)}
                      placeholder="Scope, community impact, and deliverables..."
                      className="w-full px-3 py-2 rounded-lg border border-[#003C5F]/20"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-lg bg-deepBlue text-white font-semibold hover:bg-[#002B45] transition-colors"
                  >
                    Save Initiative
                  </button>
                </form>
              ) : (
                <form onSubmit={handleRecordDisbursement} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-[#455A6A] font-semibold mb-1">Initiative</label>
                    <select
                      value={disbInitId}
                      onChange={(e) => setDisbInitId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[#003C5F]/20 bg-white"
                    >
                      {initiatives.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[#455A6A] font-semibold mb-1">Amount ($)</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={disbAmount}
                        onChange={(e) => setDisbAmount(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-[#003C5F]/20"
                      />
                    </div>
                    <div>
                      <label className="block text-[#455A6A] font-semibold mb-1">Audit Reference</label>
                      <input
                        type="text"
                        value={disbRef}
                        onChange={(e) => setDisbRef(e.target.value)}
                        placeholder="e.g. DISB-2026-001"
                        className="w-full px-3 py-2 rounded-lg border border-[#003C5F]/20"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[#455A6A] font-semibold mb-1">Recipient</label>
                    <input
                      type="text"
                      required
                      value={disbRecipient}
                      onChange={(e) => setDisbRecipient(e.target.value)}
                      placeholder="Organization or vendor name"
                      className="w-full px-3 py-2 rounded-lg border border-[#003C5F]/20"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-lg bg-emerald-800 text-white font-semibold hover:bg-emerald-900 transition-colors"
                  >
                    Authorize & Log Disbursement
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
