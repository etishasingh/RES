import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ClientHeader } from '../shared/ClientHeader';
import { StatusPill } from '../shared/StatusPill';
import { clientService } from '../../services/clientService';
import type { ClientProject } from '../../types/client';

type TabType = 'ongoing' | 'completed' | 'all';

export const ClientProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ClientProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [currentTab, setCurrentTab] = useState<TabType>('ongoing');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    document.title = 'PayPilot AI — Client Projects';
    clientService
      .getClientProjects()
      .then((data) => setProjects(data))
      .catch((error) =>
        setLoadError(error instanceof Error ? error.message : 'Unable to load projects.')
      )
      .finally(() => setLoading(false));
  }, []);

  const ongoingProjects = useMemo(
    () => projects.filter((p) => p.status !== 'completed' && p.status !== 'cancelled'),
    [projects]
  );

  const completedProjects = useMemo(
    () => projects.filter((p) => p.status === 'completed'),
    [projects]
  );

  const displayedList = useMemo(() => {
    let list = projects;
    if (currentTab === 'ongoing') list = ongoingProjects;
    if (currentTab === 'completed') list = completedProjects;

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.skills || []).some((s) => s.toLowerCase().includes(q))
    );
  }, [projects, ongoingProjects, completedProjects, currentTab, searchQuery]);

  return (
    <div className="min-h-screen w-full flex flex-col bg-[#FDFBF7] text-[#1E293B] font-sans">
      <ClientHeader
        breadcrumbs={[
          { label: 'Dashboard', path: '/client/dashboard' },
          { label: 'Projects' },
        ]}
        title="Project Management"
        subtitle="Track ongoing deliverables, review milestone submissions, and inspect completed engagements."
        dateLine="Client Operations"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#FDFBF7]/15">
          <div className="text-[14px] text-[#FDFBF7]/90">
            {ongoingProjects.length} active commitment{ongoingProjects.length === 1 ? '' : 's'} across your pipeline
          </div>
          <button
            type="button"
            onClick={() => navigate('/client/projects/new')}
            className="min-h-[42px] px-5 py-2 rounded-lg bg-paper text-deepBlue font-semibold text-[14px] hover:bg-[#EAE4D6] transition-colors cursor-pointer flex items-center gap-2"
          >
            <span>+</span> Create project
          </button>
        </div>
      </ClientHeader>

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-8">
        {/* Top Controls: Tabs and Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#003C5F]/15 pb-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentTab('ongoing')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                currentTab === 'ongoing'
                  ? 'bg-[#003C5F] text-[#FDFBF7] shadow-sm'
                  : 'text-[#455A6A] hover:bg-[#003C5F]/5'
              }`}
            >
              Ongoing Projects ({ongoingProjects.length})
            </button>
            <button
              type="button"
              onClick={() => setCurrentTab('completed')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                currentTab === 'completed'
                  ? 'bg-[#003C5F] text-[#FDFBF7] shadow-sm'
                  : 'text-[#455A6A] hover:bg-[#003C5F]/5'
              }`}
            >
              Completed ({completedProjects.length})
            </button>
            <button
              type="button"
              onClick={() => setCurrentTab('all')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                currentTab === 'all'
                  ? 'bg-[#003C5F] text-[#FDFBF7] shadow-sm'
                  : 'text-[#455A6A] hover:bg-[#003C5F]/5'
              }`}
            >
              All ({projects.length})
            </button>
          </div>

          <div className="relative w-full md:w-72">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects by title or skill..."
              className="w-full px-3.5 py-2 rounded-lg border border-[#003C5F]/20 bg-paper text-sm text-deepBlue placeholder:text-[#455A6A]/60 focus:outline-none focus:ring-2 focus:ring-[#003C5F]"
            />
          </div>
        </div>

        {loadError && (
          <div role="alert" className="p-4 rounded-xl bg-[#FAF3E7] border border-[#E8D2AC] text-sm text-[#874E0E]">
            {loadError}
          </div>
        )}

        {loading ? (
          <div className="py-20 text-center text-[#455A6A]">
            <div className="animate-spin h-8 w-8 border-4 border-[#003C5F] border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-sm">Loading your projects…</p>
          </div>
        ) : displayedList.length === 0 ? (
          <div className="bg-paper border border-[#003C5F]/15 rounded-2xl p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-[#003C5F]/10 text-deepBlue flex items-center justify-center mx-auto text-xl font-bold">
              📂
            </div>
            <h3 className="font-display text-2xl text-deepBlue">No projects found</h3>
            <p className="text-sm text-[#455A6A] max-w-md mx-auto">
              {currentTab === 'completed'
                ? 'No completed projects yet. Completed projects will appear here once all milestones are accepted.'
                : 'You have no ongoing projects matching this filter. Start by publishing a new project brief.'}
            </p>
            <div className="pt-2">
              <Link
                to="/client/projects/new"
                className="inline-flex px-5 py-2.5 rounded-lg bg-[#003C5F] text-[#FDFBF7] text-sm font-semibold hover:bg-[#002B45] transition-colors"
              >
                + Create a new project
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {displayedList.map((project) => {
              const acceptedCount = (project.milestones || []).filter(
                (m) => m.status === 'accepted' || m.status === 'paid'
              ).length;
              const hasUnderReview = (project.milestones || []).some(
                (m) => m.status === 'under_review' || m.status === 'submitted'
              );

              return (
                <div
                  key={project.id}
                  className="bg-paper border border-[#003C5F]/15 rounded-xl p-6 sm:p-7 space-y-5 hover:border-[#003C5F]/35 transition-all shadow-sm"
                >
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 border-b border-[#003C5F]/10 pb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs uppercase tracking-wider text-[#455A6A] font-semibold">
                          Contract #{project.id.slice(0, 8)}
                        </span>
                        <StatusPill
                          status={
                            project.status === 'completed'
                              ? 'paid'
                              : hasUnderReview
                              ? 'under_review'
                              : 'active'
                          }
                        />
                      </div>
                      <h3 className="text-xl sm:text-2xl font-bold text-deepBlue">
                        {project.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-3">
                      <Link
                        to={`/client/projects/${project.id}`}
                        className="min-h-[38px] px-4 py-2 bg-deepBlue text-paper rounded-lg text-sm font-semibold hover:bg-[#002E4A] transition-colors flex items-center gap-1.5"
                      >
                        Open workspace &rarr;
                      </Link>
                    </div>
                  </div>

                  <p className="text-sm text-[#455A6A] leading-relaxed line-clamp-2">
                    {project.description}
                  </p>

                  {/* Skills badges */}
                  {project.skills && project.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {project.skills.map((skill) => (
                        <span
                          key={skill}
                          className="px-2.5 py-0.5 rounded text-xs bg-[#003C5F]/5 text-deepBlue border border-[#003C5F]/15"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Metrics Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 pt-3 border-t border-[#003C5F]/10 text-sm">
                    <div>
                      <span className="text-xs text-[#455A6A] block">Budget</span>
                      <span className="font-display text-lg text-deepBlue font-bold">
                        ${(project.budget || 0).toLocaleString()}
                      </span>
                    </div>

                    <div>
                      <span className="text-xs text-[#455A6A] block">Approved Value</span>
                      <span className="font-display text-lg text-[#24543A] font-bold">
                        ${(project.totalPaidSoFar || 0).toLocaleString()}
                      </span>
                    </div>

                    <div>
                      <span className="text-xs text-[#455A6A] block">Milestones</span>
                      <span className="font-semibold text-deepBlue">
                        {acceptedCount} of {(project.milestones || []).length} accepted
                      </span>
                    </div>

                    <div>
                      <span className="text-xs text-[#455A6A] block">Target Deadline</span>
                      <span className="font-semibold text-deepBlue">
                        {project.deadline || 'Not set'}
                      </span>
                    </div>

                    <div>
                      <span className="text-xs text-[#455A6A] block">Assigned Talent</span>
                      <span className={`font-semibold ${project.assignedFreelancer ? 'text-deepBlue' : 'text-[#874E0E]'}`}>
                        {project.assignedFreelancer ? project.assignedFreelancer.name : 'Yet to be assigned'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

