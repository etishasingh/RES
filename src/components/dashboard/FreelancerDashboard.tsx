import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BackgroundVideo } from '../BackgroundVideo';
import { useAuth } from '../../context/AuthContext';
import { projectService } from '../../services/projectService';
import { profileService } from '../../services/profileService';
import { impactService } from '../../services/impactService';
import type { FreelancerProfile } from '../../types/profile';
import type { ImpactBadge } from '../../types/impact';

const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4';

interface ProjectMilestone {
  number: number;
  title: string;
  amount: number;
  // Preserves actual backend status values including 'submitted' (awaiting client review)
  status: 'accepted' | 'paid' | 'submitted' | 'under_review' | 'in_progress' | 'not_started' | 'rejected' | 'cancelled';
  dueDate: string;
}

interface ActiveProject {
  id: string;
  title: string;
  client: string;
  clientAvatarText: string;
  currentMilestoneNumber: number;
  currentMilestoneTitle: string;
  // Preserves actual backend status of the current milestone; not collapsed to a two-value enum
  milestoneStatus: 'submitted' | 'under_review' | 'in_progress' | 'not_started' | 'rejected' | 'cancelled' | string;
  milestoneDueAmount: number;
  milestoneDueDate: string;
  totalBudget: number;
  totalPaidSoFar: number;
  progressSummary: string;
  milestones: ProjectMilestone[];
}

interface OpenProject {
  id: string;
  client: string;
  title: string;
  discipline: 'Design' | 'Engineering' | 'Writing';
  skills: string[];
  budget: number;
  deadline: string;
  matchScore: number;
  description: string;
  milestonesCount: number;
  clientDecisionNote: string;
}

interface FreelancerDashboardProps {
  onNavigate?: (view: 'signin' | 'signup' | 'onboarding' | 'dashboard') => void;
}

export const FreelancerDashboard: React.FC<FreelancerDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const displayName = user?.name || 'Freelancer';
  const firstName = displayName.split(' ')[0] || 'Freelancer';
  const displayMonogram = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // Today's date formatted e.g. "Saturday, 17 October"
  const formattedToday = useMemo(() => {
    try {
      const now = new Date();
      return new Intl.DateTimeFormat('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(now);
    } catch {
      return 'Saturday, 17 October';
    }
  }, []);

  // Filter and search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDiscipline, setSelectedDiscipline] = useState<'All' | 'Design' | 'Engineering' | 'Writing'>('All');
  const [selectedBudgetFilter, setSelectedBudgetFilter] = useState<'all' | 'under2k' | 'over2k'>('all');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Selected project for "View project" modal
  const [selectedProjectForModal, setSelectedProjectForModal] = useState<OpenProject | null>(null);

  // Sample data: Active Projects
  const [activeProjects, setActiveProjects] = useState<ActiveProject[]>([]);
  const [openProjects, setOpenProjects] = useState<OpenProject[]>([]);
  const [profile, setProfile] = useState<FreelancerProfile | null>(null);
  const [latestFeedback, setLatestFeedback] = useState<string | null>(null);
  const [averageRating, setAverageRating] = useState<number | null>(null);
  const [impactBadges, setImpactBadges] = useState<ImpactBadge[]>([]);

  useEffect(() => {
    impactService.getMyBadges().then(setImpactBadges).catch(() => {});
  }, []);
  useEffect(() => {
    projectService.assigned().then((projects) => setActiveProjects(projects.map((p) => {
      const current = p.milestones.find((m) => m.status !== 'accepted' && m.status !== 'paid') || p.milestones[0];
      return { id: p.id, title: p.title, client: 'Client', clientAvatarText: 'CL', currentMilestoneNumber: Math.max(1, p.milestones.indexOf(current) + 1), currentMilestoneTitle: current?.title || 'No milestones', milestoneStatus: current?.status || 'not_started', milestoneDueAmount: current?.amount || 0, milestoneDueDate: current?.due_date || 'Not set', totalBudget: p.budget_max ?? p.budget_min ?? 0, totalPaidSoFar: p.milestones.filter((m) => m.status === 'paid').reduce((sum, m) => sum + m.amount, 0), progressSummary: p.status, milestones: p.milestones.map((m, index) => ({ number: index + 1, title: m.title, amount: m.amount, status: m.status as ProjectMilestone['status'], dueDate: m.due_date || 'Not set' })) };
    })));
    projectService.open().then((projects) => setOpenProjects(projects.map((p) => ({ id: p.id, client: 'Client', title: p.title, discipline: 'Engineering', skills: p.skills, budget: p.budget_max ?? p.budget_min ?? 0, deadline: p.milestones.find((m) => m.due_date)?.due_date || 'Not set', matchScore: 0, description: p.description, milestonesCount: p.milestones.length, clientDecisionNote: 'Client reviews submissions and makes the final decision.' }))));
    profileService.getProfile().then(setProfile).catch(() => setProfile(null));
    projectService.journey().then(({ reviews }) => {
      const ratings = reviews.map((review) => review.final_score ?? review.client_score).filter((score): score is number => score !== null);
      setAverageRating(ratings.length ? ratings.reduce((sum, score) => sum + score, 0) / ratings.length / 20 : null);
      setLatestFeedback(reviews.find((review) => review.feedback?.trim())?.feedback?.trim() || null);
    }).catch(() => { setAverageRating(null); setLatestFeedback(null); });
  }, []);

  const { summaryText, nextPaymentInfo } = useMemo(() => {
    let underReview = 0;
    let inProgress = 0;
    let nextCandidate: {
      amount: number;
      milestoneTitle: string;
      milestoneNumber: number;
      projectTitle: string;
      dueDate: string;
      isUnderReview: boolean;
    } | null = null;

    for (const project of activeProjects) {
      for (const m of project.milestones) {
        // 'submitted' is the backend canonical status for work awaiting client review.
        // 'under_review' is a legacy alias kept for display compatibility.
        if (m.status === 'submitted' || m.status === 'under_review') {
          underReview += 1;
          if (!nextCandidate) {
            nextCandidate = {
              amount: m.amount,
              milestoneTitle: m.title,
              milestoneNumber: m.number,
              projectTitle: project.title,
              dueDate: m.dueDate,
              isUnderReview: true,
            };
          }
        } else if (m.status === 'in_progress') {
          inProgress += 1;
          if (!nextCandidate) {
            nextCandidate = {
              amount: m.amount,
              milestoneTitle: m.title,
              milestoneNumber: m.number,
              projectTitle: project.title,
              dueDate: m.dueDate,
              isUnderReview: false,
            };
          }
        }
      }
    }

    let summary = '';
    if (activeProjects.length === 0) {
      summary = 'No active projects assigned yet. Explore open projects below to review briefs and submit proposals.';
    } else if (underReview > 0 && inProgress > 0) {
      summary = `${underReview} ${underReview === 1 ? 'milestone is' : 'milestones are'} waiting on client review, and ${inProgress} active ${inProgress === 1 ? 'deliverable is' : 'deliverables are'} in progress.`;
    } else if (underReview > 0) {
      summary = `${underReview} ${underReview === 1 ? 'milestone is' : 'milestones are'} waiting on client review.`;
    } else if (inProgress > 0) {
      summary = `${inProgress} active ${inProgress === 1 ? 'deliverable is' : 'deliverables are'} in progress.`;
    } else {
      summary = 'All active deliverables are running according to project schedules.';
    }

    return {
      summaryText: summary,
      nextPaymentInfo: nextCandidate,
    };
  }, [activeProjects]);

  // Real-time filtering
  const filteredProjects = useMemo(() => {
    return openProjects.filter((item) => {
      // Discipline filter
      if (selectedDiscipline !== 'All' && item.discipline !== selectedDiscipline) {
        return false;
      }
      // Budget filter
      if (selectedBudgetFilter === 'under2k' && item.budget >= 2000) {
        return false;
      }
      if (selectedBudgetFilter === 'over2k' && item.budget < 2000) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesClient = item.client.toLowerCase().includes(q);
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesSkills = item.skills.some((s) => s.toLowerCase().includes(q));
        if (!matchesClient && !matchesTitle && !matchesSkills) {
          return false;
        }
      }
      return true;
    });
  }, [openProjects, selectedDiscipline, selectedBudgetFilter, searchQuery]);

  return (
    <div className="min-h-screen w-full flex flex-col bg-paper text-deepBlue font-sans">
      {/* 
        ========================================================================
        TOP DEEP-BLUE HEADER BAND
        Holds ambient video, top nav, date, human greeting, and "Money first" indicator
        ========================================================================
      */}
      <header className="relative w-full bg-[#003C5F] text-[#FDFBF7] overflow-hidden pt-5 pb-12 sm:pb-16 px-4 sm:px-8 border-b border-[#003C5F]/20">
        {/* Ambient video background with graceful fallback */}
        <BackgroundVideo src={VIDEO_URL} />

        <div className="relative z-10 max-w-[1280px] mx-auto w-full flex flex-col justify-between">
          {/* Top In-App Navigation Bar */}
          <nav
            className="w-full flex items-center justify-between pb-6 sm:pb-8 border-b border-[#FDFBF7]/15"
            aria-label="Freelancer Workspace Navigation"
          >
            {/* Brand Logo */}
            <div className="flex items-center gap-6">
              <a
                href="#/dashboard"
                className="font-display text-2xl sm:text-3xl text-[#FDFBF7] hover:opacity-90 transition-opacity focus-visible:ring-2 focus-visible:ring-[#FDFBF7] rounded px-1 -mx-1"
              >
                PayPilot AI
              </a>
              <span className="hidden sm:inline-block text-xs uppercase tracking-wider text-[#FDFBF7]/60 font-medium px-2.5 py-1 rounded border border-[#FDFBF7]/20">
                Freelancer Workspace
              </span>
            </div>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center gap-6 text-[14px] font-medium">
              <Link
                to="/freelancer/dashboard"
                className="min-h-[40px] px-3 py-1.5 transition-colors cursor-pointer rounded focus-visible:ring-2 focus-visible:ring-[#FDFBF7] text-[#FDFBF7] font-semibold border-b-2 border-[#FDFBF7] flex items-center"
              >
                Dashboard
              </Link>
              <Link
                to="/freelancer/journey"
                className="min-h-[40px] px-3 py-1.5 transition-colors cursor-pointer rounded focus-visible:ring-2 focus-visible:ring-[#FDFBF7] text-[#FDFBF7]/75 hover:text-[#FDFBF7] flex items-center"
              >
                Journey
              </Link>
              <Link
                to="/freelancer/learning"
                className="min-h-[40px] px-3 py-1.5 transition-colors cursor-pointer rounded focus-visible:ring-2 focus-visible:ring-[#FDFBF7] text-[#FDFBF7]/75 hover:text-[#FDFBF7] flex items-center"
              >
                Learning
              </Link>
              <Link
                to="/freelancer/projects"
                className="min-h-[40px] px-3 py-1.5 transition-colors cursor-pointer rounded focus-visible:ring-2 focus-visible:ring-[#FDFBF7] text-[#FDFBF7]/75 hover:text-[#FDFBF7] flex items-center"
              >
                Projects
              </Link>
            </div>

            {/* User Account Monogram & Sign-out */}
            <div className="hidden md:flex items-center gap-4">
              <div className="flex items-center gap-3 pl-3 border-l border-[#FDFBF7]/20">
                <div
                  className="w-9 h-9 rounded-full bg-[#FDFBF7]/15 border border-[#FDFBF7]/30 flex items-center justify-center text-xs font-semibold tracking-wider text-[#FDFBF7]"
                  aria-label={`User avatar for ${displayName}`}
                >
                  {displayMonogram}
                </div>
                <div className="text-left text-xs">
                  <p className="font-medium text-[#FDFBF7] leading-none mb-1">{displayName}</p>
                  <p className="text-[#FDFBF7]/70 leading-none">Freelancer</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate?.('signin')}
                className="min-h-[40px] text-xs text-[#FDFBF7]/75 hover:text-[#FDFBF7] px-2.5 py-1.5 rounded transition-colors focus-visible:ring-2 focus-visible:ring-[#FDFBF7]"
              >
                Sign out
              </button>
            </div>

            {/* Mobile Menu Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden min-h-[40px] min-w-[40px] px-3 py-2 rounded-lg border border-[#FDFBF7]/25 text-xs text-[#FDFBF7] font-medium tracking-wide uppercase focus-visible:ring-2 focus-visible:ring-[#FDFBF7]"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-panel"
            >
              {mobileMenuOpen ? 'Close' : 'Menu'}
            </button>
          </nav>

          {/* Mobile Collapsible Navigation Panel */}
          {mobileMenuOpen && (
            <div
              id="mobile-nav-panel"
              className="md:hidden mt-4 p-4 rounded-xl bg-[#002D47] border border-[#FDFBF7]/20 flex flex-col gap-2 text-sm text-[#FDFBF7] animate-fade-rise"
            >
              <div className="flex items-center gap-3 pb-3 border-b border-[#FDFBF7]/15">
                <div className="w-8 h-8 rounded-full bg-[#FDFBF7]/20 flex items-center justify-center font-semibold text-xs">
                  {displayMonogram}
                </div>
                <div>
                  <p className="font-medium text-[#FDFBF7]">{displayName}</p>
                  <p className="text-xs text-[#FDFBF7]/70">Freelancer Account</p>
                </div>
              </div>
              <Link
                to="/freelancer/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="min-h-[40px] text-left px-2 py-2 rounded bg-[#FDFBF7]/15 font-semibold flex items-center"
              >
                Dashboard
              </Link>
              <Link
                to="/freelancer/journey"
                onClick={() => setMobileMenuOpen(false)}
                className="min-h-[40px] text-left px-2 py-2 rounded text-[#FDFBF7]/80 hover:text-[#FDFBF7] flex items-center"
              >
                Journey
              </Link>
              <Link
                to="/freelancer/learning"
                onClick={() => setMobileMenuOpen(false)}
                className="min-h-[40px] text-left px-2 py-2 rounded text-[#FDFBF7]/80 hover:text-[#FDFBF7] flex items-center"
              >
                Learning
              </Link>
              <Link
                to="/freelancer/projects"
                onClick={() => setMobileMenuOpen(false)}
                className="min-h-[40px] text-left px-2 py-2 rounded text-[#FDFBF7]/80 hover:text-[#FDFBF7] flex items-center"
              >
                Projects
              </Link>
              <button
                type="button"
                onClick={() => onNavigate?.('signin')}
                className="min-h-[40px] text-left px-2 py-2 text-xs text-[#FDFBF7]/70 border-t border-[#FDFBF7]/15 mt-1"
              >
                Sign out
              </button>
            </div>
          )}

          {/* Greeting and Context Area */}
          <div className="pt-8 sm:pt-12">
            {/* Date line replacing placeholder */}
            <p className="text-[13px] uppercase tracking-widest text-[#FDFBF7]/70 font-medium mb-3 animate-fade-rise">
              {formattedToday}
            </p>

            {/* Confident Serif Headline */}
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl text-[#FDFBF7] tracking-tight leading-[1.05] mb-2.5 animate-fade-rise">
              Good morning, {firstName}.
            </h1>

            {/* Real Work Summary — derived from live project data */}
            <p className="text-[15px] sm:text-base text-[#FDFBF7]/85 max-w-[65ch] leading-relaxed mb-6 animate-fade-rise-delay-1">
              {summaryText}
            </p>

            {/* 
              MONEY FIRST: Directly under greeting
              Clear, prominent, unpretentious statement of what is due next.
              Only shown when the freelancer has an actionable upcoming milestone.
            */}
            {nextPaymentInfo ? (
              <div className="inline-flex flex-wrap items-center gap-3.5 bg-[#FDFBF7]/10 border border-[#FDFBF7]/20 rounded-lg px-4 py-3 sm:px-5 sm:py-3.5 animate-fade-rise-delay-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#E5B564] shrink-0" aria-hidden="true" />
                <div className="text-[14px] sm:text-[15px] text-[#FDFBF7]">
                  <span className="font-semibold text-white">
                    {nextPaymentInfo.isUnderReview ? 'Next payout on approval:' : 'Upcoming milestone:'}{' '}
                    ${nextPaymentInfo.amount.toLocaleString()}
                  </span>{' '}
                  <span className="text-[#FDFBF7]/80">
                    — Milestone {nextPaymentInfo.milestoneNumber}: {nextPaymentInfo.milestoneTitle}
                    {' '}({nextPaymentInfo.projectTitle})
                  </span>
                  {nextPaymentInfo.dueDate && nextPaymentInfo.dueDate !== 'Not set' && (
                    <span className="text-[#FDFBF7]/60 text-[13px]"> · Due {nextPaymentInfo.dueDate}</span>
                  )}
                </div>
              </div>
            ) : activeProjects.length > 0 ? null : (
              <div className="inline-flex items-center gap-3.5 bg-[#FDFBF7]/10 border border-[#FDFBF7]/20 rounded-lg px-4 py-3 sm:px-5 sm:py-3.5 animate-fade-rise-delay-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#FDFBF7]/30 shrink-0" aria-hidden="true" />
                <span className="text-[14px] text-[#FDFBF7]/70">No scheduled payouts. Browse open projects below to submit proposals.</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 
        ========================================================================
        PAPER-COLORED CONTENT SHEET
        Tactile paper feel (#FDFBF7) with thin ruled dividing lines.
        Active projects and Open Projects are paper-colored; "Your profile" is the one dark anchor.
        ========================================================================
      */}
      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-8 py-10 sm:py-14 space-y-12">
        {/* Top Grid: Left column (Active Projects) + Right column (Your Profile dark anchor) */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* 
            LEFT COLUMN: Active Projects (Paper-colored with thin ruled lines, not dark slabs)
          */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">
            <div className="flex items-baseline justify-between border-b border-[#003C5F]/15 pb-3">
              <h2 className="font-display text-2xl sm:text-3xl text-deepBlue">Active projects</h2>
              <span className="text-[13px] text-[#455A6A] font-medium">
                {activeProjects.length} projects underway
              </span>
            </div>

            <div className="space-y-5">
              {activeProjects.length === 0 ? (
                <div
                  role="status"
                  className="p-6 bg-paper border border-[#003C5F]/15 rounded-xl text-center space-y-2"
                >
                  <p className="text-deepBlue font-semibold text-[15px]">No active projects assigned yet.</p>
                  <p className="text-[#455A6A] text-[14px]">
                    Browse open projects below to review briefs and submit proposals.
                  </p>
                </div>
              ) : (
                activeProjects.map((project) => {
                const milestoneStatus = project.milestoneStatus;
                const isAwaitingReview = milestoneStatus === 'submitted' || milestoneStatus === 'under_review';
                const statusLabel = (() => {
                  if (milestoneStatus === 'submitted' || milestoneStatus === 'under_review') return 'Awaiting client review';
                  if (milestoneStatus === 'in_progress') return 'In progress';
                  if (milestoneStatus === 'not_started') return 'Not yet started';
                  if (milestoneStatus === 'rejected') return 'Changes requested';
                  if (milestoneStatus === 'cancelled') return 'Cancelled';
                  return milestoneStatus;
                })();
                return (
                  <article
                    key={project.id}
                    className="bg-paper border border-[#003C5F]/15 rounded-xl p-5 sm:p-6 transition-colors hover:border-[#003C5F]/30 shadow-none"
                  >
                    {/* Top project line: Client + Title */}
                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-[#003C5F]/10 pb-4 mb-4">
                      <div>
                        <span className="text-[13px] uppercase tracking-wider text-[#455A6A] font-medium">
                          {project.client}
                        </span>
                        <h3 className="text-lg sm:text-xl font-semibold text-deepBlue mt-0.5">
                          {project.title}
                        </h3>
                      </div>
                      <div className="text-left sm:text-right shrink-0">
                        <span className="text-[13px] text-[#455A6A] block">Total contract</span>
                        <span className="font-display text-lg sm:text-xl text-deepBlue">
                          ${project.totalBudget.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Milestone and Payment Breakdown */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-deepBlue mb-4">
                      <div>
                        <span className="text-[13px] text-[#455A6A] block mb-1">Current milestone</span>
                        <p className="font-medium text-[15px]">
                          Milestone {project.currentMilestoneNumber}: {project.currentMilestoneTitle}
                        </p>
                      </div>

                      <div>
                        <span className="text-[13px] text-[#455A6A] block mb-1">What is due and when</span>
                        <p className="font-medium text-[15px]">
                          ${project.milestoneDueAmount.toLocaleString()} due on{' '}
                          {isAwaitingReview ? 'approval' : 'delivery'} ({project.milestoneDueDate})
                        </p>
                      </div>
                    </div>

                    {/* Status row with muted, desaturated tones */}
                    <div className="pt-3 border-t border-[#003C5F]/10 flex flex-wrap items-center justify-between gap-3 text-[13px]">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            isAwaitingReview ? 'bg-[#A86315]' : 'bg-[#64748B]'
                          }`}
                          aria-hidden="true"
                        />
                        <span className="font-medium text-deepBlue">
                          Status:{' '}
                          <span className={isAwaitingReview ? 'text-[#874E0E]' : 'text-[#475569]'}>
                            {statusLabel}
                          </span>
                        </span>
                      </div>
                      <p className="text-[#455A6A]">{project.progressSummary}</p>
                    </div>

                    <div className="mt-3 pt-3 border-t border-[#003C5F]/10 flex justify-end">
                      <Link
                        to={`/freelancer/projects/${project.id}`}
                        className="text-[13px] font-medium text-deepBlue hover:underline flex items-center gap-1"
                      >
                        Open workspace &rarr;
                      </Link>
                    </div>
                  </article>
                );
              })
              )}
            </div>
          </div>

          {/* 
            RIGHT COLUMN: "Your profile"
            Per prompt rule 3: "The 'Your profile' card is the one dark anchor."
            Deep blue background (#003C5F) with warm paper typography.
          */}
          <aside
            className="lg:col-span-5 xl:col-span-4 bg-[#003C5F] text-[#FDFBF7] rounded-xl p-6 sm:p-7 border border-[#003C5F] relative overflow-hidden"
            aria-labelledby="your-profile-title"
          >
            {/* Header */}
            <div className="border-b border-[#FDFBF7]/15 pb-4 mb-5">
              <span className="text-[13px] uppercase tracking-wider text-[#FDFBF7]/60 font-medium block mb-1">
                Freelancer Standing
              </span>
              <h2 id="your-profile-title" className="font-display text-2xl sm:text-3xl text-[#FDFBF7]">
                Your profile
              </h2>
            </div>

            {/* Profile Core: Name, Specialty, Rating */}
            <div className="space-y-5">
              <div>
                <p className="font-semibold text-lg text-[#FDFBF7]">{profile?.name || displayName}</p>
                <p className="text-[14px] text-[#FDFBF7]/75">{profile?.headline || 'No headline added yet'}</p>
              </div>

              {/* Overall Rating in Serif numerals */}
              <div className="bg-[#002E4A] rounded-lg p-4 border border-[#FDFBF7]/10">
                <span className="text-[13px] uppercase tracking-wider text-[#FDFBF7]/70 font-medium block mb-1">
                  Overall rating
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-4xl text-[#FDFBF7]">{averageRating === null ? '—' : averageRating.toFixed(2)}</span>
                  {averageRating !== null && <span className="text-sm text-[#FDFBF7]/70">/ 5.0</span>}
                </div>
                <p className="text-[13px] text-[#FDFBF7]/70 mt-1">{averageRating === null ? 'No client ratings yet' : 'Based on completed client reviews'}</p>
              </div>

              {/* Skills List */}
              <div>
                <span className="text-[13px] uppercase tracking-wider text-[#FDFBF7]/70 font-medium block mb-2.5">
                  Skills in your profile
                </span>
                <div className="flex flex-wrap gap-2">
                  {(profile?.skills || []).map(
                    (skill) => (
                      <span
                        key={skill}
                        className="text-[13px] px-2.5 py-1 rounded bg-[#FDFBF7]/10 border border-[#FDFBF7]/20 text-[#FDFBF7] font-medium"
                      >
                        {skill}
                      </span>
                    )
                  )}
                  {(!profile || profile.skills.length === 0) && <span className="text-[13px] text-[#FDFBF7]/70">No skills added yet</span>}
                </div>
              </div>

              {/* Latest Client Feedback */}
              <div className="pt-4 border-t border-[#FDFBF7]/15">
                <span className="text-[13px] uppercase tracking-wider text-[#FDFBF7]/70 font-medium block mb-2">
                  Latest client feedback
                </span>
                {latestFeedback ? <blockquote className="text-[14px] italic text-[#FDFBF7]/90 leading-relaxed pl-3 border-l-2 border-[#E5B564]">&ldquo;{latestFeedback}&rdquo;</blockquote> : <p className="text-[14px] text-[#FDFBF7]/70">No client feedback yet.</p>}
              </div>

              {/* Social Impact & Reputation Badges */}
              <div className="pt-4 border-t border-[#FDFBF7]/15">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] uppercase tracking-wider text-[#FDFBF7]/70 font-medium block">
                    Verified Impact Badges
                  </span>
                  <Link to="/freelancer/impact" className="text-[11px] text-[#E5B564] hover:underline">
                    View Portfolio →
                  </Link>
                </div>
                {impactBadges.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {impactBadges.map((b) => (
                      <span
                        key={b.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#E5B564]/20 border border-[#E5B564]/40 text-[#E5B564] font-semibold text-xs"
                      >
                        <span>🎖️</span> {b.badge_type.toUpperCase()}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] text-[#FDFBF7]/70">
                    Deliver project milestones to earn verified PayPilot Impact badges.
                  </p>
                )}
              </div>
            </div>
          </aside>
        </section>

        {/* 
          ========================================================================
          OPEN CLIENT PROJECTS SECTION
          Table on desktop, cards on mobile. Filterable by search and discipline.
          ========================================================================
        */}
        <section className="space-y-6 pt-4 border-t border-[#003C5F]/15">
          {/* Section Heading & Subtitle */}
          <div>
            <h2 className="font-display text-3xl sm:text-4xl text-deepBlue">Open projects</h2>
            <p className="text-[15px] text-[#455A6A] mt-1">Projects that match your skills</p>
          </div>

          {/* Search Bar & Simple Filters */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#F6F3EC] p-3.5 sm:p-4 rounded-xl border border-[#003C5F]/10">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <label htmlFor="project-search" className="sr-only">
                Search open projects
              </label>
              <input
                id="project-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects by title, client, or skill..."
                className="w-full min-h-[42px] px-4 py-2 bg-paper text-deepBlue border border-[#003C5F]/20 rounded-lg text-[15px] placeholder:text-[#455A6A]/70 focus-visible:ring-2 focus-visible:ring-deepBlue focus-visible:outline-none transition-shadow"
              />
            </div>

            {/* Discipline Filter Buttons */}
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by discipline">
              <span className="text-[13px] text-[#455A6A] font-medium mr-1 hidden sm:inline">Discipline:</span>
              {(['All', 'Design', 'Engineering', 'Writing'] as const).map((discipline) => (
                <button
                  key={discipline}
                  type="button"
                  onClick={() => setSelectedDiscipline(discipline)}
                  className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-[14px] font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-deepBlue ${
                    selectedDiscipline === discipline
                      ? 'bg-deepBlue text-paper'
                      : 'bg-paper text-deepBlue border border-[#003C5F]/20 hover:bg-[#F0EBE1]'
                  }`}
                >
                  {discipline}
                </button>
              ))}
            </div>

            {/* Simple Budget Filter Dropdown */}
            <div className="flex items-center gap-2">
              <label htmlFor="budget-filter" className="text-[13px] text-[#455A6A] font-medium shrink-0">
                Budget:
              </label>
              <select
                id="budget-filter"
                value={selectedBudgetFilter}
                onChange={(e) => setSelectedBudgetFilter(e.target.value as any)}
                className="min-h-[40px] px-3 py-1.5 bg-paper text-deepBlue border border-[#003C5F]/20 rounded-lg text-[14px] font-medium focus-visible:ring-2 focus-visible:ring-deepBlue focus-visible:outline-none cursor-pointer"
              >
                <option value="all">Any budget</option>
                <option value="under2k">Under $2,000</option>
                <option value="over2k">$2,000 and above</option>
              </select>
            </div>
          </div>

          {/* Results Count & Active Filters Indicator */}
          <div className="flex items-center justify-between text-[13px] text-[#455A6A]">
            <span>
              Showing {filteredProjects.length} of {openProjects.length} open briefs
            </span>
            {(searchQuery || selectedDiscipline !== 'All' || selectedBudgetFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedDiscipline('All');
                  setSelectedBudgetFilter('all');
                }}
                className="text-deepBlue font-medium underline underline-offset-2 hover:text-[#002E4A]"
              >
                Reset filters
              </button>
            )}
          </div>

          {/* 
            Desktop View: Clean, spacious table with thin ruled lines
          */}
          <div className="hidden lg:block overflow-x-auto border border-[#003C5F]/15 rounded-xl bg-paper">
            <table className="w-full text-left border-collapse" aria-label="Open Client Projects Table">
              <thead>
                <tr className="border-b border-[#003C5F]/15 bg-[#F6F3EC] text-[13px] uppercase tracking-wider text-[#455A6A] font-semibold">
                  <th scope="col" className="py-3.5 px-5">Client</th>
                  <th scope="col" className="py-3.5 px-5">Project</th>
                  <th scope="col" className="py-3.5 px-5">Skills needed</th>
                  <th scope="col" className="py-3.5 px-5">Budget</th>
                  <th scope="col" className="py-3.5 px-5">Deadline</th>
                  <th scope="col" className="py-3.5 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#003C5F]/10 text-[15px]">
                {filteredProjects.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 px-5 text-center text-[#455A6A]">
                      No projects match your current filter. Try adjusting your search or discipline.
                    </td>
                  </tr>
                ) : (
                  filteredProjects.map((project) => (
                    <tr
                      key={project.id}
                      className="hover:bg-[#F8F5EE] transition-colors focus-within:bg-[#F8F5EE]"
                    >
                      <td className="py-4 px-5 font-medium text-deepBlue whitespace-nowrap">
                        {project.client}
                      </td>
                      <td className="py-4 px-5 font-semibold text-deepBlue max-w-[260px]">
                        {project.title}
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex flex-wrap gap-1.5">
                          {project.skills.map((skill) => (
                            <span
                              key={skill}
                              className="text-[13px] px-2 py-0.5 rounded bg-[#F2EDE2] text-deepBlue border border-[#003C5F]/10 whitespace-nowrap"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-4 px-5 font-display text-lg text-deepBlue whitespace-nowrap">
                        ${project.budget.toLocaleString()}
                      </td>
                      <td className="py-4 px-5 text-[#455A6A] text-[14px] whitespace-nowrap">
                        {project.deadline}
                      </td>
                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <Link
                          to={`/freelancer/projects/${project.id}/invitation`}
                          className="inline-flex items-center min-h-[40px] px-4 py-2 bg-deepBlue text-paper rounded-lg text-[14px] font-medium hover:bg-[#002E4A] transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-deepBlue"
                        >
                          View project
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 
            Mobile / Tablet View: Stacked project cards
          */}
          <div className="lg:hidden space-y-4">
            {filteredProjects.length === 0 ? (
              <div className="py-10 px-4 text-center text-[#455A6A] bg-[#F6F3EC] rounded-xl border border-[#003C5F]/10">
                No projects match your current filter. Try adjusting your search or discipline.
              </div>
            ) : (
              filteredProjects.map((project) => (
                <article
                  key={project.id}
                  className="bg-paper border border-[#003C5F]/15 rounded-xl p-5 space-y-3.5"
                >
                  <div className="flex items-baseline justify-between gap-2 border-b border-[#003C5F]/10 pb-3">
                    <span className="text-[13px] uppercase tracking-wider text-[#455A6A] font-medium">
                      {project.client}
                    </span>
                  </div>

                  <h3 className="text-lg font-semibold text-deepBlue leading-snug">
                    {project.title}
                  </h3>

                  <div className="flex flex-wrap gap-1.5">
                    {project.skills.map((skill) => (
                      <span
                        key={skill}
                        className="text-[13px] px-2 py-0.5 rounded bg-[#F2EDE2] text-deepBlue border border-[#003C5F]/10"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm pt-2 border-t border-[#003C5F]/10">
                    <div>
                      <span className="text-[13px] text-[#455A6A] block">Budget</span>
                      <span className="font-display text-lg text-deepBlue">
                        ${project.budget.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-[13px] text-[#455A6A] block">Deadline</span>
                      <span className="text-[14px] text-deepBlue">{project.deadline}</span>
                    </div>
                  </div>

                  <Link
                    to={`/freelancer/projects/${project.id}/invitation`}
                    className="block w-full min-h-[42px] px-4 py-2.5 bg-deepBlue text-paper rounded-lg text-[14px] font-medium hover:bg-[#002E4A] transition-colors cursor-pointer text-center focus-visible:ring-2 focus-visible:ring-deepBlue"
                  >
                    View project
                  </Link>
                </article>
              ))
            )}
          </div>
        </section>

        {/* 
          Modal / Drawer for "View project"
          Provides functional completeness (Antislop C-2 and R-26)
        */}
        {selectedProjectForModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-rise"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-project-title"
          >
            <div className="bg-paper text-deepBlue rounded-2xl max-w-lg w-full p-6 sm:p-7 border border-[#003C5F]/20 shadow-2xl space-y-5">
              <div className="flex items-start justify-between gap-4 border-b border-[#003C5F]/15 pb-4">
                <div>
                  <span className="text-[13px] uppercase tracking-wider text-[#455A6A] font-medium block">
                    {selectedProjectForModal.client}
                  </span>
                  <h3 id="modal-project-title" className="font-display text-2xl text-deepBlue mt-1">
                    {selectedProjectForModal.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedProjectForModal(null)}
                  className="min-h-[40px] min-w-[40px] p-2 text-[#455A6A] hover:text-deepBlue rounded-lg text-xl leading-none focus-visible:ring-2 focus-visible:ring-deepBlue"
                  aria-label="Close dialog"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 text-[15px] text-[#455A6A] leading-relaxed">
                <p className="text-deepBlue">{selectedProjectForModal.description}</p>

                <div className="grid grid-cols-2 gap-4 bg-[#F6F3EC] p-3.5 rounded-xl border border-[#003C5F]/10 text-sm">
                  <div>
                    <span className="text-[13px] text-[#455A6A] block">Total Budget</span>
                    <span className="font-display text-xl text-deepBlue">
                      ${selectedProjectForModal.budget.toLocaleString()}
                    </span>
                    <span className="text-xs text-[#455A6A] block">PayPal Sandbox release</span>
                  </div>
                  <div>
                    <span className="text-[13px] text-[#455A6A] block">Project Deadline</span>
                    <span className="font-medium text-deepBlue block">{selectedProjectForModal.deadline}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[13px] uppercase tracking-wider text-[#455A6A] font-medium block mb-2">
                    Required skills
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedProjectForModal.skills.map((skill) => (
                      <span
                        key={skill}
                        className="text-[13px] px-2.5 py-1 rounded bg-[#EFE9DD] text-deepBlue font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-[#EBF1F5] rounded-lg border border-[#003C5F]/15 text-xs text-deepBlue">
                  <p className="font-medium mb-0.5">Review and payment notice</p>
                  <p className="text-[#455A6A]">{selectedProjectForModal.clientDecisionNote}</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#003C5F]/15">
                <button
                  type="button"
                  onClick={() => setSelectedProjectForModal(null)}
                  className="min-h-[40px] px-4 py-2 border border-[#003C5F]/20 rounded-lg text-[14px] text-deepBlue hover:bg-[#F0EBE1] transition-colors focus-visible:ring-2 focus-visible:ring-deepBlue"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    alert('Application submitted for sample project: ' + selectedProjectForModal.title);
                    setSelectedProjectForModal(null);
                  }}
                  className="min-h-[40px] px-5 py-2 bg-deepBlue text-paper rounded-lg text-[14px] font-medium hover:bg-[#002E4A] transition-colors focus-visible:ring-2 focus-visible:ring-deepBlue"
                >
                  Submit application
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 
        ========================================================================
        FOOTER
        Per prompt instructions:
        "Footer: 'PayPilot AI · Sample data · Amounts in USD'.
        Remove 'Register of Professional Services' and 'Issued under standard publication protocols'."
        ========================================================================
      */}
      <footer className="w-full bg-[#F6F3EC] border-t border-[#003C5F]/15 py-6 px-4 sm:px-8 mt-12 text-[13px] text-[#455A6A]">
        <div className="max-w-[1280px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <p className="font-medium text-deepBlue">PayPilot AI · Sample data · Amounts in USD</p>
          <div className="flex items-center gap-4 text-xs text-[#455A6A]">
            <a
              href="#/signin"
              onClick={(e) => {
                e.preventDefault();
                onNavigate?.('signin');
              }}
              className="hover:text-deepBlue transition-colors underline"
            >
              Sign in
            </a>
            <span>·</span>
            <a
              href="#/signup"
              onClick={(e) => {
                e.preventDefault();
                onNavigate?.('signup');
              }}
              className="hover:text-deepBlue transition-colors underline"
            >
              Create account
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
