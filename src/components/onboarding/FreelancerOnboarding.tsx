import React, { useState, useEffect } from 'react';
import {
  FreelancerProfile,
  ExperienceLevel,
  SkillProficiencyLevel,
  RemotePreference,
} from '../../types/profile';
import { profileService, EMPTY_PROFILE } from '../../services/profileService';
import { PREDEFINED_SKILLS } from '../SkillSelector';

interface FreelancerOnboardingProps {
  initialProfile?: Partial<FreelancerProfile>;
  onComplete?: (profile: FreelancerProfile) => void;
  onExit?: () => void;
}

const EXPERIENCE_LEVELS: {
  level: ExperienceLevel;
  title: string;
  yearsRange: string;
  description: string;
}[] = [
  {
    level: 'beginner',
    title: 'Beginner',
    yearsRange: '0–1 years',
    description: 'Starting out or transitioning into a new domain. Eager to take on foundational projects.',
  },
  {
    level: 'junior',
    title: 'Junior',
    yearsRange: '1–2 years',
    description: 'Some industry or freelance experience. Capable of building features with guidance.',
  },
  {
    level: 'intermediate',
    title: 'Intermediate',
    yearsRange: '3–5 years',
    description: 'Autonomous problem solver with proven track record across independent milestones.',
  },
  {
    level: 'senior',
    title: 'Senior',
    yearsRange: '5–8 years',
    description: 'Deep technical and domain mastery. Delivers complex architectures and mentors others.',
  },
  {
    level: 'expert',
    title: 'Expert',
    yearsRange: '8+ years',
    description: 'Industry authority. Leads enterprise deliverables, high-stakes system design, and advisory.',
  },
];

const PROFICIENCY_OPTIONS: SkillProficiencyLevel[] = [
  'Beginner',
  'Intermediate',
  'Advanced',
  'Expert',
];

const PREDEFINED_CAREER_GOALS = [
  'Work with international clients',
  'Transition to Machine Learning & AI',
  'Secure high-ticket fixed-price deliverables',
  'Build a sustainable recurring retainer base',
  'Accelerate technical skill mastery',
  'Achieve top-rated verified milestone completion',
];

const WORK_TYPES = [
  'Fixed-price milestones',
  'Part-time remote contracts',
  'Full-time freelance',
  'Consulting & code review',
];

export const FreelancerOnboarding: React.FC<FreelancerOnboardingProps> = ({
  initialProfile,
  onComplete,
  onExit,
}) => {
  // Stepper state (1: Experience & Roles, 2: Skills & Proficiency, 3: Availability & Work, 4: Review & Confirm)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State
  const [profile, setProfile] = useState<FreelancerProfile>(EMPTY_PROFILE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedSuccess, setCompletedSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Skill editing state inside Step 2
  const [newSkillInput, setNewSkillInput] = useState('');
  const [customGoalInput, setCustomGoalInput] = useState('');

  // Load existing profile from service on mount
  useEffect(() => {
    let isMounted = true;
    profileService.getProfile().then((data) => {
      if (!isMounted) return;
      const initialSkills = data.skills || [];
      const initialProf = { ...(data.skill_proficiency || {}) };
      initialSkills.forEach((s) => {
        if (!initialProf[s]) initialProf[s] = 'Intermediate';
      });
      setProfile((prev) => ({
        ...prev,
        ...data,
        skill_proficiency: initialProf,
        ...(initialProfile || {}),
      }));
    });
    return () => {
      isMounted = false;
    };
  }, [initialProfile]);

  // Validation per step
  const validateStep = (step: number): boolean => {
    const stepErrors: Record<string, string> = {};

    if (step === 1) {
      if (!profile.primary_role.trim()) {
        stepErrors.primary_role = 'Primary role title is required.';
      }
      if (!profile.desired_role.trim()) {
        stepErrors.desired_role = 'Desired role or focus is required.';
      }
      if (profile.experience_years < 0 || isNaN(profile.experience_years)) {
        stepErrors.experience_years = 'Please enter a valid number of years.';
      }
      if (!profile.experience_level) {
        stepErrors.experience_level = 'Please select your current experience tier.';
      }
    }

    if (step === 2) {
      if (profile.skills.length === 0) {
        stepErrors.skills = 'At least one skill must be selected for matching.';
      }
      // Ensure all selected skills have a proficiency level assigned
      for (const skill of profile.skills) {
        if (!profile.skill_proficiency[skill]) {
          stepErrors[`proficiency_${skill}`] = `Please assign a proficiency level for ${skill}.`;
        }
      }
    }

    if (step === 3) {
      if (!profile.available_hours_per_week || profile.available_hours_per_week <= 0) {
        stepErrors.available_hours_per_week = 'Available hours must be greater than 0.';
      }
      if (profile.available_hours_per_week > 80) {
        stepErrors.available_hours_per_week = 'Available hours cannot exceed 80 hrs/week.';
      }
      if (profile.budget < 0 || isNaN(profile.budget)) {
        stepErrors.budget = 'Learning budget cannot be negative.';
      }
      if (profile.preferred_work_type.length === 0) {
        stepErrors.preferred_work_type = 'Select at least one preferred work arrangement.';
      }
      if (profile.hourly_rate < 0 || isNaN(profile.hourly_rate)) {
        stepErrors.hourly_rate = 'Hourly rate must be zero or greater.';
      }
      if (!profile.availability_status) {
        stepErrors.availability_status = 'Select your current availability.';
      }
    }

    if (step === 4) {
      if (profile.career_goals.length === 0) {
        stepErrors.career_goals = 'Please select or add at least one career goal.';
      }
    }

    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < 4) {
        setCurrentStep((prev) => (prev + 1) as 1 | 2 | 3 | 4);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3 | 4);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleAddSkill = (skillToAdd: string) => {
    const trimmed = skillToAdd.trim();
    if (!trimmed) return;
    if (profile.skills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) return;

    const updatedSkills = [...profile.skills, trimmed];
    setProfile((prev) => ({
      ...prev,
      skills: updatedSkills,
      skill_proficiency: {
        ...prev.skill_proficiency,
        [trimmed]: 'Intermediate', // Default sensible tier
      },
    }));
    setNewSkillInput('');
    if (errors.skills) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.skills;
        return next;
      });
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    const updatedSkills = profile.skills.filter((s) => s !== skillToRemove);
    const updatedProf = { ...profile.skill_proficiency };
    delete updatedProf[skillToRemove];

    setProfile((prev) => ({
      ...prev,
      skills: updatedSkills,
      skill_proficiency: updatedProf,
    }));
  };

  const handleProficiencyChange = (skill: string, level: SkillProficiencyLevel) => {
    setProfile((prev) => ({
      ...prev,
      skill_proficiency: {
        ...prev.skill_proficiency,
        [skill]: level,
      },
    }));
  };

  const toggleCareerGoal = (goal: string) => {
    const exists = profile.career_goals.includes(goal);
    setProfile((prev) => ({
      ...prev,
      career_goals: exists
        ? prev.career_goals.filter((g) => g !== goal)
        : [...prev.career_goals, goal],
    }));
  };

  const handleAddCustomGoal = () => {
    const trimmed = customGoalInput.trim();
    if (!trimmed) return;
    if (!profile.career_goals.includes(trimmed)) {
      setProfile((prev) => ({
        ...prev,
        career_goals: [...prev.career_goals, trimmed],
      }));
    }
    setCustomGoalInput('');
  };

  const toggleWorkType = (type: string) => {
    const exists = profile.preferred_work_type.includes(type);
    setProfile((prev) => ({
      ...prev,
      preferred_work_type: exists
        ? prev.preferred_work_type.filter((t) => t !== type)
        : [...prev.preferred_work_type, type],
    }));
  };

  const handleFinalSubmit = async () => {
    if (!validateStep(4)) return;

    setIsSubmitting(true);
    try {
      const response = await profileService.completeOnboarding(profile);
      setCompletedSuccess(true);
      onComplete?.(response.profile);
    } catch (err: unknown) {
      setErrors({
        submit: err instanceof Error ? err.message : 'Failed to finalize profile.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#0F172A] flex flex-col font-body">
      {/* Top Header with Deep Blue Branding & Exit */}
      <header className="w-full bg-[#003C5F] text-white px-5 sm:px-8 py-4 shadow-sm border-b border-[#002E4A]">
        <div className="max-w-[1120px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-display text-2xl tracking-tight text-white">
              PayPilot AI
            </span>
            <span className="hidden sm:inline-block h-4 w-[1px] bg-white/30" />
            <span className="hidden sm:inline-block text-xs uppercase tracking-wider text-white/80 font-medium">
              Freelancer Onboarding
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span className="bg-white/10 text-white/90 px-3 py-1 rounded-full border border-white/20 font-medium">
              Step {currentStep} of 4
            </span>
            {onExit && (
              <button
                type="button"
                onClick={onExit}
                className="text-white/80 hover:text-white transition-colors underline underline-offset-2 cursor-pointer"
              >
                Exit to Home
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Progress Stepper Bar */}
      <div className="w-full bg-[#F4EFE6] border-b border-[#E6DEC9] py-3 px-5 sm:px-8">
        <div className="max-w-[1120px] mx-auto">
          <ol className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-medium">
            <li
              className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
                currentStep === 1
                  ? 'bg-white shadow-sm text-[#003C5F] font-semibold border border-[#E6DEC9]'
                  : currentStep > 1
                  ? 'text-[#003C5F]/80'
                  : 'text-slate-400'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                  currentStep >= 1 ? 'bg-[#003C5F] text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                1
              </span>
              <span className="truncate">Experience & Roles</span>
            </li>

            <li
              className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
                currentStep === 2
                  ? 'bg-white shadow-sm text-[#003C5F] font-semibold border border-[#E6DEC9]'
                  : currentStep > 2
                  ? 'text-[#003C5F]/80'
                  : 'text-slate-400'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                  currentStep >= 2 ? 'bg-[#003C5F] text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                2
              </span>
              <span className="truncate">Skills & Proficiency</span>
            </li>

            <li
              className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
                currentStep === 3
                  ? 'bg-white shadow-sm text-[#003C5F] font-semibold border border-[#E6DEC9]'
                  : currentStep > 3
                  ? 'text-[#003C5F]/80'
                  : 'text-slate-400'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                  currentStep >= 3 ? 'bg-[#003C5F] text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                3
              </span>
              <span className="truncate">Availability & Work</span>
            </li>

            <li
              className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
                currentStep === 4
                  ? 'bg-white shadow-sm text-[#003C5F] font-semibold border border-[#E6DEC9]'
                  : 'text-slate-400'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                  currentStep === 4 ? 'bg-[#003C5F] text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                4
              </span>
              <span className="truncate">Review & Confirm</span>
            </li>
          </ol>
        </div>
      </div>

      {/* Main Content Form Surface */}
      <main className="flex-1 max-w-[1120px] w-full mx-auto px-5 sm:px-8 py-8 sm:py-12">
        {completedSuccess ? (
          <div className="bg-white rounded-2xl border border-emerald-200 p-8 sm:p-12 shadow-sm text-center max-w-2xl mx-auto">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
              ✓
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#003C5F] mb-3">
              Freelancer Profile Verified
            </h1>
            <p className="text-slate-600 text-sm leading-relaxed mb-6">
              Your profile, skill proficiencies, and experience parameters have been saved. Your profile is now primed for ProofFlow AI opportunity and course recommendations.
            </p>

            <div className="bg-[#FDFBF7] border border-[#E6DEC9] rounded-xl p-5 text-left text-xs space-y-2 mb-8">
              <div className="flex justify-between">
                <span className="text-slate-500">Freelancer Name:</span>
                <span className="font-semibold text-slate-800">{profile.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Experience Tier:</span>
                <span className="font-semibold text-slate-800 capitalize">
                  {profile.experience_level} ({profile.experience_years} yrs)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Verified Skills ({profile.skills.length}):</span>
                <span className="font-semibold text-slate-800">
                  {profile.skills.join(', ')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Pace & Budget:</span>
                <span className="font-semibold text-slate-800">
                  {profile.available_hours_per_week} hrs/week • ₹{profile.budget.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Re-edit Profile
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.hash = '#/freelancer/dashboard';
                  onComplete?.(profile);
                }}
                className="px-6 py-2.5 rounded-xl bg-[#003C5F] text-white text-sm font-semibold hover:bg-[#002E4A] transition-all shadow-sm cursor-pointer"
              >
                Proceed to Freelancer Flight Deck (Task 2)
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#E6DEC9] p-6 sm:p-10 shadow-sm">
            {/* Step 1: Experience Level & Role Definition */}
            {currentStep === 1 && (
              <section aria-labelledby="step-1-heading" className="space-y-6">
                <div>
                  <h1 id="step-1-heading" className="text-2xl sm:text-3xl font-bold text-[#003C5F] tracking-tight mb-2">
                    Experience Level & Roles
                  </h1>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    ProofFlow AI matches you with opportunities that fit your seniority and career trajectories. Tell us where you currently stand.
                  </p>
                </div>

                {/* Professional Headline Review */}
                <div className="space-y-1.5">
                  <label htmlFor="onboarding-headline" className="block text-xs font-semibold text-slate-800">
                    Professional Headline <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="onboarding-headline"
                    type="text"
                    value={profile.headline}
                    onChange={(e) => setProfile({ ...profile, headline: e.target.value })}
                    placeholder="e.g. Full-Stack Developer & Aspiring AI Engineer"
                    className="w-full h-11 px-3.5 rounded-xl text-sm border border-slate-300 bg-white text-slate-900 focus-visible:ring-2 focus-visible:ring-[#003C5F] focus-visible:border-transparent transition-all"
                  />
                  <p className="text-[11px] text-slate-500">
                    A concise summary displayed on your public proposal cards and bids.
                  </p>
                </div>

                {/* Primary Role & Desired Role Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="primary-role" className="block text-xs font-semibold text-slate-800">
                      Primary Role <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="primary-role"
                      type="text"
                      value={profile.primary_role}
                      onChange={(e) => setProfile({ ...profile, primary_role: e.target.value })}
                      placeholder="e.g. Full-Stack Developer"
                      aria-invalid={!!errors.primary_role}
                      aria-describedby={errors.primary_role ? 'primary-role-error' : undefined}
                      className={`w-full h-11 px-3.5 rounded-xl text-sm border bg-white text-slate-900 focus-visible:ring-2 focus-visible:ring-[#003C5F] focus-visible:border-transparent ${
                        errors.primary_role ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300'
                      }`}
                    />
                    {errors.primary_role && (
                      <p id="primary-role-error" role="alert" className="text-red-600 text-xs">
                        {errors.primary_role}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="desired-role" className="block text-xs font-semibold text-slate-800">
                      Target / Desired Role <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="desired-role"
                      type="text"
                      value={profile.desired_role}
                      onChange={(e) => setProfile({ ...profile, desired_role: e.target.value })}
                      placeholder="e.g. AI Application Engineer"
                      aria-invalid={!!errors.desired_role}
                      aria-describedby={errors.desired_role ? 'desired-role-error' : undefined}
                      className={`w-full h-11 px-3.5 rounded-xl text-sm border bg-white text-slate-900 focus-visible:ring-2 focus-visible:ring-[#003C5F] focus-visible:border-transparent ${
                        errors.desired_role ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300'
                      }`}
                    />
                    {errors.desired_role && (
                      <p id="desired-role-error" role="alert" className="text-red-600 text-xs">
                        {errors.desired_role}
                      </p>
                    )}
                  </div>
                </div>

                {/* Years of Experience Input */}
                <div className="space-y-1.5">
                  <label htmlFor="experience-years" className="block text-xs font-semibold text-slate-800">
                    Total Years of Commercial / Freelance Experience
                  </label>
                  <input
                    id="experience-years"
                    type="number"
                    min="0"
                    max="40"
                    step="0.5"
                    value={profile.experience_years}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        experience_years: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full sm:w-48 h-11 px-3.5 rounded-xl text-sm border border-slate-300 bg-white text-slate-900 focus-visible:ring-2 focus-visible:ring-[#003C5F]"
                  />
                </div>

                {/* Experience Level Selection Cards */}
                <div className="space-y-2.5 pt-2">
                  <label className="block text-xs font-semibold text-slate-800">
                    Select Your Experience Tier <span className="text-red-500">*</span>
                  </label>
                  <div
                    role="radiogroup"
                    aria-label="Experience Level Tier"
                    className="grid grid-cols-1 md:grid-cols-5 gap-3"
                  >
                    {EXPERIENCE_LEVELS.map((item) => {
                      const isSelected = profile.experience_level === item.level;
                      return (
                        <button
                          key={item.level}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          onClick={() => setProfile({ ...profile, experience_level: item.level })}
                          className={`p-4 rounded-xl border text-left transition-all duration-150 cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'border-[#003C5F] bg-[#003C5F]/5 ring-2 ring-[#003C5F]'
                              : 'border-slate-200 bg-white hover:border-[#003C5F]/40 hover:bg-slate-50'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-sm text-[#003C5F]">{item.title}</span>
                              {isSelected && (
                                <span className="w-2.5 h-2.5 rounded-full bg-[#003C5F]" />
                              )}
                            </div>
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 mb-2">
                              {item.yearsRange}
                            </span>
                            <p className="text-[11px] text-slate-600 leading-normal">
                              {item.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {errors.experience_level && (
                    <p role="alert" className="text-red-600 text-xs mt-1">
                      {errors.experience_level}
                    </p>
                  )}
                </div>
              </section>
            )}

            {/* Step 2: Skills & Proficiency Review */}
            {currentStep === 2 && (
              <section aria-labelledby="step-2-heading" className="space-y-6">
                <div>
                  <h1 id="step-2-heading" className="text-2xl sm:text-3xl font-bold text-[#003C5F] tracking-tight mb-2">
                    Review Skills & Set Proficiency
                  </h1>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    ProofFlow Recommendation Engine factors skill proficiency into match scores: Advanced/Expert skills receive full weighting, while foundational skills receive proportional scoring.
                  </p>
                </div>

                {/* Selected Skills with Individual Proficiency Selectors */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800 uppercase tracking-wide">
                      Active Skills ({profile.skills.length})
                    </span>
                    <span className="text-xs text-slate-500">
                      Assign proficiency for optimal match ranking
                    </span>
                  </div>

                  {errors.skills && (
                    <p role="alert" className="text-red-600 text-xs">
                      {errors.skills}
                    </p>
                  )}
                  {Object.keys(errors)
                    .filter((k) => k.startsWith('proficiency_'))
                    .map((k) => (
                      <p key={k} role="alert" className="text-red-600 text-xs">
                        {errors[k]}
                      </p>
                    ))}

                  <div className="space-y-2.5">
                    {profile.skills.map((skill) => {
                      const currentProf = profile.skill_proficiency[skill] || 'Intermediate';
                      return (
                        <div
                          key={skill}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200 bg-[#FDFBF7]"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-[#003C5F]">{skill}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveSkill(skill)}
                              aria-label={`Remove skill ${skill}`}
                              className="text-slate-400 hover:text-red-600 text-xs p-1 rounded transition-colors"
                            >
                              ✕
                            </button>
                          </div>

                          {/* Proficiency Radios / Pills */}
                          <div
                            role="radiogroup"
                            aria-label={`Proficiency for ${skill}`}
                            className="flex items-center gap-1.5 flex-wrap"
                          >
                            {PROFICIENCY_OPTIONS.map((opt) => {
                              const isProfSelected = currentProf === opt;
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  role="radio"
                                  aria-checked={isProfSelected}
                                  onClick={() => handleProficiencyChange(skill, opt)}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                                    isProfSelected
                                      ? 'bg-[#003C5F] text-white shadow-sm font-semibold'
                                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                                  }`}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Add More Skills from Catalog or Custom */}
                <div className="pt-4 border-t border-slate-200 space-y-3">
                  <label htmlFor="add-new-skill" className="block text-xs font-semibold text-slate-800">
                    Add More Skills
                  </label>
                  <div className="flex items-center gap-2 max-w-md">
                    <input
                      id="add-new-skill"
                      type="text"
                      value={newSkillInput}
                      onChange={(e) => setNewSkillInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSkill(newSkillInput);
                        }
                      }}
                      placeholder="e.g. Next.js, PyTorch, Docker"
                      className="flex-1 h-10 px-3 rounded-xl text-sm border border-slate-300 bg-white text-slate-900 focus-visible:ring-2 focus-visible:ring-[#003C5F]"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddSkill(newSkillInput)}
                      disabled={!newSkillInput.trim()}
                      className="h-10 px-4 bg-[#003C5F] text-white text-xs font-semibold rounded-xl hover:bg-[#002E4A] transition-all disabled:opacity-50 cursor-pointer"
                    >
                      Add
                    </button>
                  </div>

                  {/* Predefined Quick Picks */}
                  <div className="pt-1">
                    <span className="block text-[11px] text-slate-500 mb-1.5">
                      Suggested standard skills:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {PREDEFINED_SKILLS.filter(
                        (pre) => !profile.skills.some((s) => s.toLowerCase() === pre.toLowerCase())
                      )
                        .slice(0, 8)
                        .map((pre) => (
                          <button
                            key={pre}
                            type="button"
                            onClick={() => handleAddSkill(pre)}
                            className="px-2.5 py-1 rounded-full text-xs bg-slate-100 hover:bg-[#003C5F]/10 hover:text-[#003C5F] text-slate-700 transition-colors border border-slate-200 cursor-pointer"
                          >
                            + {pre}
                          </button>
                        ))}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Step 3: Availability & Work Preferences */}
            {currentStep === 3 && (
              <section aria-labelledby="step-3-heading" className="space-y-6">
                <div>
                  <h1 id="step-3-heading" className="text-2xl sm:text-3xl font-bold text-[#003C5F] tracking-tight mb-2">
                    Availability & Work Style
                  </h1>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    Set your time commitment and remote preferences so ProofFlow AI can filter opportunities with compatible requirements.
                  </p>
                </div>

                {/* Available Hours per Week */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label htmlFor="hours-slider" className="text-xs font-semibold text-slate-800">
                      Available Hours per Week: <span className="text-[#003C5F] font-bold text-sm">{profile.available_hours_per_week} hrs</span>
                    </label>
                    <span className="text-xs text-slate-500">Pace used for study roadmap estimation</span>
                  </div>
                  <input
                    id="hours-slider"
                    type="range"
                    min="2"
                    max="60"
                    step="1"
                    value={profile.available_hours_per_week}
                    onChange={(e) =>
                      setProfile({ ...profile, available_hours_per_week: parseInt(e.target.value, 10) })
                    }
                    className="w-full accent-[#003C5F] cursor-pointer h-2 bg-slate-200 rounded-lg"
                  />
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Part-time (5-10 hrs)</span>
                    <span>Standard (20-30 hrs)</span>
                    <span>Full-time commitment (40+ hrs)</span>
                  </div>
                  {errors.available_hours_per_week && (
                    <p role="alert" className="text-red-600 text-xs">
                      {errors.available_hours_per_week}
                    </p>
                  )}
                </div>

                {/* Remote Preference */}
                <div className="space-y-2 pt-2">
                  <label className="block text-xs font-semibold text-slate-800">
                    Work Location Preference
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(['Remote-first', 'Hybrid', 'On-site'] as RemotePreference[]).map((pref) => {
                      const isSelected = profile.remote_preference === pref;
                      return (
                        <button
                          key={pref}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          onClick={() => setProfile({ ...profile, remote_preference: pref })}
                          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'border-[#003C5F] bg-[#003C5F]/5 ring-2 ring-[#003C5F] font-medium text-[#003C5F]'
                              : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                          }`}
                        >
                          <div className="font-semibold text-sm mb-0.5">{pref}</div>
                          <div className="text-[11px] text-slate-500">
                            {pref === 'Remote-first'
                              ? 'Worldwide & distributed contracts'
                              : pref === 'Hybrid'
                              ? 'Mix of remote & local on-site visits'
                              : 'In-person client offices only'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Preferred Work Type */}
                <div className="space-y-2 pt-2">
                  <label className="block text-xs font-semibold text-slate-800">
                    Preferred Contract Types (select all that apply)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {WORK_TYPES.map((type) => {
                      const isSelected = profile.preferred_work_type.includes(type);
                      return (
                        <button
                          key={type}
                          type="button"
                          role="checkbox"
                          aria-checked={isSelected}
                          onClick={() => toggleWorkType(type)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#003C5F] text-white shadow-sm'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {isSelected ? '✓ ' : '+ '}
                          {type}
                        </button>
                      );
                    })}
                  </div>
                  {errors.preferred_work_type && (
                    <p role="alert" className="text-red-600 text-xs">
                      {errors.preferred_work_type}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <label htmlFor="hourly-rate" className="block text-xs font-semibold text-slate-800">Hourly Rate (USD)</label>
                    <input
                      id="hourly-rate"
                      type="number"
                      min="0"
                      max="1000000"
                      value={profile.hourly_rate}
                      onChange={(e) => setProfile({ ...profile, hourly_rate: Number(e.target.value) })}
                      aria-invalid={!!errors.hourly_rate}
                      aria-describedby={errors.hourly_rate ? 'hourly-rate-error' : undefined}
                      className={`w-full h-11 px-3.5 rounded-xl text-sm border bg-white text-slate-900 focus-visible:ring-2 focus-visible:ring-[#003C5F] ${errors.hourly_rate ? 'border-red-500' : 'border-slate-300'}`}
                    />
                    {errors.hourly_rate && <p id="hourly-rate-error" role="alert" className="text-red-600 text-xs">{errors.hourly_rate}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="availability-status" className="block text-xs font-semibold text-slate-800">Current Availability</label>
                    <select
                      id="availability-status"
                      value={profile.availability_status}
                      onChange={(e) => setProfile({ ...profile, availability_status: e.target.value as FreelancerProfile['availability_status'] })}
                      aria-invalid={!!errors.availability_status}
                      aria-describedby={errors.availability_status ? 'availability-status-error' : undefined}
                      className={`w-full h-11 px-3.5 rounded-xl text-sm border bg-white text-slate-900 focus-visible:ring-2 focus-visible:ring-[#003C5F] ${errors.availability_status ? 'border-red-500' : 'border-slate-300'}`}
                    >
                      <option value="available">Available</option>
                      <option value="limited">Limited availability</option>
                      <option value="unavailable">Unavailable</option>
                    </select>
                    {errors.availability_status && <p id="availability-status-error" role="alert" className="text-red-600 text-xs">{errors.availability_status}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="profile-location" className="block text-xs font-semibold text-slate-800">Location</label>
                    <input
                      id="profile-location"
                      type="text"
                      maxLength={100}
                      value={profile.location}
                      onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                      className="w-full h-11 px-3.5 rounded-xl text-sm border border-slate-300 bg-white text-slate-900 focus-visible:ring-2 focus-visible:ring-[#003C5F]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 pt-2">
                  <label htmlFor="profile-bio" className="block text-xs font-semibold text-slate-800">Short Bio</label>
                  <textarea
                    id="profile-bio"
                    rows={4}
                    maxLength={2000}
                    value={profile.bio}
                    onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                    className="w-full px-3.5 py-3 rounded-xl text-sm border border-slate-300 bg-white text-slate-900 focus-visible:ring-2 focus-visible:ring-[#003C5F]"
                  />
                </div>

                {/* Learning Budget (INR) */}
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between items-center">
                    <label htmlFor="learning-budget" className="block text-xs font-semibold text-slate-800">
                      Maximum Learning & Upskilling Budget (INR)
                    </label>
                    <span className="text-xs text-slate-500">Optional course filter parameter</span>
                  </div>
                  <div className="relative max-w-xs">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">
                      ₹
                    </span>
                    <input
                      id="learning-budget"
                      type="number"
                      min="0"
                      step="500"
                      value={profile.budget}
                      onChange={(e) =>
                        setProfile({ ...profile, budget: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full h-11 pl-8 pr-4 rounded-xl text-sm border border-slate-300 bg-white text-slate-900 focus-visible:ring-2 focus-visible:ring-[#003C5F]"
                    />
                  </div>
                </div>
              </section>
            )}

            {/* Step 4: Career Goals & Final Review */}
            {currentStep === 4 && (
              <section aria-labelledby="step-4-heading" className="space-y-6">
                <div>
                  <h1 id="step-4-heading" className="text-2xl sm:text-3xl font-bold text-[#003C5F] tracking-tight mb-2">
                    Career Goals & Profile Review
                  </h1>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    Review your complete profile before confirming. These exact parameters will feed into the ProofFlow Hybrid Recommendation Engine to generate your matched opportunities and learning roadmap.
                  </p>
                </div>

                {/* Career Goals Selection */}
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-slate-800">
                    What are your top career objectives? <span className="text-red-500">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PREDEFINED_CAREER_GOALS.map((goal) => {
                      const isSelected = profile.career_goals.includes(goal);
                      return (
                        <button
                          key={goal}
                          type="button"
                          role="checkbox"
                          aria-checked={isSelected}
                          onClick={() => toggleCareerGoal(goal)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#003C5F] text-white shadow-sm'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {isSelected ? '✓ ' : '+ '}
                          {goal}
                        </button>
                      );
                    })}
                  </div>

                  {/* Add Custom Goal */}
                  <div className="flex items-center gap-2 max-w-md pt-1">
                    <input
                      type="text"
                      value={customGoalInput}
                      onChange={(e) => setCustomGoalInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomGoal();
                        }
                      }}
                      placeholder="Add specific career goal..."
                      className="flex-1 h-9 px-3 rounded-lg text-xs border border-slate-300 bg-white"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomGoal}
                      disabled={!customGoalInput.trim()}
                      className="h-9 px-3 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-medium rounded-lg disabled:opacity-40 cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                  {errors.career_goals && (
                    <p role="alert" className="text-red-600 text-xs">
                      {errors.career_goals}
                    </p>
                  )}
                </div>

                {/* Comprehensive Profile Review Card */}
                <div className="border border-[#E6DEC9] bg-[#FDFBF7] rounded-xl p-5 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-[#E6DEC9] pb-3">
                    <span className="text-xs uppercase tracking-wider font-bold text-[#003C5F]">
                      ProofFlow Model Input Payload Summary
                    </span>
                    <span className="text-[11px] text-slate-500">Ready for scoring weights</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="text-slate-500 font-medium">Freelancer Name</p>
                      <p className="font-semibold text-slate-900">{profile.name} ({profile.email})</p>
                    </div>

                    <div>
                      <p className="text-slate-500 font-medium">Headline</p>
                      <p className="font-semibold text-slate-900">{profile.headline || 'Not provided'}</p>
                    </div>

                    <div>
                      <p className="text-slate-500 font-medium">Experience Level</p>
                      <p className="font-semibold text-slate-900 capitalize">
                        {profile.experience_level} ({profile.experience_years} years commercial)
                      </p>
                    </div>

                    <div>
                      <p className="text-slate-500 font-medium">Roles (Current &rarr; Desired)</p>
                      <p className="font-semibold text-slate-900">
                        {profile.primary_role} &rarr; {profile.desired_role}
                      </p>
                    </div>

                    <div>
                      <p className="text-slate-500 font-medium">Availability & Location</p>
                      <p className="font-semibold text-slate-900">
                        {profile.available_hours_per_week} hrs/week • {profile.remote_preference}
                      </p>
                    </div>

                    <div>
                      <p className="text-slate-500 font-medium">Learning Budget</p>
                      <p className="font-semibold text-slate-900">₹{profile.budget.toLocaleString()} INR</p>
                    </div>
                  </div>

                  {/* Skills with Assigned Proficiencies */}
                  <div className="pt-2 border-t border-[#E6DEC9]">
                    <p className="text-xs text-slate-500 font-medium mb-2">
                      Verified Skills & Proficiencies ({profile.skills.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {profile.skills.map((skill) => (
                        <span
                          key={skill}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-white text-slate-800 border border-slate-200 shadow-2xs font-medium"
                        >
                          <span>{skill}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#003C5F]/10 text-[#003C5F] font-bold">
                            {profile.skill_proficiency[skill] || 'Intermediate'}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Career Objectives */}
                  <div className="pt-2 border-t border-[#E6DEC9]">
                    <p className="text-xs text-slate-500 font-medium mb-1.5">
                      Career Goals ({profile.career_goals.length})
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-xs text-slate-700">
                      {profile.career_goals.map((g, idx) => (
                        <li key={idx}>{g}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {errors.submit && (
                  <div role="alert" className="p-3 rounded-lg bg-red-50 text-red-700 text-xs">
                    {errors.submit}
                  </div>
                )}
              </section>
            )}

            {/* Stepper Navigation Buttons */}
            <div className="mt-8 pt-6 border-t border-slate-200 flex items-center justify-between">
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  &larr; Back
                </button>
              ) : (
                <div />
              )}

              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-6 py-2.5 rounded-xl bg-[#003C5F] text-white text-sm font-semibold hover:bg-[#002E4A] transition-all shadow-sm cursor-pointer ml-auto"
                >
                  Continue &rarr;
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-[#003C5F] text-white text-sm font-semibold hover:bg-[#002E4A] transition-all shadow-sm cursor-pointer ml-auto flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? 'Verifying profile...' : 'Confirm Profile & Finish'}
                </button>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Accessible Footer */}
      <footer className="w-full bg-[#F4EFE6] border-t border-[#E6DEC9] py-4 px-5 sm:px-8 text-center text-xs text-slate-500">
        <p>&copy; {new Date().getFullYear()} PayPilot AI. Profile specifications conforming with ProofFlow Recommendation Model.</p>
      </footer>
    </div>
  );
};
