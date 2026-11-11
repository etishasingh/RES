import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FreelancerHeader } from '../shared/FreelancerHeader';
import { MilestoneList } from '../shared/MilestoneList';
import { Toast } from '../shared/Toast';
import { projectService, type ApiProjectRequest } from '../../services/projectService';

export const InvitationPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>();
  const [invitationId, setInvitationId] = useState<string>();
  const [myRequest, setMyRequest] = useState<ApiProjectRequest | null>(null);
  const [requestError, setRequestError] = useState('');
  const [requestSuccess, setRequestSuccess] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);

    Promise.all([
      projectService.get(id).catch(() => null),
      projectService.invitations().catch(() => []),
      projectService.getMyRequest(id).catch(() => null),
    ])
      .then(([directProject, invitations, userReq]) => {
        setMyRequest(userReq || null);

        const invitation = (invitations || []).find(
          (item: any) =>
            (item.project_id === id || item.id === id) &&
            (item.status === 'pending' || item.status === 'accepted')
        );

        const p = directProject || invitation?.project;
        if (!p) return;

        if (invitation && invitation.status === 'pending') {
          setInvitationId(invitation.id);
        }

        const milestoneDeadlines = Array.isArray(p.milestones)
          ? p.milestones.map((m: any) => m.due_date).filter(Boolean)
          : [];
        const deadline =
          milestoneDeadlines.length > 0 ? [...milestoneDeadlines].sort().reverse()[0] : 'Not set';

        const mappedMilestones = (p.milestones || []).map((m: any, index: number) => ({
          id: m.id,
          number: index + 1,
          title: m.title,
          amount: Number(m.amount) || 0,
          dueDate: m.due_date || 'Not set',
          status: m.status,
          acceptanceCriteria: Array.isArray(m.acceptance_criteria)
            ? m.acceptance_criteria
            : typeof m.acceptance_criteria === 'string'
            ? [m.acceptance_criteria]
            : [],
        }));

        const totalBudget =
          p.budget_max ??
          p.budget_min ??
          (Array.isArray(p.milestones)
            ? p.milestones.reduce((sum: number, m: any) => sum + (Number(m.amount) || 0), 0)
            : 0);

        setProject({
          id: p.id,
          client: (p as any).client || 'Client',
          title: p.title,
          brief: p.description,
          totalBudget,
          deadline,
          matchScore: 94,
          matchExplanation: invitation
            ? 'Direct project invitation from client.'
            : 'Open project brief matching your independent skills.',
          requiredSkills: Array.isArray(p.skills) ? p.skills : [],
          milestones: mappedMilestones,
          status: invitation?.status === 'pending' ? 'invitation' : p.status,
        });
        document.title = `PayPilot AI — Project Brief: ${p.title}`;
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [id]);

  if (isLoading && !project) {
    return (
      <div className="min-h-screen w-full flex flex-col bg-paper text-deepBlue font-sans">
        <FreelancerHeader
          title="Loading project brief…"
          breadcrumbs={[
            { label: 'Projects', path: '/freelancer/projects' },
            { label: 'Brief' },
          ]}
        />
        <main className="max-w-[1280px] mx-auto px-4 py-20 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-[#003C5F] border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-[#455A6A] text-sm">Loading project brief…</p>
        </main>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen w-full flex flex-col bg-paper text-deepBlue font-sans">
        <FreelancerHeader
          title="Project not found"
          breadcrumbs={[
            { label: 'Projects', path: '/freelancer/projects' },
            { label: 'Brief' },
          ]}
        />
        <main className="max-w-[1280px] mx-auto px-4 py-16 text-center space-y-4">
          <p className="text-[#455A6A]">This project could not be located or has expired.</p>
          <button
            type="button"
            onClick={() => navigate('/freelancer/projects')}
            className="px-5 py-2.5 bg-deepBlue text-paper rounded-lg text-sm font-medium hover:bg-[#002E4A] transition-colors cursor-pointer"
          >
            Return to projects directory
          </button>
        </main>
      </div>
    );
  }

  const handleAccept = async () => {
    setIsProcessing(true);
    if (invitationId) {
      await projectService.acceptInvitation(invitationId);
      navigate(`/freelancer/projects/${project.id}`);
    } else {
      navigate('/freelancer/projects');
    }
    setIsProcessing(false);
  };

  const handleDecline = async () => {
    setIsProcessing(true);
    if (invitationId) await projectService.declineInvitation(invitationId);
    setIsProcessing(false);
    navigate('/freelancer/projects?tab=invitations');
  };

  const handleRequestToWork = async () => {
    if (!project) return;
    setIsProcessing(true);
    setRequestError('');
    setRequestSuccess('');
    try {
      const created = await projectService.requestToWork(project.id);
      setMyRequest(created);
      setRequestSuccess('Your request to work on this project has been submitted to the client!');
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : 'Unable to submit request.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-paper text-deepBlue font-sans">
      <FreelancerHeader
        breadcrumbs={[
          { label: 'Projects', path: '/freelancer/projects' },
          invitationId
            ? { label: 'Invitations', path: '/freelancer/projects?tab=invitations' }
            : { label: 'Open Briefs', path: '/freelancer/dashboard' },
          { label: project.title },
        ]}
        title={project.title}
        subtitle={
          invitationId
            ? `Client invitation from ${project.client}. Review milestone commitments and budget scope before confirming.`
            : `Open project brief from ${project.client}. Review milestone commitments, deliverables, and budget scope.`
        }
        dateLine={`Target Completion &middot; Due ${project.deadline}`}
      />

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-8 py-10 sm:py-14 space-y-10">
        {/* Core Brief Summary Card */}
        <section className="bg-paper border border-[#003C5F]/15 rounded-xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-[#003C5F]/10 pb-5">
            <div>
              <span className="text-[13px] uppercase tracking-wider text-[#455A6A] font-medium block">
                Issuing client
              </span>
              <p className="text-xl font-bold text-deepBlue">{project.client}</p>
            </div>

            <div className="text-left sm:text-right">
              <span className="text-[13px] uppercase tracking-wider text-[#455A6A] font-medium block">
                Fixed contract total
              </span>
              <span className="font-display text-3xl sm:text-4xl text-deepBlue">
                ${project.totalBudget.toLocaleString()}
              </span>
              <span className="text-[13px] text-[#455A6A] block mt-0.5">
                Divided across {project.milestones.length} milestone{project.milestones.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          <div>
            <h3 className="text-base font-semibold text-deepBlue mb-2">Project Brief</h3>
            <p className="text-[15px] text-[#455A6A] leading-relaxed max-w-[85ch]">
              {project.brief}
            </p>
          </div>

          {/* Skill Match Explanation */}
          <div className="p-4 rounded-xl bg-[#FAF8F3] border border-[#003C5F]/10 space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[14px] text-deepBlue">
                Why this was matched to you ({project.matchScore}% skill alignment)
              </span>
            </div>
            <p className="text-[13px] text-[#455A6A] leading-relaxed">
              {project.matchExplanation}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {(project.requiredSkills || []).map((skill: string) => (
                <span
                  key={skill}
                  className="text-[13px] px-2.5 py-1 rounded bg-paper text-deepBlue border border-[#003C5F]/15 font-medium"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Milestones Breakdown */}
        <section className="space-y-4">
          <div className="border-b border-[#003C5F]/15 pb-3">
            <h3 className="font-display text-2xl text-deepBlue">Scheduled milestones and deliverables</h3>
            <p className="text-[14px] text-[#455A6A] mt-1">
              Each milestone represents an independent scope and delivery cycle.
            </p>
          </div>

          <MilestoneList milestones={project.milestones} />
        </section>

        {requestSuccess && (
          <div role="status" className="p-4 rounded-xl bg-[#EAF5EF] border border-[#B2DAC3] text-[#24543A] text-[14px] font-medium">
            {requestSuccess}
          </div>
        )}
        {requestError && (
          <div role="alert" className="p-4 rounded-xl bg-[#FAF3E7] border border-[#E8D2AC] text-[#874E0E] text-[14px] font-medium">
            {requestError}
          </div>
        )}

        {/* Action Confirmation Bar */}
        <section className="p-6 rounded-xl bg-[#F6F3EC] border border-[#003C5F]/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-[15px] font-semibold text-deepBlue">
              {invitationId
                ? myRequest?.status === 'accepted'
                  ? 'Request Accepted — Confirm Your Availability'
                  : 'Confirm your availability'
                : project.status === 'active' || project.status === 'in_review' || project.status === 'completed'
                ? 'Assigned Project Workspace'
                : myRequest?.status === 'pending'
                ? 'Request Status: Pending Review'
                : myRequest?.status === 'declined'
                ? 'Request Status: Declined'
                : myRequest?.status === 'accepted'
                ? 'Request Status: Accepted'
                : 'Interested in this project?'}
            </h4>
            <p className="text-[13px] text-[#455A6A] mt-0.5">
              {invitationId
                ? myRequest?.status === 'accepted'
                  ? 'The hiring client approved your request! Accept the official invitation below to start working on the project.'
                  : 'Accepting moves this project to your active workspace. You can decline without penalty.'
                : project.status === 'active' || project.status === 'in_review' || project.status === 'completed'
                ? 'You are assigned to this project. Open your workspace to track deliverables and submit milestones.'
                : myRequest?.status === 'pending'
                ? 'You have submitted a request to work on this project. The client is currently reviewing your profile.'
                : myRequest?.status === 'declined'
                ? 'The hiring client decided not to move forward with this request for this project.'
                : myRequest?.status === 'accepted'
                ? 'The client accepted your project request. Your invitation will appear shortly.'
                : 'Send a request to the hiring client expressing your interest. If accepted, you will receive an invitation to commence work.'}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {invitationId ? (
              <>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleDecline}
                  className="min-h-[42px] px-5 py-2 rounded-lg border border-[#003C5F]/20 bg-paper text-deepBlue text-[14px] font-medium hover:bg-[#EAE4D6] transition-colors cursor-pointer disabled:opacity-50"
                >
                  Decline brief
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleAccept}
                  className="min-h-[42px] px-6 py-2 rounded-lg bg-deepBlue text-paper text-[14px] font-semibold hover:bg-[#002E4A] transition-colors cursor-pointer disabled:opacity-50"
                >
                  Accept invitation
                </button>
              </>
            ) : project.status === 'active' || project.status === 'in_review' || project.status === 'completed' ? (
              <button
                type="button"
                onClick={() => navigate(`/freelancer/projects/${project.id}`)}
                className="min-h-[42px] px-6 py-2 rounded-lg bg-deepBlue text-paper text-[14px] font-semibold hover:bg-[#002E4A] transition-colors cursor-pointer"
              >
                Open workspace &rarr;
              </button>
            ) : myRequest?.status === 'pending' ? (
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#FAF3E7] text-[#874E0E] border border-[#E8D2AC] text-[13px] font-semibold">
                  <span className="w-2 h-2 rounded-full bg-[#874E0E] animate-pulse" />
                  Pending client review
                </span>
                <button
                  type="button"
                  onClick={() => navigate('/freelancer/dashboard')}
                  className="min-h-[42px] px-4 py-2 rounded-lg border border-[#003C5F]/20 bg-paper text-deepBlue text-[14px] font-medium hover:bg-[#EAE4D6] transition-colors cursor-pointer"
                >
                  Return to dashboard
                </button>
              </div>
            ) : myRequest?.status === 'declined' ? (
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center px-3.5 py-2 rounded-lg bg-[#F1F5F9] text-[#64748B] border border-[#CBD5E1] text-[13px] font-medium">
                  Declined
                </span>
                <button
                  type="button"
                  onClick={() => navigate('/freelancer/dashboard')}
                  className="min-h-[42px] px-4 py-2 rounded-lg border border-[#003C5F]/20 bg-paper text-deepBlue text-[14px] font-medium hover:bg-[#EAE4D6] transition-colors cursor-pointer"
                >
                  Return to dashboard
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleRequestToWork}
                  className="min-h-[42px] px-6 py-2 rounded-lg bg-deepBlue text-paper text-[14px] font-semibold hover:bg-[#002E4A] transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isProcessing ? 'Submitting request…' : 'Request to Work on This Project'}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/freelancer/dashboard')}
                  className="min-h-[42px] px-4 py-2 rounded-lg border border-[#003C5F]/20 bg-paper text-deepBlue text-[14px] font-medium hover:bg-[#EAE4D6] transition-colors cursor-pointer"
                >
                  Return to dashboard
                </button>
              </div>
            )}
          </div>
        </section>
      </main>

      <Toast />
    </div>
  );
};
