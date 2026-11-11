import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FreelancerHeader } from '../shared/FreelancerHeader';
import { MilestoneList } from '../shared/MilestoneList';
import { StatusPill } from '../shared/StatusPill';
import { AIReviewCard } from '../shared/AIReviewCard';
import { Toast } from '../shared/Toast';
import { freelancerService } from '../../services/freelancerService';
import type { EvaluationResult, Milestone } from '../../types/freelancer';

export const WorkspacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>();
  const [activeMilestoneId, setActiveMilestoneId] = useState<string>('');

  const [submissionText, setSubmissionText] = useState('');
  const [submissionLink, setSubmissionLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [evaluationNotice, setEvaluationNotice] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      freelancerService.getProjectById(id).then((p) => {
      setProject(p);
      if (p) {
        document.title = `PayPilot AI — Project Workspace: ${p.title}`;
        // Pick the first milestone that is in_progress or under_review, or the first one
        const activeM =
          p.milestones.find((m: Milestone) => m.status === 'in_progress' || m.status === 'under_review') ||
          p.milestones[0];
        if (activeM) setActiveMilestoneId(activeM.id);
        }
      });
    }
  }, [id]);

  if (!project) {
    return (
      <div className="min-h-screen w-full flex flex-col bg-paper text-deepBlue font-sans">
        <FreelancerHeader
          title="Workspace not found"
          breadcrumbs={[
            { label: 'Projects', path: '/freelancer/projects' },
            { label: 'Workspace' },
          ]}
        />
        <main className="max-w-[1280px] mx-auto px-4 py-16 text-center space-y-4">
          <p className="text-[#455A6A]">This project could not be found or has not been activated yet.</p>
          <button
            type="button"
            onClick={() => navigate('/freelancer/projects')}
            className="px-5 py-2.5 bg-deepBlue text-paper rounded-lg text-sm font-medium"
          >
            Return to projects
          </button>
        </main>
      </div>
    );
  }

  const selectedMilestone: Milestone | undefined =
    project.milestones?.find((m: Milestone) => m.id === activeMilestoneId) || project.milestones?.[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMilestone) return;
    const text = submissionText.trim();
    const link = submissionLink.trim();
    if (!text && !link) return;

    setIsSubmitting(true);
    setEvaluationNotice(null);

    const combinedNotes = `${text}${link ? `\nDeliverable Asset Link: ${link}` : ''}`.trim();

    let evaluationResult: EvaluationResult | undefined = undefined;

    if (text) {
      try {
        evaluationResult = await freelancerService.evaluate({
          client_request: project.brief || project.title,
          acceptance_criteria: selectedMilestone.acceptanceCriteria || [],
          deliverable_text: text,
          work_category: (project.discipline || 'engineering').toLowerCase(),
          milestone_id: selectedMilestone.id,
          project_id: project.id,
        });
      } catch {
        const msg = 'Automatic evaluation unavailable; your client can review it manually';
        setEvaluationNotice(msg);
      }
    } else {
      // File-only submission
      const msg = "Files can't be scored automatically yet";
      setEvaluationNotice(msg);
    }

    try { await freelancerService.submitMilestoneWork(project.id, selectedMilestone.id, combinedNotes, evaluationResult); }
    catch (error) { setEvaluationNotice(error instanceof Error ? error.message : 'Unable to submit deliverable.'); setIsSubmitting(false); return; }
    setIsSubmitting(false);
    setSubmissionText('');
    setSubmissionLink('');

    // Refresh local project state
    const updated = await freelancerService.getProjectById(project.id);
    if (updated) setProject(updated);
  };

  const isReadOnly = project.readOnly || project.status === 'completed';

  return (
    <div className="min-h-screen w-full flex flex-col bg-paper text-deepBlue font-sans">
      <FreelancerHeader
        breadcrumbs={[
          { label: 'Projects', path: '/freelancer/projects' },
          { label: project.title },
        ]}
        title={project.title}
        subtitle={`Contract with ${project.client || 'Client'}. Manage deliverables, view automated evaluations, and submit work for client review.`}
        dateLine={`Active Workspace &middot; Target Completion ${project.deadline || 'Not set'}`}
      >
        {/* Payment Line Notice directly in header */}
        <div className="inline-flex flex-wrap items-center gap-3 bg-[#FDFBF7]/10 border border-[#FDFBF7]/20 rounded-lg px-4 py-3 mt-4 text-[13px] sm:text-[14px] text-[#FDFBF7]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#E5B564] shrink-0" aria-hidden="true" />
          <span>
            <strong>Payment notice:</strong> Payment starts after the client accepts this milestone and completes PayPal Sandbox checkout.
          </span>
        </div>
      </FreelancerHeader>

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-8 py-10 sm:py-14 space-y-10">
        {/* Overview Row: Milestones Selector + Current Milestone Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Milestones Progress (4 cols) */}
          <section className="lg:col-span-5 space-y-4">
            <div className="flex items-baseline justify-between border-b border-[#003C5F]/15 pb-3">
              <h3 className="font-display text-2xl text-deepBlue">Project milestones</h3>
              <span className="text-[13px] text-[#455A6A] font-medium">
                {(project.milestones || []).length} milestones
              </span>
            </div>

            <p className="text-[13px] text-[#455A6A]">
              Select a milestone to view its acceptance requirements or submit work:
            </p>

            <MilestoneList
              milestones={project.milestones || []}
              activeMilestoneId={selectedMilestone?.id}
              allowSelection
              onSelectMilestone={(m: Milestone) => setActiveMilestoneId(m.id)}
            />
          </section>

          {/* Right Column: Active Milestone Workspace & Submissions (7 cols) */}
          <section className="lg:col-span-7 space-y-6">
            {!selectedMilestone ? (
              <div className="bg-paper border border-[#003C5F]/15 rounded-xl p-8 text-center text-[#455A6A]">
                <p className="font-semibold text-deepBlue mb-1">No milestones defined.</p>
                <p className="text-sm">This project has no milestones yet.</p>
              </div>
            ) : (
            <>
            <div className="bg-paper border border-[#003C5F]/15 rounded-xl p-6 sm:p-7 space-y-6">
              {/* Active Milestone Title & Header */}
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 border-b border-[#003C5F]/10 pb-4">
                <div>
                  <span className="text-[13px] uppercase tracking-wider text-[#455A6A] font-medium block">
                    Milestone {selectedMilestone.number ?? 1}
                  </span>
                  <h3 className="text-xl sm:text-2xl font-bold text-deepBlue mt-0.5">
                    {selectedMilestone.title}
                  </h3>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-display text-2xl text-deepBlue">
                    ${(selectedMilestone.amount || 0).toLocaleString()}
                  </span>
                  <StatusPill status={selectedMilestone.status} />
                </div>
              </div>

              {/* Due Date & Acceptance Criteria */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[13px] text-[#455A6A]">
                  <span>Target delivery date: <strong>{selectedMilestone.dueDate || 'Not set'}</strong></span>
                  {selectedMilestone.submittedAt && (
                    <span className="text-[#874E0E] font-medium">
                      Submitted: {selectedMilestone.submittedAt}
                    </span>
                  )}
                </div>

                <div>
                  <h4 className="text-[14px] font-semibold text-deepBlue mb-2">
                    Acceptance criteria to satisfy:
                  </h4>
                  <ul className="list-disc pl-5 space-y-1.5 text-[14px] text-[#455A6A]">
                    {(selectedMilestone.acceptanceCriteria || []).map((c: string, idx: number) => (
                      <li key={idx} className="leading-relaxed">
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Existing Submission Notes if any */}
              {selectedMilestone.submissionNotes && (
                <div className="p-4 rounded-lg bg-[#FAF8F3] border border-[#003C5F]/10 space-y-1.5">
                  <h5 className="text-[13px] font-semibold text-deepBlue uppercase tracking-wider">
                    Submitted work notes
                  </h5>
                  <p className="text-[13px] text-[#455A6A] whitespace-pre-wrap leading-relaxed">
                    {selectedMilestone.submissionNotes}
                  </p>
                </div>
              )}

              {/* Payment status callout for accepted / paid milestones */}
              {selectedMilestone.status === 'accepted' && (
                <div className="p-4 rounded-lg bg-[#FAF3E7] border border-[#E8D2AC] text-[13px] text-[#874E0E]">
                  <span className="font-semibold">Milestone accepted:</span> Your client has approved this deliverable and can now release payment via PayPal Sandbox.
                </div>
              )}

              {selectedMilestone.status === 'paid' && (
                <div className="p-4 rounded-lg bg-[#EAF5EF] border border-[#B2DAC3] space-y-1.5 text-[13px] text-[#24543A]">
                  <div className="font-semibold">
                    Payment Completed (Sandbox) — ${(selectedMilestone.amount || 0).toLocaleString()}
                  </div>
                  <p className="text-[#24543A]/90">
                    This milestone was approved and settled by the client in PayPal Sandbox.
                  </p>
                  {selectedMilestone.paymentReference && (
                    <div>
                      Sandbox Reference:{' '}
                      <code className="font-mono bg-white/70 px-2 py-0.5 rounded text-deepBlue">
                        {selectedMilestone.paymentReference}
                      </code>
                    </div>
                  )}
                </div>
              )}

              {/* Submit Work Area (Enabled when in_progress or not_started, and not readOnly) */}
              {!isReadOnly && selectedMilestone.status !== 'accepted' && selectedMilestone.status !== 'paid' && (
                <form
                  onSubmit={handleSubmit}
                  className="pt-4 border-t border-[#003C5F]/15 space-y-4"
                >
                  <h4 className="text-[15px] font-semibold text-deepBlue">
                    {selectedMilestone.status === 'under_review'
                      ? 'Submit deliverable revision'
                      : 'Submit work for this milestone'}
                  </h4>

                  <div>
                    <label
                      htmlFor="submission-text"
                      className="block text-[13px] font-medium text-deepBlue mb-1.5"
                    >
                      Deliverable summary or notes
                    </label>
                    <textarea
                      id="submission-text"
                      rows={4}
                      value={submissionText}
                      onChange={(e) => setSubmissionText(e.target.value)}
                      placeholder="Describe the deliverable package, testing results, or changelog..."
                      className="w-full p-3.5 bg-paper text-deepBlue border border-[#003C5F]/20 rounded-lg text-[14px] placeholder:text-[#455A6A]/60 focus-visible:ring-2 focus-visible:ring-deepBlue focus-visible:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="submission-link"
                      className="block text-[13px] font-medium text-deepBlue mb-1.5"
                    >
                      Deliverable link or file URL (Figma, GitHub PR, or Cloud drive)
                    </label>
                    <input
                      id="submission-link"
                      type="text"
                      value={submissionLink}
                      onChange={(e) => setSubmissionLink(e.target.value)}
                      placeholder="https://..."
                      className="w-full min-h-[42px] px-3.5 bg-paper text-deepBlue border border-[#003C5F]/20 rounded-lg text-[14px] placeholder:text-[#455A6A]/60 focus-visible:ring-2 focus-visible:ring-deepBlue focus-visible:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[13px] text-[#455A6A]">
                      An automated preview review is generated immediately upon submission.
                    </span>
                    <button
                      type="submit"
                      disabled={isSubmitting || (!submissionText.trim() && !submissionLink.trim())}
                      className="min-h-[42px] px-6 py-2 bg-deepBlue text-paper rounded-lg text-[14px] font-semibold hover:bg-[#002E4A] transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? 'Evaluating...' : 'Submit milestone deliverable'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Loading state during ProofFlow evaluation */}
            {isSubmitting && (
              <div className="p-6 rounded-xl bg-[#FAF8F3] border border-[#003C5F]/20 flex items-center gap-3 animate-pulse">
                <div className="w-5 h-5 border-2 border-[#003C5F] border-t-transparent rounded-full animate-spin" />
                <div>
                  <p className="text-[14px] font-semibold text-deepBlue">
                    Evaluating deliverable with ProofFlow model...
                  </p>
                  <p className="text-[12px] text-[#455A6A]">
                    Assessing acceptance criteria alignment and evidence
                  </p>
                </div>
              </div>
            )}

            {/* Final Score / Review Status Card for Freelancer */}
            {!isSubmitting && (selectedMilestone.aiReview || selectedMilestone.status === 'under_review' || selectedMilestone.clientScore !== undefined) && (
              <div className="bg-paper border border-[#003C5F]/20 rounded-xl p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#003C5F]/15 pb-3">
                  <h4 className="font-display text-xl text-deepBlue">Milestone Review Score</h4>
                  {selectedMilestone.finalScore !== undefined ? (
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#EAF5EF] text-[#24543A] border border-[#B2DAC3] self-start sm:self-auto">
                      Final Score: {selectedMilestone.finalScore} / 100
                    </span>
                  ) : selectedMilestone.clientScore !== undefined ? (
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#EAF5EF] text-[#24543A] border border-[#B2DAC3] self-start sm:self-auto">
                      Client score: {selectedMilestone.clientScore} / 100
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#FAF3E7] text-[#874E0E] border border-[#E8D2AC] self-start sm:self-auto">
                      Awaiting client review
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  {/* Case 1: Milestone has AI score and client has NOT scored yet */}
                  {(selectedMilestone.modelScore !== undefined || selectedMilestone.aiReview) && selectedMilestone.clientScore === undefined && (
                    <div className="p-4 rounded-lg bg-[#FAF8F3] border border-[#003C5F]/10 space-y-2">
                      <div className="text-base font-semibold text-deepBlue">
                        AI score: {selectedMilestone.modelScore ?? selectedMilestone.aiReview?.overall_score ?? selectedMilestone.aiReview?.overallScore}, waiting for your client's review
                      </div>
                      <p className="text-xs text-[#455A6A]">
                        The final score combines the AI score and your client's score.
                      </p>
                    </div>
                  )}

                  {/* Case 2: Milestone has AI score AND client has scored -> show final score with both parts visible */}
                  {(selectedMilestone.modelScore !== undefined || selectedMilestone.aiReview) && selectedMilestone.clientScore !== undefined && (
                    <div className="p-4 rounded-lg bg-[#FAF8F3] border border-[#003C5F]/10 space-y-3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[13px] uppercase tracking-wider text-[#455A6A] font-semibold">
                          Final score:
                        </span>
                        <span className="font-display text-3xl text-deepBlue">
                          {selectedMilestone.finalScore}
                        </span>
                        <span className="text-sm text-[#455A6A]">/ 100</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-[#003C5F]/10">
                        <div className="p-3 bg-paper rounded-lg border border-[#003C5F]/10">
                          <span className="block text-xs uppercase tracking-wider text-[#455A6A] font-medium">
                            AI score
                          </span>
                          <span className="text-xl font-bold text-deepBlue">
                            {selectedMilestone.modelScore ?? selectedMilestone.aiReview?.overall_score ?? selectedMilestone.aiReview?.overallScore}
                          </span>
                          <span className="text-xs text-[#455A6A]"> / 100</span>
                        </div>
                        <div className="p-3 bg-paper rounded-lg border border-[#003C5F]/10">
                          <span className="block text-xs uppercase tracking-wider text-[#455A6A] font-medium">
                            Client score
                          </span>
                          <span className="text-xl font-bold text-deepBlue">
                            {selectedMilestone.clientScore}
                          </span>
                          <span className="text-xs text-[#455A6A]"> / 100</span>
                        </div>
                      </div>

                      <p className="text-xs text-[#455A6A]">
                        The final score combines the AI score and your client's score.
                      </p>
                    </div>
                  )}

                  {/* Case 3: AI evaluation unavailable or file-only -> show client's score on its own, labelled "Client score" */}
                  {!selectedMilestone.aiReview && selectedMilestone.modelScore === undefined && selectedMilestone.clientScore !== undefined && (
                    <div className="p-4 rounded-lg bg-[#FAF8F3] border border-[#003C5F]/10 space-y-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[13px] uppercase tracking-wider text-[#455A6A] font-semibold">
                          Client score:
                        </span>
                        <span className="font-display text-3xl text-deepBlue">
                          {selectedMilestone.clientScore}
                        </span>
                        <span className="text-sm text-[#455A6A]">/ 100</span>
                      </div>
                      <p className="text-xs text-[#455A6A]">
                        Files can't be scored automatically yet or AI evaluation was unavailable. Client score is recorded on its own.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AI Review Card when milestone has evaluation */}
            {!isSubmitting && selectedMilestone.aiReview && (
              <div className="pt-2 animate-fade-rise">
                <AIReviewCard review={selectedMilestone.aiReview} />
              </div>
            )}

            {/* Fallback notice if evaluation unavailable or file-only */}
            {!isSubmitting && !selectedMilestone.aiReview && (evaluationNotice || selectedMilestone.status === 'under_review') && (
              <div className="pt-2">
                <div className="p-4 rounded-xl bg-[#FAF8F3] border border-[#003C5F]/15 flex items-start gap-3 text-[13px] text-[#455A6A]">
                  <span className="w-2 h-2 rounded-full bg-[#E5B564] shrink-0 mt-1.5" />
                  <div>
                    <strong className="block text-deepBlue mb-0.5">Evaluation notice</strong>
                    <span>
                      {evaluationNotice ||
                        (selectedMilestone.submissionNotes &&
                        !selectedMilestone.submissionNotes.replace(/Deliverable Asset Link:.*$/m, '').trim()
                          ? "Files can't be scored automatically yet"
                          : "Automatic evaluation unavailable; your client can review it manually")}
                    </span>
                  </div>
                </div>
              </div>
            )}
            </>
            )}
          </section>
        </div>
      </main>

      <Toast />
    </div>
  );
};
