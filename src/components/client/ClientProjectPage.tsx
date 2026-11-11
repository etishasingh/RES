import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PayPalButtons, PayPalScriptProvider } from '@paypal/react-paypal-js';
import { ClientHeader } from '../shared/ClientHeader';
import { StatusPill } from '../shared/StatusPill';
import { AIReviewCard } from '../shared/AIReviewCard';
import { useReveal } from '../../hooks/useReveal';
import type { Milestone } from '../../types/freelancer';
import { SCORE_WEIGHTS, computeFinalScore } from '../../lib/scoring';
import { projectService } from '../../services/projectService';
import { clientService } from '../../services/clientService';
import { paymentService, type PayPalConfig } from '../../services/paymentService';

export const ClientProjectPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<any>();
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadProjectData = async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      setLoadError('');
      const [data, received, freelancers] = await Promise.all([
        projectService.get(id),
        projectService.submissions(id),
        clientService.getFreelancers().catch(() => []),
      ]);
      setSubmissions(received);

      const milestoneDeadlines = Array.isArray(data.milestones)
        ? data.milestones.map((m: any) => m.due_date).filter(Boolean)
        : [];
      const deadline =
        milestoneDeadlines.length > 0 ? [...milestoneDeadlines].sort().reverse()[0] : 'Not set';

      const milestonesSum = Array.isArray(data.milestones)
        ? data.milestones.reduce((s: number, m: any) => s + (Number(m.amount) || 0), 0)
        : 0;

      const totalPaidSoFar = Array.isArray(data.milestones)
        ? data.milestones
            .filter((m: any) => m.status === 'paid')
            .reduce((sum: number, m: any) => sum + (Number(m.amount) || 0), 0)
        : 0;

      const mappedMilestones = (data.milestones || []).map((m: any, index: number) => {
        const sub = received.find((s) => s.milestone_id === m.id);
        return {
          id: m.id,
          number: index + 1,
          title: m.title,
          amount: Number(m.amount) || 0,
          dueDate: m.due_date || 'Not set',
          status: m.status === 'submitted' ? 'under_review' : m.status,
          acceptanceCriteria: Array.isArray(m.acceptance_criteria) ? m.acceptance_criteria : [],
          submissionNotes: sub?.notes || sub?.deliverable_text || undefined,
          submittedAt: sub?.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : undefined,
          aiReview: sub?.evaluation_result,
          modelScore: sub?.evaluation_result?.overall_score,
          paymentReference: m.payment_reference ?? null,
          paidAt: m.paid_at ?? null,
        };
      });

      let assignedFreelancer = undefined;
      if (data.freelancer_id) {
        const found = freelancers.find((f: any) => f.id === data.freelancer_id);
        const name = found?.name || (data as any).freelancer_name || 'Assigned Freelancer';
        const avatarText = name
          .split(' ')
          .map((part: string) => part[0])
          .join('')
          .slice(0, 2)
          .toUpperCase() || 'FL';
        const rate = found?.hourly_rate
          ? `$${found.hourly_rate}/hr`
          : data.hourly_rate
          ? `$${data.hourly_rate}/hr`
          : 'Fixed scope';

        assignedFreelancer = {
          id: data.freelancer_id,
          name,
          avatarText,
          rate,
        };
      }

      setProject({
        id: data.id,
        title: data.title,
        description: data.description,
        skills: Array.isArray(data.skills) ? data.skills : [],
        budget: data.budget_max ?? data.budget_min ?? milestonesSum,
        currency: data.currency || 'USD',
        totalPaidSoFar,
        deadline,
        status: data.status,
        assignedFreelancer,
        milestones: mappedMilestones,
      });
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load project.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProjectData();
  }, [id]);

  const { ref: projectRef } = useReveal<HTMLDivElement>();

  // Selected milestone for detailed review view
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null);

  useEffect(() => {
    if (project?.milestones?.length && !selectedMilestoneId) {
      const inReview = project.milestones.find((m: Milestone) => m.status === 'under_review' || m.status === 'submitted');
      setSelectedMilestoneId(inReview ? inReview.id : project.milestones[0].id);
    }
  }, [project, selectedMilestoneId]);

  const [requestNotes, setRequestNotes] = useState('');
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [clientScoreInput, setClientScoreInput] = useState<string>('');
  const [paypalConfig, setPaypalConfig] = useState<PayPalConfig | null>(null);
  const [paymentStatusMessage, setPaymentStatusMessage] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [isCapturingPayment, setIsCapturingPayment] = useState(false);

  useEffect(() => {
    paymentService
      .getConfig()
      .then(setPaypalConfig)
      .catch(() => setPaypalConfig(null));
  }, []);

  const selectedMilestone: Milestone | undefined =
    project?.milestones?.find((m: Milestone) => m.id === selectedMilestoneId) ||
    project?.milestones?.[0];

  // Sync clientScoreInput when active milestone changes
  useEffect(() => {
    setPaymentError('');
    setPaymentStatusMessage('');
  }, [selectedMilestoneId]);

  useEffect(() => {
    if (selectedMilestone?.clientScore !== undefined) {
      setClientScoreInput(String(selectedMilestone.clientScore));
    } else {
      setClientScoreInput('');
    }
  }, [selectedMilestone?.id, selectedMilestone?.clientScore]);

  if (isLoading && !project) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] text-[#1E293B]">
        <ClientHeader
          breadcrumbs={[
            { label: 'Dashboard', path: '/client/dashboard' },
            { label: 'Loading project…' },
          ]}
        />
        <main className="max-w-4xl mx-auto px-4 py-20 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-[#003C5F] border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-[#455A6A] text-sm">Loading project workspace…</p>
        </main>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] text-[#1E293B]">
        <ClientHeader
          breadcrumbs={[
            { label: 'Dashboard', path: '/client/dashboard' },
            { label: 'Project Not Found' },
          ]}
        />
        <main className="max-w-4xl mx-auto px-4 py-16 text-center">
          <div className="p-8 bg-paper border border-[#003C5F]/15 rounded-xl space-y-4">
            <h1 className="font-display text-3xl text-deepBlue">Project Not Found</h1>
            <p className="text-[#455A6A] text-sm max-w-md mx-auto">
              We couldn't locate project ID &ldquo;{id}&rdquo;. It may have been archived or removed.
            </p>
            <div className="pt-2">
              <Link
                to="/client/dashboard"
                className="inline-flex px-5 py-2.5 rounded-lg bg-[#003C5F] text-[#FDFBF7] text-sm font-semibold hover:bg-[#002B45] transition-colors"
              >
                Return to Dashboard
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const rawModelScore =
    selectedMilestone?.modelScore ??
    selectedMilestone?.aiReview?.overall_score ??
    selectedMilestone?.aiReview?.overallScore;
  const hasModelScore = typeof rawModelScore === 'number' && !isNaN(rawModelScore);
  const modelScore = hasModelScore ? Math.round(rawModelScore) : null;
  const weights = selectedMilestone?.scoreWeights || SCORE_WEIGHTS;

  const parsedScore = clientScoreInput === '' ? NaN : Number(clientScoreInput);
  const isScoreValid = !isNaN(parsedScore) && parsedScore >= 0 && parsedScore <= 100;
  const liveFinalScore =
    isScoreValid && hasModelScore && modelScore !== null
      ? computeFinalScore(modelScore, parsedScore, weights).finalScore
      : null;

  const totalPaid = project.totalPaidSoFar || 0;
  const totalBudget = project.budget || 0;
  const remaining = Math.max(0, totalBudget - totalPaid);

  const handleAccept = async (milestoneId: string) => {
    const submission = submissions.find((item) => item.milestone_id === milestoneId);
    if (!submission) return setLoadError('No submission is available for this milestone.');
    try {
      await projectService.review(submission.id, {
        client_score: isScoreValid ? parsedScore : 100,
        feedback: requestNotes || undefined,
        decision: 'accepted',
      });
      await loadProjectData();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to review submission.');
    }
  };

  const handleRequestChanges = async (milestoneId: string) => {
    const submission = submissions.find((item) => item.milestone_id === milestoneId);
    if (!submission) return setLoadError('No submission is available for this milestone.');
    try {
      await projectService.review(submission.id, {
        client_score: isScoreValid ? parsedScore : 0,
        feedback: requestNotes.trim() || 'Please revise according to acceptance criteria.',
        decision: 'changes_requested',
      });
      setShowRequestForm(false);
      setRequestNotes('');
      await loadProjectData();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to request changes.');
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#1E293B]">
      {loadError && <p role="alert" className="max-w-4xl mx-auto px-4 pt-4 text-sm text-[#874E0E]">{loadError}</p>}
      <ClientHeader
        breadcrumbs={[
          { label: 'Dashboard', path: '/client/dashboard' },
          { label: project.title },
        ]}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div ref={projectRef} className="space-y-8">
          {/* Top Banner Card */}
          <div className="bg-paper border border-[#003C5F]/15 rounded-xl p-6 sm:p-8">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-[#003C5F]/10">
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center gap-2.5">
                  <span className="text-[13px] font-semibold text-[#003C5F] tracking-wide uppercase">
                    Project Workspace
                  </span>
                  <StatusPill
                    status={
                      project.status === 'in_review'
                        ? 'under_review'
                        : project.status === 'completed'
                        ? 'paid'
                        : 'in_progress'
                    }
                  />
                </div>
                <h1 className="font-display text-3xl sm:text-4xl text-deepBlue">
                  {project.title}
                </h1>
                <p className="text-[#455A6A] text-sm leading-relaxed">
                  {project.description}
                </p>
              </div>

              {/* Financial Snapshot */}
              <div className="grid grid-cols-3 gap-3 bg-[#FDFBF7] p-4 rounded-xl border border-[#003C5F]/15 text-center min-w-[280px]">
                <div>
                  <div className="text-[13px] text-[#455A6A]">Budget</div>
                  <div className="font-display text-xl text-deepBlue mt-0.5">
                    ${totalBudget.toLocaleString()}
                  </div>
                </div>
                <div className="border-x border-[#003C5F]/10">
                  <div className="text-[13px] text-[#455A6A]">Paid So Far</div>
                  <div className="font-display text-xl text-[#24543A] mt-0.5">
                    ${totalPaid.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-[13px] text-[#455A6A]">Remaining</div>
                  <div className="font-display text-xl text-[#874E0E] mt-0.5">
                    ${remaining.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Meta Row: Assigned talent, deadline, required skills */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 text-sm text-[#455A6A]">
              <div className="flex items-center gap-4 flex-wrap">
                {project.assignedFreelancer ? (
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-[#003C5F] text-[#FDFBF7] flex items-center justify-center font-bold text-xs">
                      {project.assignedFreelancer.avatarText}
                    </div>
                    <div>
                      <span className="text-[13px] text-[#455A6A]">Assigned Talent: </span>
                      <span className="font-semibold text-deepBlue">
                        {project.assignedFreelancer.name}
                      </span>{' '}
                      <span className="text-xs text-[#5C7284]">
                        ({project.assignedFreelancer.rate})
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-[#874E0E] font-medium">
                      Yet to be assigned
                    </span>
                    <Link
                      to="/client/dashboard"
                      className="text-xs text-[#003C5F] font-semibold underline"
                    >
                      Browse Directory
                    </Link>
                  </div>
                )}
                <span className="text-[#003C5F]/20">|</span>
                <div>
                  <span className="text-[13px] text-[#455A6A]">Target Deadline: </span>
                  <span className="font-semibold text-deepBlue">{project.deadline || 'Not set'}</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {(project.skills || []).map((skill: string) => (
                  <span
                    key={skill}
                    className="px-2.5 py-0.5 rounded text-xs bg-[#003C5F]/5 text-deepBlue border border-[#003C5F]/15"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Main Grid: Milestones list on left, Detailed review / actions on right */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Milestone list selector */}
            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl text-deepBlue">
                  Project Milestones
                </h2>
                <span className="text-[13px] text-[#455A6A]">
                  {(project.milestones || []).length} Phases
                </span>
              </div>

              <div className="space-y-3">
                {(project.milestones || []).map((m: Milestone, index: number) => {
                  const isSelected = selectedMilestone?.id === m.id;
                  const isUnderReview = m.status === 'under_review' || m.status === 'submitted';

                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setSelectedMilestoneId(m.id);
                        setShowRequestForm(false);
                      }}
                      className={`w-full p-4 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'bg-paper border-[#003C5F] shadow-sm ring-1 ring-[#003C5F]'
                          : 'bg-paper/70 border-[#003C5F]/15 hover:border-[#003C5F]/35'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              isSelected
                                ? 'bg-[#003C5F] text-[#FDFBF7]'
                                : 'bg-[#003C5F]/10 text-deepBlue'
                            }`}
                          >
                            {m.number ?? index + 1}
                          </span>
                          <span className="font-semibold text-deepBlue text-sm">
                            {m.title}
                          </span>
                        </div>
                        <StatusPill status={m.status} />
                      </div>

                      <div className="mt-3 pt-2 border-t border-[#003C5F]/10 flex items-center justify-between text-[13px] text-[#455A6A]">
                        <span>Due: {m.dueDate || 'Not set'}</span>
                        <span className="font-display text-base text-deepBlue font-medium">
                          ${(m.amount || 0).toLocaleString()}
                        </span>
                      </div>

                      {isUnderReview && (
                        <div className="mt-2.5 flex items-center gap-1.5 text-xs text-[#874E0E] font-semibold bg-[#FAF3E7] px-2.5 py-1 rounded border border-[#E8D2AC]">
                          <span className="w-2 h-2 rounded-full bg-[#A86315] animate-pulse" />
                          Ready for your approval review
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Selected Milestone Details, Submitted Work & Decision Center */}
            <div className="lg:col-span-7 space-y-6">
              {!selectedMilestone ? (
                <div className="bg-paper border border-[#003C5F]/15 rounded-xl p-8 text-center text-[#455A6A]">
                  <p className="font-semibold text-deepBlue mb-1">No milestones defined.</p>
                  <p className="text-sm">This project has no milestones yet.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Milestone Header Card */}
                  <div className="bg-paper border border-[#003C5F]/15 rounded-xl p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#003C5F]/10 pb-4">
                      <div>
                        <div className="text-[13px] text-[#455A6A]">
                          Milestone #{selectedMilestone.number ?? 1}
                        </div>
                        <h3 className="font-display text-2xl text-deepBlue mt-0.5">
                          {selectedMilestone.title}
                        </h3>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-display text-2xl text-deepBlue font-semibold">
                          ${(selectedMilestone.amount || 0).toLocaleString()}
                        </span>
                        <StatusPill status={selectedMilestone.status} />
                      </div>
                    </div>

                    {/* Criteria Checklist */}
                    <div>
                      <h4 className="text-[13px] font-semibold text-deepBlue tracking-wide uppercase mb-2">
                        Acceptance Criteria
                      </h4>
                      <ul className="space-y-2">
                        {(selectedMilestone.acceptanceCriteria || []).map((criterion: string, idx: number) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2.5 text-sm text-[#455A6A]"
                          >
                            <svg
                              className="w-4 h-4 text-[#2E6B4A] flex-shrink-0 mt-0.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2.5"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                            <span>{criterion}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* If Milestone is Under Review: Show Deliverable, AI Evaluation, and Decision Buttons */}
                  {(selectedMilestone.status === 'under_review' || selectedMilestone.status === 'submitted') && (
                    <div className="space-y-6">
                      {/* Submitted Work Notice */}
                      <div className="bg-paper border border-[#003C5F]/15 rounded-xl p-6 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-display text-xl text-deepBlue">
                            Submitted Deliverable
                          </h4>
                          {selectedMilestone.submittedAt && (
                            <span className="text-[13px] text-[#455A6A]">
                              Submitted {selectedMilestone.submittedAt}
                            </span>
                          )}
                        </div>
                        <div className="p-4 rounded-lg bg-[#FDFBF7] border border-[#003C5F]/15 text-sm text-[#1E293B] whitespace-pre-line leading-relaxed">
                          {selectedMilestone.submissionNotes ||
                            'The freelancer has submitted this milestone along with repository deliverables and test verifications.'}
                        </div>
                      </div>

                      {/* AI Review Card */}
                      {selectedMilestone.aiReview ? (
                        <div className="space-y-3">
                          <AIReviewCard review={selectedMilestone.aiReview} />
                          <div className="p-3 rounded-lg bg-[#FAF3E7] border border-[#E8D2AC] text-xs text-[#874E0E] flex items-start gap-2">
                            <svg
                              className="w-4 h-4 flex-shrink-0 mt-0.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <circle cx="12" cy="12" r="10" strokeWidth="2" />
                              <line x1="12" y1="8" x2="12" y2="12" strokeWidth="2" />
                              <circle cx="12" cy="16" r="1" fill="currentColor" />
                            </svg>
                            <span>
                              <strong>Product Honesty Notice:</strong> The automated evaluation score
                              informs your decision only. It never triggers release of funds. Client
                              approval is the sole authorization authority.
                            </span>
                          </div>
                        </div>
                      ) : null}

                      {/* Client Scoring Card */}
                      <div className="bg-paper border border-[#003C5F]/15 rounded-xl p-6 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#003C5F]/10 pb-3">
                          <h4 className="font-display text-xl text-deepBlue">
                            Milestone Evaluation & Scoring
                          </h4>
                          {selectedMilestone.finalScore !== undefined ? (
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#EAF5EF] text-[#24543A] border border-[#B2DAC3] self-start sm:self-auto">
                              Final score: {selectedMilestone.finalScore} / 100
                            </span>
                          ) : selectedMilestone.clientScore !== undefined ? (
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#EAF5EF] text-[#24543A] border border-[#B2DAC3] self-start sm:self-auto">
                              Client score: {selectedMilestone.clientScore} / 100
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#FAF3E7] text-[#874E0E] border border-[#E8D2AC] self-start sm:self-auto">
                              Score pending
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-[#455A6A]">
                          The final score combines the AI score and your client's score.
                        </p>

                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (!isScoreValid) return;
                            handleAccept(selectedMilestone.id);
                          }}
                          className="space-y-4"
                        >
                          <div>
                            <label
                              htmlFor="client-score-input"
                              className="block text-[13px] font-semibold text-deepBlue mb-1"
                            >
                              Your score <span className="text-red-500">*</span>
                            </label>
                            <div className="flex items-center gap-3">
                              <input
                                id="client-score-input"
                                type="number"
                                min={0}
                                max={100}
                                required
                                value={clientScoreInput}
                                onChange={(e) => setClientScoreInput(e.target.value)}
                                placeholder="0 - 100"
                                className="w-32 px-3 py-2 rounded-lg border border-[#003C5F]/20 bg-[#FDFBF7] text-sm focus:outline-none focus:ring-2 focus:ring-[#003C5F]"
                              />
                              <span className="text-sm text-[#455A6A]">/ 100</span>
                            </div>
                            <p className="text-xs text-[#455A6A] mt-1">
                              How well does the work meet your brief?
                            </p>
                          </div>

                          {/* Live preview */}
                          {isScoreValid && (
                            <div className="p-3.5 rounded-lg bg-[#FAF8F3] border border-[#003C5F]/15 text-sm space-y-1">
                              {hasModelScore ? (
                                <div>
                                  <span className="font-semibold text-deepBlue">Final score: </span>
                                  <span className="font-medium text-[#003C5F]">
                                    {liveFinalScore} = AI score {modelScore} x {weights.model} + your score {parsedScore} x {weights.client}
                                  </span>
                                </div>
                              ) : (
                                <div>
                                  <span className="font-semibold text-deepBlue">Client score: </span>
                                  <span className="font-medium text-[#003C5F]">
                                    {parsedScore}
                                  </span>
                                  <span className="block text-xs text-[#455A6A] mt-0.5">
                                    Files can't be scored automatically or AI evaluation unavailable; client score is recorded on its own.
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {selectedMilestone.clientScore !== undefined && (
                            <div className="text-xs text-[#2E6B4A] flex flex-wrap items-center gap-2 font-medium">
                              <span>✓ Saved client score: {selectedMilestone.clientScore}/100</span>
                              {selectedMilestone.finalScore !== undefined && (
                                <span>(Final combined: {selectedMilestone.finalScore}/100)</span>
                              )}
                            </div>
                          )}

                          <div className="pt-1">
                            <button
                              type="submit"
                              disabled={!isScoreValid}
                              className="px-5 py-2.5 rounded-lg bg-[#003C5F] text-paper text-sm font-semibold hover:bg-[#002E4A] transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                            >
                              Save my score
                            </button>
                          </div>
                        </form>
                      </div>

                      {/* Decision Action Area */}
                      <div className="bg-paper border border-[#003C5F]/15 rounded-xl p-6 space-y-4">
                        <h4 className="font-display text-xl text-deepBlue">
                          Client Approval Decision
                        </h4>
                        <p className="text-sm text-[#455A6A] leading-relaxed">
                          Review the submitted deliverable and acceptance criteria. You can accept the
                          milestone or request specific revisions from your freelancer.
                        </p>

                        {!showRequestForm ? (
                          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                            <button
                              type="button"
                              onClick={() => handleAccept(selectedMilestone.id)}
                              className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-[#2E6B4A] text-white text-sm font-semibold hover:bg-[#24543A] transition-colors shadow-sm"
                            >
                              Accept Milestone
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowRequestForm(true)}
                              className="w-full sm:w-auto px-5 py-2.5 rounded-lg border border-[#003C5F]/20 text-[#003C5F] text-sm font-semibold hover:bg-[#003C5F]/5 transition-colors"
                            >
                              Request Changes
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-3 pt-2">
                            <label
                              htmlFor="request-notes"
                              className="block text-[13px] font-semibold text-deepBlue"
                            >
                              Feedback & Requested Adjustments
                            </label>
                            <textarea
                              id="request-notes"
                              rows={3}
                              value={requestNotes}
                              onChange={(e) => setRequestNotes(e.target.value)}
                              placeholder="Describe the adjustments needed to satisfy the acceptance criteria..."
                              className="w-full px-3 py-2 rounded-lg border border-[#003C5F]/20 bg-[#FDFBF7] text-sm focus:outline-none focus:ring-2 focus:ring-[#003C5F]"
                            />
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => handleRequestChanges(selectedMilestone.id)}
                                className="px-5 py-2 rounded-lg bg-[#A86315] text-white text-sm font-semibold hover:bg-[#874E0E] transition-colors"
                              >
                                Send Feedback to Freelancer
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowRequestForm(false)}
                                className="px-4 py-2 rounded-lg border border-[#003C5F]/20 text-[#003C5F] text-sm font-semibold hover:bg-[#003C5F]/5 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* If Milestone is Accepted: PayPal Sandbox Checkout */}
                  {selectedMilestone.status === 'accepted' && (
                    <div className="bg-paper border border-[#003C5F]/15 rounded-xl p-6 space-y-4">
                      <div className="flex items-center gap-2 text-[#24543A] font-semibold text-sm">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span>Milestone accepted. Ready for PayPal Sandbox payment.</span>
                      </div>

                      {paymentError && (
                        <div role="alert" className="p-3 rounded-lg bg-[#FDF2F2] border border-[#F5C2C2] text-xs text-[#991B1B]">
                          {paymentError}
                        </div>
                      )}

                      {paymentStatusMessage && (
                        <div className="p-3 rounded-lg bg-[#EAF5EF] border border-[#B2DAC3] text-xs text-[#24543A]">
                          {paymentStatusMessage}
                        </div>
                      )}

                      <div className="p-4 rounded-lg bg-[#FDFBF7] border border-[#003C5F]/15 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <div className="font-semibold text-deepBlue text-sm">
                              Authorized Release Amount: ${(selectedMilestone.amount || 0).toLocaleString()} ({project.currency || 'USD'})
                            </div>
                            <p className="text-[13px] text-[#455A6A] mt-0.5">
                              {paypalConfig?.configured
                                ? 'Authorize payment using a PayPal Sandbox buyer account. No real money moves.'
                                : 'Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to backend/.env to enable checkout.'}
                            </p>
                          </div>
                        </div>

                        {paypalConfig?.configured && paypalConfig.clientId ? (
                          <div className="max-w-sm">
                            {isCapturingPayment && (
                              <p className="text-xs text-[#003C5F] font-medium mb-2">
                                Finalizing PayPal Sandbox capture…
                              </p>
                            )}
                            <PayPalScriptProvider
                              options={{
                                clientId: paypalConfig.clientId,
                                currency: project.currency || 'USD',
                                intent: 'capture',
                              }}
                            >
                              <PayPalButtons
                                style={{ layout: 'horizontal', height: 42, tagline: false }}
                                disabled={isCapturingPayment}
                                forceReRender={[selectedMilestone.id, selectedMilestone.amount, project.currency]}
                                createOrder={async () => {
                                  setPaymentError('');
                                  setPaymentStatusMessage('');
                                  const order = await paymentService.createMilestoneOrder(selectedMilestone.id);
                                  return order.orderId;
                                }}
                                onApprove={async (data) => {
                                  setIsCapturingPayment(true);
                                  setPaymentError('');
                                  try {
                                    const result = await paymentService.captureOrder(data.orderID);
                                    setPaymentStatusMessage(
                                      `Payment completed in PayPal Sandbox. Reference: ${result.captureId || result.orderId}`
                                    );
                                    await loadProjectData();
                                  } catch (err) {
                                    setPaymentError(
                                      err instanceof Error ? err.message : 'Failed to capture PayPal Sandbox payment.'
                                    );
                                  } finally {
                                    setIsCapturingPayment(false);
                                  }
                                }}
                                onCancel={() => {
                                  setPaymentStatusMessage('PayPal Sandbox checkout was cancelled. You can retry anytime.');
                                }}
                                onError={(err) => {
                                  console.error('PayPal Checkout error:', err);
                                  setPaymentError('PayPal Sandbox checkout encountered an error. Please try again.');
                                }}
                              />
                            </PayPalScriptProvider>
                          </div>
                        ) : (
                          <div className="flex flex-col items-start gap-1.5">
                            <button
                              type="button"
                              disabled
                              className="px-6 py-2.5 rounded-lg bg-[#003C5F]/40 text-[#FDFBF7] text-sm font-semibold cursor-not-allowed border border-[#003C5F]/20"
                            >
                              Pay milestone
                            </button>
                            <span className="text-[13px] text-[#455A6A] font-medium">
                              PayPal Sandbox credentials are not configured yet
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* If Milestone is In Progress */}
                  {selectedMilestone.status === 'in_progress' && (
                    <div className="bg-paper border border-[#003C5F]/15 rounded-xl p-6 space-y-3">
                      <div className="flex items-center gap-2 text-[#874E0E] font-semibold text-sm">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <circle cx="12" cy="12" r="10" strokeWidth="2" />
                          <polyline points="12 6 12 12 16 14" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        <span>In Progress by Freelancer</span>
                      </div>
                      <p className="text-sm text-[#455A6A] leading-relaxed">
                        The assigned freelancer is actively working on this deliverable. Once submitted,
                        it will appear here alongside the automated sample evaluation for your formal approval.
                      </p>
                      {selectedMilestone.submissionNotes && (
                        <div className="p-3 bg-[#FAF3E7] rounded-lg border border-[#E8D2AC] text-xs text-[#874E0E]">
                          <span className="font-semibold">Revision History:</span>{' '}
                          {selectedMilestone.submissionNotes}
                        </div>
                      )}
                    </div>
                  )}

                  {/* If Milestone is Paid */}
                  {selectedMilestone.status === 'paid' && (
                    <div className="bg-paper border border-[#003C5F]/15 rounded-xl p-6 space-y-3">
                      <div className="flex items-center gap-2 text-[#24543A] font-semibold text-sm">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span>Payment Completed (Sandbox)</span>
                      </div>
                      <p className="text-sm text-[#455A6A]">
                        This milestone deliverable was approved and settled in PayPal Sandbox (${(selectedMilestone.amount || 0).toLocaleString()}).
                      </p>
                      {selectedMilestone.paymentReference && (
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-[#455A6A]">
                          <span>
                            Sandbox Reference:{' '}
                            <code className="font-mono bg-[#003C5F]/5 px-2 py-0.5 rounded text-deepBlue">
                              {selectedMilestone.paymentReference}
                            </code>
                          </span>
                          <Link
                            to="/client/payments"
                            className="text-[#003C5F] font-semibold underline underline-offset-2"
                          >
                            View in Payments Ledger
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
