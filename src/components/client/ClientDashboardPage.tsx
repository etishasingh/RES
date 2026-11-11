import React, { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ClientHeader } from '../shared/ClientHeader';
import { StatusPill } from '../shared/StatusPill';
import { Toast } from '../shared/Toast';
import { useCountUp } from '../../hooks/useCountUp';
import { useAuth } from '../../context/AuthContext';
import { clientService } from '../../services/clientService';
import { projectService, type ApiProjectRequest } from '../../services/projectService';
import { SpotlightBadge } from '../spotlight/SpotlightBadge';
import { SpotlightModal } from '../spotlight/SpotlightModal';
import { spotlightService } from '../../services/spotlightService';
import type { DirectoryFreelancer, ClientProject } from '../../types/client';
import type { TargetSpotlightInfo } from '../../types/spotlight';

const availabilityLabel = (availability: DirectoryFreelancer['availability_status']) => {
  if (availability === 'available') return 'Available';
  if (availability === 'limited') return 'Limited';
  return 'Unavailable';
};

const availabilityClasses = (availability: DirectoryFreelancer['availability_status']) => {
  if (availability === 'available') return 'bg-[#EAF5EF] text-[#24543A] border-[#B2DAC3]';
  if (availability === 'limited') return 'bg-[#FAF3E7] text-[#874E0E] border-[#E8D2AC]';
  return 'bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]';
};

export const ClientDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [clientProjects, setClientProjects] = useState<ClientProject[]>([]);
  const [projectError, setProjectError] = useState('');
  const [invitingFreelancerId, setInvitingFreelancerId] = useState<string | null>(null);
  const [inviteMessage, setInviteMessage] = useState('');
  const [incomingRequests, setIncomingRequests] = useState<ApiProjectRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestActionLoadingId, setRequestActionLoadingId] = useState<string | null>(null);
  const [requestMessage, setRequestMessage] = useState('');
  const currentProject = clientProjects[0];
  const [spotlightInfo, setSpotlightInfo] = useState<TargetSpotlightInfo | null>(null);
  const [showSpotlightModal, setShowSpotlightModal] = useState(() => {
    return typeof window !== 'undefined' && window.location.href.includes('spotlight=open');
  });

  useEffect(() => {
    if (!currentProject?.id) return;
    spotlightService
      .checkTarget('project', currentProject.id)
      .then(setSpotlightInfo)
      .catch(() => {});
  }, [currentProject?.id]);
  const inviteFreelancer = async (freelancerId: string, freelancerName: string) => {
    if (!currentProject) return;
    setInvitingFreelancerId(freelancerId);
    setProjectError('');
    setInviteMessage('');
    try {
      await clientService.inviteFreelancer(currentProject.id, freelancerId);
      setInviteMessage(`Invitation sent to ${freelancerName}.`);
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : 'Unable to send invitation.');
    } finally {
      setInvitingFreelancerId(null);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    setRequestActionLoadingId(requestId);
    setProjectError('');
    setRequestMessage('');
    try {
      const updated = await projectService.acceptRequest(requestId);
      setIncomingRequests((prev) =>
        prev.map((r) => (r.id === requestId ? updated : r))
      );
      clientService.getClientProjects().then(setClientProjects).catch(() => {});
      setRequestMessage(`Request accepted! A project invitation has been issued to ${updated.freelancer?.name || 'the specialist'}.`);
    } catch (err) {
      setProjectError(err instanceof Error ? err.message : 'Unable to accept request.');
    } finally {
      setRequestActionLoadingId(null);
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    setRequestActionLoadingId(requestId);
    setProjectError('');
    setRequestMessage('');
    try {
      const updated = await projectService.declineRequest(requestId);
      setIncomingRequests((prev) =>
        prev.map((r) => (r.id === requestId ? updated : r))
      );
      setRequestMessage(`Request from ${updated.freelancer?.name || 'the specialist'} has been declined.`);
    } catch (err) {
      setProjectError(err instanceof Error ? err.message : 'Unable to decline request.');
    } finally {
      setRequestActionLoadingId(null);
    }
  };

  useEffect(() => {
    clientService.getClientProjects().then(setClientProjects).catch((error) => setProjectError(error instanceof Error ? error.message : 'Unable to load projects.'));
    projectService
      .incomingRequests()
      .then(setIncomingRequests)
      .catch(() => setIncomingRequests([]))
      .finally(() => setRequestsLoading(false));
  }, []);

  const [freelancerSearch, setFreelancerSearch] = useState('');
  const [selectedSkillFilter, setSelectedSkillFilter] = useState('All');
  const [freelancers, setFreelancers] = useState<DirectoryFreelancer[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [directoryError, setDirectoryError] = useState('');

  useEffect(() => {
    document.title = 'PayPilot AI — Client Dashboard';
  }, []);

  useEffect(() => {
    let cancelled = false;
    setDirectoryLoading(true);
    setDirectoryError('');

    clientService
      .getFreelancers({
        q: freelancerSearch.trim() || undefined,
        skill: selectedSkillFilter !== 'All' ? selectedSkillFilter : undefined,
        limit: 100,
      })
      .then((data) => {
        if (!cancelled) setFreelancers(data);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setFreelancers([]);
          setDirectoryError(error instanceof Error ? error.message : 'Unable to load the freelancer directory.');
        }
      })
      .finally(() => {
        if (!cancelled) setDirectoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [freelancerSearch, selectedSkillFilter]);

  const totalBudget = currentProject ? currentProject.budget : 0;
  const totalPaid = currentProject ? currentProject.totalPaidSoFar : 0;
  const remaining = Math.max(0, totalBudget - totalPaid);

  const countPaid = useCountUp(totalPaid, { duration: 1000 });
  const countRemaining = useCountUp(remaining, { duration: 1000 });

  // Collect unique skills for directory filter
  const allSkills = useMemo(() => {
    const set = new Set<string>();
    freelancers.forEach((f) => (f.skills || []).forEach((s) => set.add(s)));
    const options = ['All', ...Array.from(set)];
    return options.includes(selectedSkillFilter) ? options : [...options, selectedSkillFilter];
  }, [freelancers, selectedSkillFilter]);

  const filteredFreelancers = freelancers;

  const pendingReviewInfo = useMemo(() => {
    if (currentProject) {
      const milestone = currentProject.milestones?.find(
        (m) => m.status === 'submitted' || m.status === 'under_review'
      );
      if (milestone) return { project: currentProject, milestone };
    }
    for (const p of clientProjects) {
      const milestone = p.milestones?.find(
        (m) => m.status === 'submitted' || m.status === 'under_review'
      );
      if (milestone) return { project: p, milestone };
    }
    return null;
  }, [currentProject, clientProjects]);

  const underReviewMilestone = pendingReviewInfo?.milestone;
  const reviewProjectId = pendingReviewInfo?.project.id || currentProject?.id;

  return (
    <div className="min-h-screen w-full flex flex-col bg-paper text-deepBlue font-sans">
      <ClientHeader
        title={`Welcome back, ${user?.organization || user?.name || 'your team'}`}
        subtitle="Review active milestone deliverables, manage project budgets, and invite verified independent specialists."
        dateLine="Client Flight Control"
      >
        {/* Top actions & summary bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#FDFBF7]/15">
          <div className="text-[14px] text-[#FDFBF7]/90">
            {underReviewMilestone ? (
              <span>
                <strong>Action needed:</strong> A deliverable is waiting on your review.
              </span>
            ) : (
              <span>All active deliverables are running according to project schedules.</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => navigate('/client/projects/new')}
            className="min-h-[42px] px-5 py-2 rounded-lg bg-paper text-deepBlue font-semibold text-[14px] hover:bg-[#EAE4D6] transition-colors cursor-pointer"
          >
            + Create project
          </button>
        </div>
      </ClientHeader>

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-8 py-10 sm:py-14 space-y-12">
        {/* Section 1: Current Project Spotlight */}
        {currentProject && (
          <section className="space-y-4">
            <div className="flex items-baseline justify-between border-b border-[#003C5F]/15 pb-3">
              <h2 className="font-display text-2xl sm:text-3xl text-deepBlue">Current project</h2>
              <span className="text-[13px] text-[#455A6A] font-medium">
                Contract #{currentProject.id}
              </span>
            </div>

            <div className="bg-paper border border-[#003C5F]/15 rounded-xl p-6 sm:p-7 space-y-6 hover:border-[#003C5F]/30 transition-all">
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 border-b border-[#003C5F]/10 pb-4">
                <div>
                  <span className="text-[13px] uppercase tracking-wider text-[#455A6A] font-medium block">
                    Active commitment
                  </span>
                  <h3 className="text-xl sm:text-2xl font-bold text-deepBlue mt-0.5">
                    {currentProject.title}
                  </h3>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {spotlightInfo?.is_spotlight_active && spotlightInfo.purchase ? (
                    <SpotlightBadge
                      remainingSeconds={spotlightInfo.purchase.remaining_seconds}
                      expiresAt={spotlightInfo.purchase.expires_at}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowSpotlightModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#F59E0B]/40 bg-[#FFFBEB] text-[#92400E] text-[12px] font-semibold hover:bg-[#FEF3C7] transition-colors cursor-pointer shadow-sm"
                    >
                      <span>✨</span> Boost with Spotlight
                    </button>
                  )}
                  <StatusPill status={currentProject.status === 'in_review' ? 'under_review' : 'active'} />
                  <Link
                    to={`/client/projects/${currentProject.id}`}
                    className="min-h-[38px] px-4 py-1.5 bg-deepBlue text-paper rounded-lg text-[13px] font-semibold hover:bg-[#002E4A] transition-colors"
                  >
                    Open project workspace &rarr;
                  </Link>
                </div>
              </div>

              {/* Freelancer & Financial details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-[14px]">
                {currentProject.assignedFreelancer ? (
                  <div className="space-y-1">
                    <span className="text-[13px] text-[#455A6A] block">Assigned specialist</span>
                    <div className="flex items-center gap-2.5 pt-1">
                      <div className="w-8 h-8 rounded-full bg-[#003C5F]/10 text-deepBlue flex items-center justify-center font-bold text-xs">
                        {currentProject.assignedFreelancer.avatarText}
                      </div>
                      <div>
                        <p className="font-semibold text-deepBlue leading-none">
                          {currentProject.assignedFreelancer.name}
                        </p>
                        <p className="text-[13px] text-[#455A6A] mt-0.5">
                          {currentProject.assignedFreelancer.rate}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <span className="text-[13px] text-[#455A6A] block">Specialist</span>
                    <p className="text-deepBlue font-medium">Yet to be assigned</p>
                  </div>
                )}

                <div>
                  {/* "totalPaidSoFar" reflects accepted (client-approved) milestone value.
                      Actual payment disbursement via PayPal Sandbox is a later phase. */}
                  <span className="text-[13px] text-[#455A6A] block">Approved value</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="font-display text-2xl text-deepBlue font-bold">
                      ${countPaid.toLocaleString()}
                    </span>
                    <span className="text-[13px] text-[#455A6A]">
                      {totalBudget > 0 ? `/ $${totalBudget.toLocaleString()}` : '/ Budget pending'}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[13px] text-[#455A6A] block">Remaining balance</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="font-display text-2xl text-[#874E0E] font-bold">
                      ${countRemaining.toLocaleString()}
                    </span>
                    <span className="text-[13px] text-[#455A6A]">allocated to milestones</span>
                  </div>
                </div>
              </div>

              {/* Submitted Milestone Alert if any */}
              {underReviewMilestone && (
                <div className="p-4 rounded-xl bg-[#FAF3E7] border border-[#E8D2AC] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[13px]">
                  <div className="space-y-0.5">
                    <p className="font-semibold text-[#874E0E]">
                      Milestone {underReviewMilestone.number ?? 1}: {underReviewMilestone.title} has submitted work.
                    </p>
                    <p className="text-[#455A6A]">
                      {underReviewMilestone.submittedAt
                        ? `Submitted on ${underReviewMilestone.submittedAt}. `
                        : 'A deliverable has been submitted for this milestone. '}Review deliverables and advisory AI check on the project page.
                    </p>
                  </div>
                  <Link
                    to={`/client/projects/${reviewProjectId}`}
                    className="min-h-[38px] px-4 py-1.5 bg-[#874E0E] text-white rounded-lg font-medium hover:bg-[#6E3F0B] transition-colors shrink-0 text-center"
                  >
                    Review submission
                  </Link>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Section: Incoming Freelancer Project Requests */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-[#003C5F]/15 pb-3">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="font-display text-2xl sm:text-3xl text-deepBlue">Freelancer project requests</h2>
                {incomingRequests.filter((r) => r.status === 'pending').length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-[#874E0E] text-white text-xs font-bold">
                    {incomingRequests.filter((r) => r.status === 'pending').length} pending
                  </span>
                )}
              </div>
              <p className="text-[15px] text-[#455A6A] mt-1">
                Specialists who have reviewed your open project briefs and requested to take on the work.
              </p>
            </div>
            <span className="text-[13px] text-[#455A6A] font-medium">
              {incomingRequests.length} total request{incomingRequests.length === 1 ? '' : 's'}
            </span>
          </div>

          {requestMessage && (
            <div role="status" className="p-4 text-sm text-[#24543A] bg-[#EAF5EF] rounded-xl border border-[#B2DAC3]">
              {requestMessage}
            </div>
          )}

          {requestsLoading ? (
            <div className="p-8 text-center text-[#455A6A] bg-[#F6F3EC] rounded-xl border border-[#003C5F]/10">
              Loading requests…
            </div>
          ) : incomingRequests.length === 0 ? (
            <div className="p-6 sm:p-8 text-center text-[#455A6A] bg-[#F6F3EC] rounded-xl border border-[#003C5F]/10">
              <p className="font-semibold text-deepBlue text-[15px]">No incoming project requests yet</p>
              <p className="text-[13px] text-[#455A6A] mt-1">
                When specialists view your open briefs in the marketplace and request to work on them, their details and applications will appear here for review.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {incomingRequests.map((req) => {
                const isActioning = requestActionLoadingId === req.id;
                return (
                  <article
                    key={req.id}
                    className="bg-paper border border-[#003C5F]/15 rounded-xl p-5 sm:p-6 space-y-4 hover:border-[#003C5F]/30 transition-all shadow-xs"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#003C5F]/10 pb-4">
                      {/* Specialist Info */}
                      <div className="flex items-start gap-3.5">
                        <div className="w-10 h-10 rounded-full bg-[#003C5F]/10 text-deepBlue flex items-center justify-center font-bold text-sm shrink-0">
                          {req.freelancer?.avatarText || 'FL'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-deepBlue text-base leading-tight">
                              {req.freelancer?.name || 'Specialist'}
                            </h3>
                            {req.freelancer?.rating ? (
                              <span className="text-[12px] font-semibold text-[#874E0E] bg-[#FAF3E7] px-2 py-0.5 rounded border border-[#E8D2AC]">
                                ★ {Number(req.freelancer.rating).toFixed(1)}
                              </span>
                            ) : null}
                          </div>
                          <p className="text-[13px] text-[#455A6A] mt-0.5">
                            {req.freelancer?.headline || 'Independent Specialist'}
                          </p>
                          {req.freelancer?.skills && req.freelancer.skills.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {req.freelancer.skills.slice(0, 5).map((skill) => (
                                <span
                                  key={skill}
                                  className="text-[11px] px-2 py-0.5 rounded bg-[#F2EDE2] text-deepBlue border border-[#003C5F]/10 font-medium"
                                >
                                  {skill}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Project Context & Status */}
                      <div className="md:text-right space-y-1">
                        <span className="text-[12px] uppercase tracking-wider text-[#455A6A] font-medium block">
                          Target project brief
                        </span>
                        <Link
                          to={`/client/projects/${req.project_id}`}
                          className="font-semibold text-deepBlue hover:underline text-[15px] block"
                        >
                          {req.project?.title || 'Project Brief'} &rarr;
                        </Link>
                        <span className="text-[13px] text-[#455A6A] block">
                          Budget: ${Number(req.project?.budget_max || req.project?.budget_min || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {req.message && (
                      <p className="text-[14px] text-[#455A6A] bg-[#FAF8F3] p-3 rounded-lg border border-[#003C5F]/10 italic">
                        &ldquo;{req.message}&rdquo;
                      </p>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                      <div className="text-[12px] text-[#455A6A]">
                        Requested on {new Date(req.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>

                      <div className="flex items-center gap-3">
                        {req.status === 'pending' ? (
                          <>
                            <button
                              type="button"
                              disabled={isActioning}
                              onClick={() => handleDeclineRequest(req.id)}
                              className="px-4 py-1.5 rounded-lg border border-[#003C5F]/20 bg-paper text-deepBlue text-[13px] font-medium hover:bg-[#FAF3E7] transition-colors cursor-pointer disabled:opacity-50"
                            >
                              Decline
                            </button>
                            <button
                              type="button"
                              disabled={isActioning}
                              onClick={() => handleAcceptRequest(req.id)}
                              className="px-5 py-1.5 rounded-lg bg-deepBlue text-paper text-[13px] font-semibold hover:bg-[#002E4A] transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {isActioning ? 'Processing…' : 'Accept request'}
                            </button>
                          </>
                        ) : req.status === 'accepted' ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#EAF5EF] text-[#24543A] border border-[#B2DAC3] text-[13px] font-semibold">
                            ✓ Accepted &middot; Invitation sent
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-lg bg-[#F1F5F9] text-[#64748B] border border-[#CBD5E1] text-[13px] font-medium">
                            Declined
                          </span>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Section 2: AG Grid of Freelancers */}
        <section className="space-y-6">
          {!currentProject && (
            <p role="status" className="p-4 text-sm text-[#455A6A] bg-[#F6F3EC] rounded-xl border border-[#003C5F]/10">
              Create and save a project before inviting a freelancer.
            </p>
          )}
          {inviteMessage && <p role="status" className="p-4 text-sm text-[#24543A] bg-[#EAF5EF] rounded-xl border border-[#B2DAC3]">{inviteMessage}</p>}
          {projectError && <p role="alert" className="p-4 text-sm text-[#874E0E] bg-[#FAF3E7] rounded-xl border border-[#E8D2AC]">{projectError}</p>}
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 border-b border-[#003C5F]/15 pb-3">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl text-deepBlue">Freelancer directory</h2>
              <p className="text-[15px] text-[#455A6A] mt-1">
                Browse available independent professionals and send project invitations.
              </p>
            </div>
            <span className="text-[13px] text-[#455A6A] font-medium">
              Showing {filteredFreelancers.length} of {freelancers.length} specialists
            </span>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#F6F3EC] p-3.5 sm:p-4 rounded-xl border border-[#003C5F]/10">
            <div className="relative flex-1 min-w-[240px]">
              <label htmlFor="freelancer-search" className="sr-only">
                Search specialists
              </label>
              <input
                id="freelancer-search"
                type="text"
                value={freelancerSearch}
                onChange={(e) => setFreelancerSearch(e.target.value)}
                placeholder="Search by specialist name, title, or skills..."
                className="w-full min-h-[42px] px-4 py-2 bg-paper text-deepBlue border border-[#003C5F]/20 rounded-lg text-[15px] placeholder:text-[#455A6A]/70 focus-visible:ring-2 focus-visible:ring-deepBlue focus-visible:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="skill-filter" className="text-[13px] text-[#455A6A] font-medium shrink-0">
                Filter skill:
              </label>
              <select
                id="skill-filter"
                value={selectedSkillFilter}
                onChange={(e) => setSelectedSkillFilter(e.target.value)}
                className="min-h-[40px] px-3 py-1.5 bg-paper text-deepBlue border border-[#003C5F]/20 rounded-lg text-[14px] font-medium focus-visible:ring-2 focus-visible:ring-deepBlue cursor-pointer"
              >
                {allSkills.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {directoryLoading ? (
            <div role="status" className="p-8 text-center text-[#455A6A] bg-[#F6F3EC] rounded-xl border border-[#003C5F]/10">
              Loading freelancer directory…
            </div>
          ) : directoryError ? (
            <div role="alert" className="p-8 text-center text-[#874E0E] bg-[#FAF3E7] rounded-xl border border-[#E8D2AC]">
              {directoryError}
            </div>
          ) : (
            <>
          {/* Desktop Table (AG Grid theme) */}
          <div className="hidden lg:block overflow-x-auto border border-[#003C5F]/15 rounded-xl bg-paper">
            <table className="w-full text-left border-collapse" aria-label="Freelancer Directory Table">
              <thead>
                <tr className="border-b border-[#003C5F]/15 bg-[#F6F3EC] text-[13px] uppercase tracking-wider text-[#455A6A] font-semibold">
                  <th scope="col" className="py-3.5 px-5">Name</th>
                  <th scope="col" className="py-3.5 px-5">Headline</th>
                  <th scope="col" className="py-3.5 px-5">Skills</th>
                  <th scope="col" className="py-3.5 px-5">Availability</th>
                  <th scope="col" className="py-3.5 px-5">Rate</th>
                  <th scope="col" className="py-3.5 px-5">Client rating</th>
                  <th scope="col" className="py-3.5 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#003C5F]/10 text-[15px]">
                {filteredFreelancers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 px-5 text-center text-[#455A6A]">
                      No specialists match your search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredFreelancers.map((f) => (
                    <tr
                      key={f.id}
                      className="hover:bg-[#F8F5EE] transition-colors focus-within:bg-[#F8F5EE]"
                    >
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#003C5F]/10 text-deepBlue flex items-center justify-center font-bold text-xs shrink-0">
                            {f.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <p className="font-semibold text-deepBlue">{f.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-5 text-[13px] text-[#455A6A]">{f.headline}</td>
                      <td className="py-4 px-5">
                        <div className="flex flex-wrap gap-1.5 max-w-[260px]">
                          {f.skills.slice(0, 3).map((skill) => (
                            <span
                              key={skill}
                              className="text-[13px] px-2 py-0.5 rounded bg-[#F2EDE2] text-deepBlue border border-[#003C5F]/10"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-4 px-5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[13px] font-medium border ${availabilityClasses(f.availability_status)}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${f.availability_status === 'available' ? 'bg-[#2E6B4A]' : f.availability_status === 'limited' ? 'bg-[#A86315]' : 'bg-[#94A3B8]'}`}
                          />
                          {availabilityLabel(f.availability_status)}
                        </span>
                      </td>
                      <td className="py-4 px-5 font-display text-lg text-deepBlue whitespace-nowrap">
                        {f.hourly_rate === null ? 'Rate on request' : `$${f.hourly_rate}/hr`}
                      </td>
                      <td className="py-4 px-5 whitespace-nowrap">
                        <span className="font-semibold text-deepBlue text-[14px]">
                          {f.rating === null ? 'No ratings yet' : f.rating.toFixed(2)}
                        </span>
                        <span className="text-[13px] text-[#455A6A] ml-1">
                          {f.rating === null ? '' : `(${f.completed_projects} projects)`}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => inviteFreelancer(f.id, f.name)}
                          disabled={!currentProject || invitingFreelancerId !== null}
                          title={!currentProject ? 'Create and save a project before inviting a freelancer.' : undefined}
                          className="min-h-[38px] px-4 py-1.5 bg-deepBlue text-paper rounded-lg text-[13px] font-semibold hover:bg-[#002E4A] transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {invitingFreelancerId === f.id ? 'Inviting…' : 'Invite'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-4">
            {filteredFreelancers.length === 0 ? (
              <div className="p-8 text-center text-[#455A6A] bg-[#F6F3EC] rounded-xl border border-[#003C5F]/10">
                No specialists match your search criteria.
              </div>
            ) : (
              filteredFreelancers.map((f) => (
                <article
                  key={f.id}
                  className="bg-paper border border-[#003C5F]/15 rounded-xl p-5 space-y-3.5"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-[#003C5F]/10 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#003C5F]/10 text-deepBlue flex items-center justify-center font-bold text-xs">
                        {f.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-deepBlue">{f.name}</h3>
                        <p className="text-[13px] text-[#455A6A]">{f.headline}</p>
                      </div>
                    </div>
                    <span className="font-display text-lg text-deepBlue whitespace-nowrap">
                      {f.hourly_rate === null ? 'Rate on request' : `$${f.hourly_rate}/hr`}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {f.skills.map((s) => (
                      <span
                        key={s}
                        className="text-[13px] px-2 py-0.5 rounded bg-[#F2EDE2] text-deepBlue border border-[#003C5F]/10"
                      >
                        {s}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#003C5F]/10 text-[13px]">
                    <span className="text-[#455A6A]">
                      Rating: <strong>{f.rating === null ? 'No ratings yet' : f.rating.toFixed(2)}</strong>{f.rating === null ? '' : ` (${f.completed_projects} projects)`}
                    </span>
                    <button
                      type="button"
                      onClick={() => inviteFreelancer(f.id, f.name)}
                      disabled={!currentProject || invitingFreelancerId !== null}
                      title={!currentProject ? 'Create and save a project before inviting a freelancer.' : undefined}
                      className="min-h-[38px] px-4 py-1.5 bg-deepBlue text-paper rounded-lg font-medium hover:bg-[#002E4A] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {invitingFreelancerId === f.id ? 'Inviting…' : 'Invite'}
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
            </>
          )}
        </section>
      </main>

      {currentProject && (
        <SpotlightModal
          isOpen={showSpotlightModal}
          onClose={() => setShowSpotlightModal(false)}
          onSuccess={(purchase) => {
            setSpotlightInfo({
              target_type: 'project',
              target_id: currentProject.id,
              is_spotlight_active: true,
              purchase,
            });
          }}
          targetType="project"
          targetId={currentProject.id}
          targetTitle={currentProject.title}
        />
      )}

      <Toast />
    </div>
  );
};
