import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FreelancerHeader } from '../shared/FreelancerHeader';
import { Toast } from '../shared/Toast';
import { useCountUp } from '../../hooks/useCountUp';
import { useReveal } from '../../hooks/useReveal';
import { projectService } from '../../services/projectService';
import type { JourneyEntry } from '../../types/freelancer';

export const JourneyPage: React.FC = () => {
  const [journeyEntries, setJourneyEntries] = useState<JourneyEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const { ref: timelineRef, isRevealed: timelineRevealed } = useReveal({ threshold: 0.1 });

  const loadJourney = () => {
    setIsLoading(true);
    setLoadError('');
    projectService
      .journey()
      .then(({ projects, reviews }) => {
        const byProject = new Map(projects.map((project) => [project.id, project]));
        const entries: JourneyEntry[] = reviews.map((review) => {
          const project = byProject.get(review.project_id);
          const clientName =
            review.client_organization ||
            review.client_name ||
            project?.client_organization ||
            project?.client_name ||
            'Client Partner';
          const projectTitle = project?.title || 'Deliverable Project';
          const milestoneTitle =
            review.milestone_title ||
            project?.milestones?.find((m) => m.id === review.milestone_id)?.title ||
            'Completed Deliverable';
          const startDate = project?.created_at?.slice(0, 10) || review.created_at.slice(0, 10);
          const completedDate = review.created_at.slice(0, 10);
          // Only confirmed server-captured payments contribute to monetary value
          const confirmedPaid = Number(review.paid_amount ?? 0);
          const milestoneValue = Number(review.milestone_amount ?? 0);

          return {
            id: review.id,
            projectId: review.project_id,
            client: clientName,
            projectTitle,
            milestoneTitle,
            startDate,
            completedDate,
            amount: confirmedPaid,
            milestoneAmount: milestoneValue,
            isPaid: Boolean(review.is_paid),
            status: review.milestone_status || 'accepted',
            rating: (review.final_score ?? review.client_score ?? 0) / 20,
            feedback: review.feedback || 'Milestone deliverable accepted and approved.',
          };
        });
        setJourneyEntries(entries);
      })
      .catch((error) => {
        setLoadError(error instanceof Error ? error.message : 'Unable to load journey.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    document.title = 'PayPilot AI — Freelancer Journey';
    loadJourney();
  }, []);

  // Distinct completed projects count
  const completedProjectIds = new Set(journeyEntries.map((e) => e.projectId));
  const totalEarned = journeyEntries.reduce((acc, curr) => acc + curr.amount, 0);
  const avgRating =
    journeyEntries.length > 0
      ? journeyEntries.reduce((acc, curr) => acc + curr.rating, 0) / journeyEntries.length
      : 0;

  const countProjects = useCountUp(completedProjectIds.size, { duration: 1000 });
  const countEarned = useCountUp(totalEarned, { duration: 1200 });
  const countRating = useCountUp(avgRating, { duration: 800, decimals: 2 });

  return (
    <div className="min-h-screen w-full flex flex-col bg-paper text-deepBlue font-sans">
      <FreelancerHeader
        title="Your journey"
        subtitle="Historical milestone completions, client reviews, and cumulative payouts."
        dateLine="Milestone Track Record"
      >
        {/* Summary Line */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 max-w-[800px]">
          <div className="p-4 rounded-xl bg-[#FDFBF7]/10 border border-[#FDFBF7]/20">
            <span className="text-[13px] uppercase tracking-wider text-[#FDFBF7]/70 font-medium block mb-1">
              Projects completed
            </span>
            <span className="font-display text-4xl text-white">
              {isLoading ? '—' : countProjects}
            </span>
            <span className="text-[13px] text-[#FDFBF7]/60 block mt-1">Full delivery cycle</span>
          </div>

          <div className="p-4 rounded-xl bg-[#FDFBF7]/10 border border-[#FDFBF7]/20">
            <span className="text-[13px] uppercase tracking-wider text-[#FDFBF7]/70 font-medium block mb-1">
              Total earned
            </span>
            <div className="flex items-baseline gap-1">
              <span className="font-display text-4xl text-white">
                ${isLoading ? '0' : countEarned.toLocaleString()}
              </span>
            </div>
            <span className="text-[13px] text-[#FDFBF7]/60 block mt-1">Disbursed via Sandbox</span>
          </div>

          <div className="p-4 rounded-xl bg-[#FDFBF7]/10 border border-[#FDFBF7]/20">
            <span className="text-[13px] uppercase tracking-wider text-[#FDFBF7]/70 font-medium block mb-1">
              Average client rating
            </span>
            <div className="flex items-baseline gap-1">
              <span className="font-display text-4xl text-white">
                {journeyEntries.length && !isLoading ? countRating : '—'}
              </span>
              {journeyEntries.length > 0 && <span className="text-sm text-[#FDFBF7]/70">/ 5.0</span>}
            </div>
            <span className="text-[13px] text-[#FDFBF7]/60 block mt-1">
              {journeyEntries.length ? 'Across all reviews' : 'No client ratings yet'}
            </span>
          </div>
        </div>
      </FreelancerHeader>

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-8 py-10 sm:py-14">
        {loadError && (
          <div role="alert" className="mb-6 p-4 rounded-xl bg-[#FAF3E7] border border-[#E8D2AC] flex items-center justify-between">
            <span className="text-sm text-[#874E0E]">{loadError}</span>
            <button
              type="button"
              onClick={loadJourney}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#874E0E] text-white hover:bg-[#6D3F0B]"
            >
              Retry
            </button>
          </div>
        )}

        <section className="space-y-6">
          <div className="border-b border-[#003C5F]/15 pb-4">
            <h2 className="font-display text-3xl text-deepBlue">Delivery timeline</h2>
            <p className="text-[15px] text-[#455A6A] mt-1">
              Chronological log of completed deliverables and client sign-offs.
            </p>
          </div>

          {isLoading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-[#003C5F] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-[#455A6A]">Loading your delivery history...</p>
            </div>
          ) : journeyEntries.length === 0 ? (
            <div className="bg-paper border border-[#003C5F]/15 rounded-xl p-16 text-center space-y-4 my-8">
              <svg
                className="w-12 h-12 text-[#003C5F]/25 mx-auto"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="font-display text-2xl text-deepBlue">No completed milestones yet</h3>
              <p className="text-[#455A6A] text-sm max-w-md mx-auto leading-relaxed">
                As you accept project invitations, deliver milestones, and receive client ratings, your
                delivery record and confirmed earnings will appear here.
              </p>
              <div className="pt-2">
                <Link
                  to="/freelancer/projects"
                  className="inline-flex px-5 py-2.5 rounded-lg bg-[#003C5F] text-[#FDFBF7] text-sm font-semibold hover:bg-[#002B45] transition-colors"
                >
                  Browse Projects
                </Link>
              </div>
            </div>
          ) : (
            /* Vertical Timeline */
            <div ref={timelineRef} className="relative pl-6 sm:pl-8 space-y-8 my-8">
              {/* Drawing Line */}
              <div
                className="absolute left-2.5 sm:left-3.5 top-2 bottom-2 w-0.5 bg-[#003C5F]/20 transition-all duration-1000 origin-top"
                style={{
                  transform: timelineRevealed ? 'scaleY(1)' : 'scaleY(0)',
                }}
                aria-hidden="true"
              />

              {journeyEntries.map((entry, idx) => (
                <div
                  key={entry.id}
                  className="relative group transition-opacity duration-500"
                  style={{
                    transitionDelay: `${idx * 150}ms`,
                    opacity: timelineRevealed ? 1 : 0,
                    transform: timelineRevealed ? 'translateY(0)' : 'translateY(16px)',
                  }}
                >
                  {/* Node icon / marker */}
                  <div
                    className="absolute -left-6 sm:-left-8 top-1.5 w-5 h-5 rounded-full bg-paper border-2 border-[#003C5F] flex items-center justify-center"
                    aria-hidden="true"
                  >
                    <span className="w-2 h-2 rounded-full bg-[#003C5F]" />
                  </div>

                  <div className="bg-paper border border-[#003C5F]/15 rounded-xl p-5 sm:p-6 transition-all hover:border-[#003C5F]/35">
                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-[#003C5F]/10 pb-3 mb-3">
                      <div>
                        <span className="text-[13px] uppercase tracking-wider text-[#455A6A] font-medium">
                          {entry.client}
                        </span>
                        <h3 className="text-lg sm:text-xl font-semibold text-deepBlue mt-0.5">
                          {entry.projectTitle}
                        </h3>
                        {entry.milestoneTitle && (
                          <p className="text-xs text-[#003C5F] font-medium mt-0.5">
                            Milestone: {entry.milestoneTitle}
                          </p>
                        )}
                      </div>

                      <div className="text-left sm:text-right shrink-0">
                        {entry.isPaid ? (
                          <>
                            <span className="font-display text-2xl text-[#24543A]">
                              ${entry.amount.toLocaleString()}
                            </span>
                            <span className="text-[12px] font-semibold text-[#24543A] block">
                              Paid (Sandbox)
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="font-display text-2xl text-[#874E0E]">
                              ${(entry.milestoneAmount ?? 0).toLocaleString()}
                            </span>
                            <span className="text-[12px] font-semibold text-[#874E0E] block">
                              Approved &middot; Awaiting Settlement
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[13px] text-[#455A6A] mb-3">
                      <div>
                        <span className="font-medium text-deepBlue">Engagement period:</span>{' '}
                        {entry.startDate} &ndash; {entry.completedDate}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-deepBlue">Client rating:</span>
                        <span className="font-display text-base text-deepBlue font-semibold">
                          {entry.rating.toFixed(1)} / 5.0
                        </span>
                      </div>
                    </div>

                    <blockquote className="text-[14px] italic text-deepBlue/90 pl-3 border-l-2 border-[#003C5F]/30 bg-[#F6F3EC]/60 py-2.5 rounded-r">
                      &ldquo;{entry.feedback}&rdquo;
                    </blockquote>

                    <div className="mt-4 pt-3 border-t border-[#003C5F]/10 flex items-center justify-between">
                      <span className="text-xs text-[#455A6A]">
                        Status: <span className="capitalize font-medium text-deepBlue">{entry.status}</span>
                      </span>
                      <Link
                        to={`/freelancer/projects/${entry.projectId}`}
                        className="text-[13px] font-medium text-deepBlue hover:underline flex items-center gap-1"
                      >
                        View project workspace &rarr;
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <Toast />
    </div>
  );
};
