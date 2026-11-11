import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FreelancerHeader } from '../shared/FreelancerHeader';
import { MilestoneList } from '../shared/MilestoneList';
import { Toast } from '../shared/Toast';
import { projectService } from '../../services/projectService';

export const InvitationPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>();
  const [invitationId, setInvitationId] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadInvitation = () => {
    if (!id) return;
    setIsLoading(true);
    setErrorMessage('');
    projectService
      .invitations()
      .then((invitations) => {
        const invitation = invitations.find(
          (item) => item.project_id === id && item.status === 'pending'
        );
        if (!invitation?.project) {
          setProject(null);
          return;
        }
        const p = invitation.project;
        const clientName =
          invitation.client_organization ||
          invitation.client_name ||
          p.client_organization ||
          p.client_name ||
          'Client Partner';

        setInvitationId(invitation.id);
        setProject({
          id: p.id,
          client: clientName,
          title: p.title,
          brief: p.description,
          totalBudget: p.budget_max ?? p.budget_min ?? 0,
          deadline: p.milestones.find((m) => m.due_date)?.due_date || 'Not set',
          matchScore: 0,
          matchExplanation: 'Direct project invitation from client.',
          requiredSkills: p.skills,
          milestones: p.milestones.map((m, index) => ({
            id: m.id,
            number: index + 1,
            title: m.title,
            amount: m.amount,
            dueDate: m.due_date || 'Not set',
            status: m.status,
            acceptanceCriteria: m.acceptance_criteria,
          })),
          status: 'invitation',
        });
        document.title = `PayPilot AI — Project Brief: ${p.title}`;
      })
      .catch((error) => {
        setErrorMessage(error instanceof Error ? error.message : 'Unable to load invitation.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    loadInvitation();
  }, [id]);

  const handleAccept = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setErrorMessage('');
    try {
      if (invitationId) {
        await projectService.acceptInvitation(invitationId);
        navigate(`/freelancer/projects/${project.id}`);
      } else {
        navigate('/freelancer/projects');
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to accept invitation. Please try again.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setErrorMessage('');
    try {
      if (invitationId) {
        await projectService.declineInvitation(invitationId);
      }
      navigate('/freelancer/projects?tab=invitations');
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to decline invitation. Please try again.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col bg-paper text-deepBlue font-sans">
        <FreelancerHeader
          title="Loading invitation..."
          breadcrumbs={[
            { label: 'Projects', path: '/freelancer/projects' },
            { label: 'Invitation' },
          ]}
        />
        <main className="max-w-[1280px] mx-auto px-4 py-20 text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#003C5F] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-[#455A6A]">Retrieving invitation details...</p>
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
            { label: 'Invitation' },
          ]}
        />
        <main className="max-w-[1280px] mx-auto px-4 py-16 text-center space-y-4">
          {errorMessage && (
            <div role="alert" className="max-w-md mx-auto p-4 rounded-xl bg-[#FAF3E7] border border-[#E8D2AC] text-sm text-[#874E0E]">
              {errorMessage}
            </div>
          )}
          <p className="text-[#455A6A]">This project invitation could not be located or has expired.</p>
          <button
            type="button"
            onClick={() => navigate('/freelancer/projects')}
            className="px-5 py-2.5 bg-deepBlue text-paper rounded-lg text-sm font-medium hover:bg-[#002E4A] transition-colors"
          >
            Return to projects directory
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col bg-paper text-deepBlue font-sans">
      <FreelancerHeader
        breadcrumbs={[
          { label: 'Projects', path: '/freelancer/projects' },
          { label: 'Invitations', path: '/freelancer/projects?tab=invitations' },
          { label: project.title },
        ]}
        title={project.title}
        subtitle={`Client invitation from ${project.client}. Review milestone commitments and budget scope before confirming.`}
        dateLine={`Invitation &middot; Due ${project.deadline}`}
      />

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-8 py-10 sm:py-14 space-y-10">
        {errorMessage && (
          <div role="alert" className="p-4 rounded-xl bg-[#FAF3E7] border border-[#E8D2AC] flex items-center justify-between">
            <span className="text-sm text-[#874E0E]">{errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage('')}
              className="text-xs font-semibold text-[#874E0E] underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        )}

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
                Divided across {project.milestones.length} milestones
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
                Required skills and match context
              </span>
            </div>
            <p className="text-[13px] text-[#455A6A] leading-relaxed">
              {project.matchExplanation}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {project.requiredSkills.map((skill: string) => (
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

        {/* Action Confirmation Bar */}
        <section className="p-6 rounded-xl bg-[#F6F3EC] border border-[#003C5F]/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-[15px] font-semibold text-deepBlue">Confirm your availability</h4>
            <p className="text-[13px] text-[#455A6A] mt-0.5">
              Accepting moves this project to your active workspace. You can decline without penalty.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleDecline}
              className="min-h-[42px] px-5 py-2 rounded-lg border border-[#003C5F]/20 bg-paper text-deepBlue text-[14px] font-medium hover:bg-[#EAE4D6] transition-colors cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? 'Processing...' : 'Decline brief'}
            </button>
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleAccept}
              className="min-h-[42px] px-6 py-2 rounded-lg bg-deepBlue text-paper text-[14px] font-semibold hover:bg-[#002E4A] transition-colors cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? 'Processing...' : 'Accept invitation'}
            </button>
          </div>
        </section>
      </main>

      <Toast />
    </div>
  );
};
