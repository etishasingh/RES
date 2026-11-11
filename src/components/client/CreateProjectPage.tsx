import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClientHeader } from '../shared/ClientHeader';
import { useReveal } from '../../hooks/useReveal';
import { projectService } from '../../services/projectService';

interface FormMilestone {
  id: string;
  title: string;
  amount: string;
  dueDate: string;
  criteriaText: string;
}

export const CreateProjectPage: React.FC = () => {
  const navigate = useNavigate();
  const { ref: formRef } = useReveal<HTMLDivElement>();
  const [submitError, setSubmitError] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [skillsInput, setSkillsInput] = useState('React, TypeScript, Tailwind CSS');
  const [budget, setBudget] = useState('6000');
  const [deadline, setDeadline] = useState('2026-12-15');

  const [milestones, setMilestones] = useState<FormMilestone[]>([
    {
      id: 'm-temp-1',
      title: 'Phase 1: Architecture, Core Components and API contracts',
      amount: '2000',
      dueDate: '2026-11-05',
      criteriaText: 'Architecture diagram approved\nCore design tokens configured\nAPI schemas aligned',
    },
    {
      id: 'm-temp-2',
      title: 'Phase 2: Functional Features and State Integration',
      amount: '2500',
      dueDate: '2026-11-25',
      criteriaText: 'Component interactions wired to store\nEdge case error handling\nResponsive views 360px to 1440px',
    },
    {
      id: 'm-temp-3',
      title: 'Phase 3: QA, Performance and Documentation',
      amount: '1500',
      dueDate: '2026-12-15',
      criteriaText: 'Test suites passing\nPerformance audits meet targets\nDeployment runbook documented',
    },
  ]);

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculations
  const numericBudget = parseFloat(budget) || 0;
  const milestonesTotal = milestones.reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0);
  const budgetDifference = numericBudget - milestonesTotal;
  const isBudgetBalanced = numericBudget > 0 && Math.abs(budgetDifference) < 0.01;

  const handleAddMilestone = () => {
    const nextIdx = milestones.length + 1;
    const newMilestone: FormMilestone = {
      id: `m-temp-${Date.now()}`,
      title: `Phase ${nextIdx}: Deliverable ${nextIdx}`,
      amount: '0',
      dueDate: deadline || '2026-12-31',
      criteriaText: 'Functional delivery and client review',
    };
    setMilestones([...milestones, newMilestone]);
  };

  const handleRemoveMilestone = (id: string) => {
    if (milestones.length <= 1) {
      setSubmitError('A project must contain at least one milestone.');
      return;
    }
    setMilestones(milestones.filter((m) => m.id !== id));
  };

  const handleMilestoneChange = (
    id: string,
    field: keyof FormMilestone,
    value: string
  ) => {
    setMilestones(
      milestones.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (!title.trim()) {
      setFormError('Please enter a project title.');
      return;
    }
    if (!description.trim()) {
      setFormError('Please provide a project description and objectives.');
      return;
    }
    if (numericBudget <= 0) {
      setFormError('Total budget must be greater than zero.');
      return;
    }
    if (!deadline) {
      setFormError('Please select a project target completion deadline.');
      return;
    }
    if (milestones.length === 0) {
      setFormError('Please configure at least one milestone for this project.');
      return;
    }

    // Check individual milestone fields
    for (let i = 0; i < milestones.length; i++) {
      const m = milestones[i];
      if (!m.title.trim()) {
        setFormError(`Milestone #${i + 1} requires a descriptive title.`);
        return;
      }
      const amt = parseFloat(m.amount) || 0;
      if (amt <= 0) {
        setFormError(`Milestone #${i + 1} must have an allocated amount greater than zero.`);
        return;
      }
      if (!m.dueDate) {
        setFormError(`Milestone #${i + 1} requires a scheduled due date.`);
        return;
      }
    }

    // Check budget sum
    if (!isBudgetBalanced) {
      setFormError(
        `The sum of milestone amounts ($${milestonesTotal.toLocaleString()}) must exactly match the project budget ($${numericBudget.toLocaleString()}). Difference: ${
          budgetDifference > 0
            ? `$${budgetDifference.toLocaleString()} unallocated`
            : `$${Math.abs(budgetDifference).toLocaleString()} over budget`
        }.`
      );
      return;
    }

    setIsSubmitting(true);

    const parsedSkills = skillsInput
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const preparedMilestones = milestones.map((m) => {
      const criteriaList = m.criteriaText
        .split('\n')
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

      return {
        title: m.title.trim(),
        description: null,
        amount: parseFloat(m.amount) || 0,
        due_date: m.dueDate || null,
        acceptance_criteria:
          criteriaList.length > 0 ? criteriaList : ['Deliverable submitted and reviewed.'],
      };
    });

    setSubmitError('');
    try {
      await projectService.create({
        title: title.trim(), description: description.trim(),
        skills: parsedSkills.length > 0 ? parsedSkills : ['Full Stack Development'],
        budget_min: numericBudget, budget_max: numericBudget, status: 'open', milestones: preparedMilestones,
      });
      navigate('/client/dashboard');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to create project.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#1E293B]">
      <ClientHeader
        breadcrumbs={[
          { label: 'Dashboard', path: '/client/dashboard' },
          { label: 'Projects', path: '/client/projects' },
          { label: 'New Project' },
        ]}
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div ref={formRef} className="space-y-8">
          {submitError && <p role="alert" className="text-sm text-[#874E0E]">{submitError}</p>}
          {/* Header context */}
          <div className="border-b border-[#003C5F]/15 pb-6">
            <span className="text-[13px] font-semibold text-[#003C5F] tracking-wide uppercase">
              Project Specification
            </span>
            <h1 className="font-display text-3xl sm:text-4xl text-deepBlue mt-1">
              Create a New Project
            </h1>
            <p className="text-[#455A6A] text-sm mt-2 max-w-2xl leading-relaxed">
              Define the scope, deliverables, and financial milestones. Each milestone will have
              explicit acceptance criteria so your assigned freelancer knows exactly what is expected.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-8">
            {formError && (
              <div
                role="alert"
                className="p-4 rounded-xl bg-[#FDF2F2] border border-[#F5C2C2] text-[#9E3C3C] text-sm font-medium flex items-start gap-3"
              >
                <svg
                  className="w-5 h-5 flex-shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" strokeWidth="2" />
                  <line x1="12" y1="8" x2="12" y2="12" strokeWidth="2" />
                  <circle cx="12" cy="16" r="1" fill="currentColor" />
                </svg>
                <span>{formError}</span>
              </div>
            )}

            {/* Section 1: Overview */}
            <div className="bg-paper border border-[#003C5F]/15 rounded-xl p-6 space-y-6">
              <h2 className="font-display text-2xl text-deepBlue border-b border-[#003C5F]/10 pb-3">
                1. Project Overview
              </h2>

              <div className="space-y-4">
                <div>
                  <label htmlFor="project-title" className="block text-[13px] font-semibold text-deepBlue mb-1.5">
                    Project Title <span className="text-[#9E3C3C]">*</span>
                  </label>
                  <input
                    id="project-title"
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Enterprise Billing Portal Frontend"
                    className="w-full px-4 py-2.5 rounded-lg border border-[#003C5F]/20 bg-[#FDFBF7] text-[#1E293B] text-sm focus:outline-none focus:ring-2 focus:ring-[#003C5F]"
                  />
                </div>

                <div>
                  <label htmlFor="project-desc" className="block text-[13px] font-semibold text-deepBlue mb-1.5">
                    Description & Deliverables <span className="text-[#9E3C3C]">*</span>
                  </label>
                  <textarea
                    id="project-desc"
                    rows={4}
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the background, target features, engineering standards, and specific deliverables required."
                    className="w-full px-4 py-2.5 rounded-lg border border-[#003C5F]/20 bg-[#FDFBF7] text-[#1E293B] text-sm focus:outline-none focus:ring-2 focus:ring-[#003C5F]"
                  />
                </div>

                <div>
                  <label htmlFor="project-skills" className="block text-[13px] font-semibold text-deepBlue mb-1.5">
                    Required Skills (comma separated)
                  </label>
                  <input
                    id="project-skills"
                    type="text"
                    value={skillsInput}
                    onChange={(e) => setSkillsInput(e.target.value)}
                    placeholder="e.g., React, TypeScript, Tailwind CSS, REST APIs"
                    className="w-full px-4 py-2.5 rounded-lg border border-[#003C5F]/20 bg-[#FDFBF7] text-[#1E293B] text-sm focus:outline-none focus:ring-2 focus:ring-[#003C5F]"
                  />
                  <p className="text-[13px] text-[#455A6A] mt-1">
                    These help match qualified talent in your freelancer directory.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 2: Financials & Timeline */}
            <div className="bg-paper border border-[#003C5F]/15 rounded-xl p-6 space-y-6">
              <h2 className="font-display text-2xl text-deepBlue border-b border-[#003C5F]/10 pb-3">
                2. Budget & Timeline
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="project-budget" className="block text-[13px] font-semibold text-deepBlue mb-1.5">
                    Total Project Budget (USD) <span className="text-[#9E3C3C]">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-[#455A6A] font-semibold text-sm">
                      $
                    </span>
                    <input
                      id="project-budget"
                      type="number"
                      min="0.01"
                      max="9999999999.99"
                      step="0.01"
                      required
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      className="w-full pl-8 pr-4 py-2.5 rounded-lg border border-[#003C5F]/20 bg-[#FDFBF7] text-[#1E293B] text-sm focus:outline-none focus:ring-2 focus:ring-[#003C5F]"
                    />
                  </div>
                  <p className="text-[13px] text-[#455A6A] mt-1">
                    All milestone allocations must sum up to this total budget.
                  </p>
                </div>

                <div>
                  <label htmlFor="project-deadline" className="block text-[13px] font-semibold text-deepBlue mb-1.5">
                    Final Completion Target <span className="text-[#9E3C3C]">*</span>
                  </label>
                  <input
                    id="project-deadline"
                    type="date"
                    required
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-[#003C5F]/20 bg-[#FDFBF7] text-[#1E293B] text-sm focus:outline-none focus:ring-2 focus:ring-[#003C5F]"
                  />
                  <p className="text-[13px] text-[#455A6A] mt-1">
                    Overall project milestone completion schedule.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 3: Milestones & Acceptance Criteria */}
            <div className="bg-paper border border-[#003C5F]/15 rounded-xl p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#003C5F]/10 pb-4">
                <div>
                  <h2 className="font-display text-2xl text-deepBlue">
                    3. Milestone Breakdown
                  </h2>
                  <p className="text-[#455A6A] text-sm mt-0.5">
                    Divide your project into reviewable phases with distinct criteria.
                  </p>
                </div>

                {/* Live balance indicator */}
                <div
                  className={`px-4 py-2 rounded-lg border text-sm font-medium flex items-center gap-2 ${
                    isBudgetBalanced
                      ? 'bg-[#EAF5EF] text-[#24543A] border-[#B2DAC3]'
                      : 'bg-[#FAF3E7] text-[#874E0E] border-[#E8D2AC]'
                  }`}
                >
                  <span className="font-display text-base">
                    ${milestonesTotal.toLocaleString()} of ${numericBudget.toLocaleString()}
                  </span>
                  <span>
                    {isBudgetBalanced
                      ? '(Balanced)'
                      : budgetDifference > 0
                      ? `($${budgetDifference.toLocaleString()} left)`
                      : `($${Math.abs(budgetDifference).toLocaleString()} over)`}
                  </span>
                </div>
              </div>

              {/* Milestone Rows */}
              <div className="space-y-6">
                {milestones.map((m, index) => (
                  <div
                    key={m.id}
                    className="p-5 rounded-xl border border-[#003C5F]/15 bg-[#FDFBF7] space-y-4 relative"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-[#003C5F]/10 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-[#003C5F] text-[#FDFBF7] flex items-center justify-center text-xs font-bold">
                          {index + 1}
                        </span>
                        <span className="font-semibold text-deepBlue text-sm">
                          Milestone #{index + 1}
                        </span>
                      </div>

                      {milestones.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMilestone(m.id)}
                          className="text-xs text-[#9E3C3C] hover:text-[#7A2A2A] font-semibold py-1 px-2.5 rounded hover:bg-[#FDF2F2] transition-colors"
                          aria-label={`Remove milestone ${index + 1}`}
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="sm:col-span-2">
                        <label
                          htmlFor={`m-title-${m.id}`}
                          className="block text-[13px] font-semibold text-deepBlue mb-1"
                        >
                          Milestone Title <span className="text-[#9E3C3C]">*</span>
                        </label>
                        <input
                          id={`m-title-${m.id}`}
                          type="text"
                          required
                          value={m.title}
                          onChange={(e) => handleMilestoneChange(m.id, 'title', e.target.value)}
                          placeholder="e.g., Core Components & Design System"
                          className="w-full px-3 py-2 rounded-lg border border-[#003C5F]/20 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#003C5F]"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`m-amount-${m.id}`}
                          className="block text-[13px] font-semibold text-deepBlue mb-1"
                        >
                          Amount (USD) <span className="text-[#9E3C3C]">*</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-[#455A6A] font-semibold text-sm">
                            $
                          </span>
                          <input
                            id={`m-amount-${m.id}`}
                            type="number"
                            min="1"
                            step="0.01"
                            required
                            value={m.amount}
                            onChange={(e) => handleMilestoneChange(m.id, 'amount', e.target.value)}
                            className="w-full pl-7 pr-3 py-2 rounded-lg border border-[#003C5F]/20 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#003C5F]"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label
                          htmlFor={`m-date-${m.id}`}
                          className="block text-[13px] font-semibold text-deepBlue mb-1"
                        >
                          Target Due Date <span className="text-[#9E3C3C]">*</span>
                        </label>
                        <input
                          id={`m-date-${m.id}`}
                          type="date"
                          required
                          value={m.dueDate}
                          onChange={(e) => handleMilestoneChange(m.id, 'dueDate', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-[#003C5F]/20 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#003C5F]"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label
                          htmlFor={`m-criteria-${m.id}`}
                          className="block text-[13px] font-semibold text-deepBlue mb-1"
                        >
                          Acceptance Criteria (one per line)
                        </label>
                        <textarea
                          id={`m-criteria-${m.id}`}
                          rows={3}
                          value={m.criteriaText}
                          onChange={(e) => handleMilestoneChange(m.id, 'criteriaText', e.target.value)}
                          placeholder="e.g., Pull request approved with 90%+ test coverage&#10;Zero critical lint warnings&#10;Responsive across mobile and desktop"
                          className="w-full px-3 py-2 rounded-lg border border-[#003C5F]/20 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#003C5F]"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddMilestone}
                  className="w-full py-3 border-2 border-dashed border-[#003C5F]/30 hover:border-[#003C5F] rounded-xl text-deepBlue font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#003C5F]/5 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <line x1="12" y1="5" x2="12" y2="19" strokeWidth="2" strokeLinecap="round" />
                    <line x1="5" y1="12" x2="19" y2="12" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Add Milestone Phase
                </button>
              </div>
            </div>

            {submitError && (
              <div
                role="alert"
                className="p-4 rounded-xl bg-[#FAF3E7] border border-[#E8D2AC] text-[#874E0E] text-sm font-medium"
              >
                {submitError}
              </div>
            )}

            {/* Validation Notice & Submit Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-[#003C5F]/15">
              <div className="text-sm text-[#455A6A]">
                {isBudgetBalanced ? (
                  <span className="text-[#24543A] font-semibold flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    All milestones are balanced and ready to save.
                  </span>
                ) : (
                  <span className="text-[#874E0E] font-medium">
                    Adjust milestone amounts to match total budget of ${numericBudget.toLocaleString()}.
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => navigate('/client/dashboard')}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-lg border border-[#003C5F]/20 text-[#003C5F] text-sm font-semibold hover:bg-[#003C5F]/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isBudgetBalanced || isSubmitting}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-[#003C5F] text-[#FDFBF7] text-sm font-semibold hover:bg-[#002B45] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  {isSubmitting ? 'Saving Project...' : 'Save & Publish Project'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};
