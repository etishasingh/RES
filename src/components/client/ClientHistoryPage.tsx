import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClientHeader } from '../shared/ClientHeader';
import { projectService } from '../../services/projectService';
import { useReveal } from '../../hooks/useReveal';
import type { ClientHistoryItem } from '../../types/client';

const STAR_ICONS = (rating: number) => {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return { full, half, empty: Math.max(0, 5 - full - (half ? 1 : 0)) };
};

const getInitials = (name: string): string => {
  if (!name) return 'FL';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || 'FL';
};

export const ClientHistoryPage: React.FC = () => {
  const [clientHistory, setClientHistory] = useState<ClientHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const { ref: pageRef } = useReveal<HTMLDivElement>();

  const loadHistory = () => {
    setIsLoading(true);
    setLoadError('');
    projectService
      .journey()
      .then(({ projects, reviews }) => {
        const byProject = new Map(projects.map((project) => [project.id, project]));
        const items: ClientHistoryItem[] = reviews.map((review) => {
          const project = byProject.get(review.project_id);
          const freelancerName =
            review.freelancer_name || project?.freelancer_name || 'Specialist Talent';
          const freelancerAvatar = getInitials(freelancerName);
          const startDate = project?.created_at?.slice(0, 10) || review.created_at.slice(0, 10);
          const completedDate = review.created_at.slice(0, 10);
          const confirmedPaid = Number(review.paid_amount ?? 0);
          const milestoneAmount = Number(review.milestone_amount ?? 0);

          return {
            id: review.id,
            projectId: review.project_id,
            title: project?.title || review.milestone_title || 'Project Engagement',
            milestoneTitle: review.milestone_title || undefined,
            freelancerName,
            freelancerAvatar,
            startDate,
            completedDate,
            totalPaid: confirmedPaid,
            milestoneAmount,
            isPaid: Boolean(review.is_paid),
            status: review.milestone_status || 'completed',
            ratingGiven: (review.final_score ?? review.client_score ?? 0) / 20,
            feedbackSummary: review.feedback || 'Milestone deliverable reviewed and accepted.',
          };
        });
        setClientHistory(items);
      })
      .catch((error) => {
        setLoadError(error instanceof Error ? error.message : 'Unable to load project history.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    document.title = 'PayPilot AI — Project History';
    loadHistory();
  }, []);

  // Financial rule: only confirmed payments contribute to totalPaidAllTime
  const totalPaidAllTime = clientHistory.reduce((sum, h) => sum + h.totalPaid, 0);
  const avgRating =
    clientHistory.length > 0
      ? clientHistory.reduce((sum, h) => sum + h.ratingGiven, 0) / clientHistory.length
      : 0;

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#1E293B]">
      <ClientHeader
        breadcrumbs={[
          { label: 'Dashboard', path: '/client/dashboard' },
          { label: 'History' },
        ]}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div ref={pageRef} className="space-y-8">
          {/* Page Header */}
          <div className="border-b border-[#003C5F]/15 pb-6">
            <span className="text-[13px] font-semibold text-[#003C5F] tracking-wide uppercase">
              Completed Engagements
            </span>
            <h1 className="font-display text-3xl sm:text-4xl text-deepBlue mt-1">
              Project History
            </h1>
            <p className="text-[#455A6A] text-sm mt-2 max-w-2xl leading-relaxed">
              A record of all your completed project engagements, including ratings you provided
              and total amounts settled through PayPal Sandbox.
            </p>
          </div>

          {loadError && (
            <div role="alert" className="p-4 rounded-xl bg-[#FAF3E7] border border-[#E8D2AC] flex items-center justify-between">
              <span className="text-sm text-[#874E0E]">{loadError}</span>
              <button
                type="button"
                onClick={loadHistory}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#874E0E] text-white hover:bg-[#6D3F0B]"
              >
                Retry
              </button>
            </div>
          )}

          {/* Summary strip */}
          {!isLoading && clientHistory.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="bg-paper border border-[#003C5F]/15 rounded-xl p-5">
                <div className="text-[13px] text-[#455A6A] mb-1">Engagements Completed</div>
                <div className="font-display text-3xl text-deepBlue">{clientHistory.length}</div>
              </div>
              <div className="bg-paper border border-[#003C5F]/15 rounded-xl p-5">
                <div className="text-[13px] text-[#455A6A] mb-1">Total Paid (Sandbox)</div>
                <div className="font-display text-3xl text-deepBlue">
                  ${totalPaidAllTime.toLocaleString()}
                </div>
              </div>
              <div className="bg-paper border border-[#003C5F]/15 rounded-xl p-5 col-span-2 sm:col-span-1">
                <div className="text-[13px] text-[#455A6A] mb-1">Average Rating Given</div>
                <div className="font-display text-3xl text-deepBlue">
                  {avgRating.toFixed(1)} / 5
                </div>
              </div>
            </div>
          )}

          {/* History Content */}
          {isLoading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-[#003C5F] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-[#455A6A]">Loading engagement history...</p>
            </div>
          ) : clientHistory.length === 0 ? (
            <div className="bg-paper border border-[#003C5F]/15 rounded-xl p-16 text-center space-y-3">
              <svg
                className="w-10 h-10 text-[#003C5F]/25 mx-auto"
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
              <h2 className="font-display text-2xl text-deepBlue">No completed projects yet</h2>
              <p className="text-[#455A6A] text-sm max-w-md mx-auto">
                Completed projects will appear here. Start by creating a new project on your dashboard.
              </p>
              <div className="pt-2">
                <Link
                  to="/client/dashboard"
                  className="inline-flex px-5 py-2.5 rounded-lg bg-[#003C5F] text-[#FDFBF7] text-sm font-semibold hover:bg-[#002B45] transition-colors"
                >
                  Go to Dashboard
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-paper border border-[#003C5F]/15 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" aria-label="Completed projects history">
                  <thead>
                    <tr className="border-b border-[#003C5F]/10 bg-[#F4EFE6]/50">
                      <th
                        scope="col"
                        className="text-left px-5 py-3.5 text-[13px] font-semibold text-deepBlue"
                      >
                        Project & Milestone
                      </th>
                      <th
                        scope="col"
                        className="text-left px-4 py-3.5 text-[13px] font-semibold text-deepBlue"
                      >
                        Talent
                      </th>
                      <th
                        scope="col"
                        className="text-left px-4 py-3.5 text-[13px] font-semibold text-deepBlue whitespace-nowrap"
                      >
                        Dates
                      </th>
                      <th
                        scope="col"
                        className="text-right px-4 py-3.5 text-[13px] font-semibold text-deepBlue whitespace-nowrap"
                      >
                        Settlement
                      </th>
                      <th
                        scope="col"
                        className="text-left px-4 py-3.5 text-[13px] font-semibold text-deepBlue"
                      >
                        Your Rating
                      </th>
                      <th
                        scope="col"
                        className="text-left px-4 py-3.5 text-[13px] font-semibold text-deepBlue"
                      >
                        Summary
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientHistory.map((item, idx) => {
                      const stars = STAR_ICONS(item.ratingGiven);
                      return (
                        <tr
                          key={item.id}
                          className={`border-b border-[#003C5F]/8 hover:bg-[#003C5F]/3 transition-colors ${
                            idx % 2 === 1 ? 'bg-[#FDFBF7]' : 'bg-white/60'
                          }`}
                        >
                          <td className="px-5 py-4">
                            <Link
                              to={`/client/projects/${item.projectId}`}
                              className="font-semibold text-deepBlue hover:underline underline-offset-2 text-sm block"
                            >
                              {item.title}
                            </Link>
                            {item.milestoneTitle && (
                              <span className="text-xs text-[#455A6A] mt-0.5 block">
                                Milestone: {item.milestoneTitle}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-[#003C5F] text-[#FDFBF7] flex items-center justify-center text-xs font-bold flex-shrink-0">
                                {item.freelancerAvatar}
                              </div>
                              <span className="text-[#1E293B] font-medium whitespace-nowrap">
                                {item.freelancerName}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-[13px] text-[#455A6A]">
                              <div>{item.startDate}</div>
                              <div className="text-[#2E6B4A] font-medium">{item.completedDate}</div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right">
                            {item.isPaid ? (
                              <div>
                                <span className="font-display text-base text-[#24543A] font-semibold whitespace-nowrap">
                                  ${item.totalPaid.toLocaleString()}
                                </span>
                                <span className="text-[11px] block font-semibold text-[#24543A]">
                                  Paid (Sandbox)
                                </span>
                              </div>
                            ) : (
                              <div>
                                <span className="font-display text-base text-[#874E0E] font-semibold whitespace-nowrap">
                                  ${(item.milestoneAmount ?? 0).toLocaleString()}
                                </span>
                                <span className="text-[11px] block font-semibold text-[#874E0E]">
                                  Approved &middot; Unpaid
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-0.5" aria-label={`Rating: ${item.ratingGiven} out of 5`}>
                              {Array.from({ length: stars.full }).map((_, i) => (
                                <svg
                                  key={`f${i}`}
                                  className="w-4 h-4 text-[#A86315]"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                  aria-hidden="true"
                                >
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                              ))}
                              {stars.half && (
                                <svg
                                  key="half"
                                  className="w-4 h-4 text-[#A86315]/50"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                  aria-hidden="true"
                                >
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292z" />
                                </svg>
                              )}
                              {Array.from({ length: stars.empty }).map((_, i) => (
                                <svg
                                  key={`e${i}`}
                                  className="w-4 h-4 text-[#003C5F]/15"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                  aria-hidden="true"
                                >
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                              ))}
                              <span className="ml-1 text-[13px] text-[#455A6A]">
                                {item.ratingGiven.toFixed(1)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 max-w-xs">
                            <p className="text-[13px] text-[#455A6A] line-clamp-2 leading-relaxed">
                              {item.feedbackSummary}
                            </p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
