import React, { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FreelancerHeader } from '../shared/FreelancerHeader';
import { StatusPill } from '../shared/StatusPill';
import { Toast } from '../shared/Toast';
import type { ProjectDiscipline } from '../../types/freelancer';
import { projectService } from '../../services/projectService';

type TabType = 'active' | 'invitations' | 'completed';

export const ProjectsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabType) || 'active';
  const [currentTab, setCurrentTab] = useState<TabType>(initialTab);

  const [projects, setProjects] = useState<any[]>([]);
  const [loadError, setLoadError] = useState('');
  useEffect(() => { Promise.all([projectService.assigned(), projectService.invitations()]).then(([assigned, invitations]) => setProjects([
    ...assigned.map((p) => ({ id: p.id, client: 'Client', clientAvatarText: 'CL', title: p.title, discipline: 'Engineering', requiredSkills: p.skills, totalBudget: p.budget_max ?? p.budget_min ?? 0, deadline: p.milestones.find((m) => m.due_date)?.due_date || 'Not set', status: p.status === 'completed' ? 'completed' : 'active' })),
    ...invitations.filter((item) => item.status === 'pending' && item.project).map((item) => ({ id: item.project_id, invitationId: item.id, client: 'Client', clientAvatarText: 'CL', title: item.project!.title, discipline: 'Engineering', requiredSkills: item.project!.skills, totalBudget: item.project!.budget_max ?? item.project!.budget_min ?? 0, deadline: item.project!.milestones.find((m) => m.due_date)?.due_date || 'Not set', status: 'invitation' })),
  ])).catch((error) => setLoadError(error instanceof Error ? error.message : 'Unable to load projects.')); }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDiscipline, setSelectedDiscipline] = useState<'All' | ProjectDiscipline>('All');

  useEffect(() => {
    document.title = 'PayPilot AI — Freelancer Projects';
  }, []);

  const handleTabChange = (tab: TabType) => {
    setCurrentTab(tab);
    setSearchParams({ tab });
  };

  const activeList = useMemo(() => projects.filter((p) => p.status === 'active'), [projects]);
  const invitationsList = useMemo(
    () => projects.filter((p) => p.status === 'invitation'),
    [projects]
  );
  const completedList = useMemo(
    () => projects.filter((p) => p.status === 'completed'),
    [projects]
  );

  const currentList = useMemo(() => {
    let list = activeList;
    if (currentTab === 'invitations') list = invitationsList;
    if (currentTab === 'completed') list = completedList;

    return list.filter((item) => {
      if (selectedDiscipline !== 'All' && item.discipline !== selectedDiscipline) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesClient = item.client.toLowerCase().includes(q);
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesSkills = item.requiredSkills.some((s: string) => s.toLowerCase().includes(q));
        if (!matchesClient && !matchesTitle && !matchesSkills) return false;
      }
      return true;
    });
  }, [
    currentTab,
    activeList,
    invitationsList,
    completedList,
    selectedDiscipline,
    searchQuery,
  ]);

  return (
    <div className="min-h-screen w-full flex flex-col bg-paper text-deepBlue font-sans">
      <FreelancerHeader
        title="Projects directory"
        subtitle="Manage your active milestone commitments, incoming project briefs, and completed contracts."
        dateLine="Project Operations"
      />

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-8 py-10 sm:py-14 space-y-8">
        {loadError && <p role="alert" className="text-sm text-[#874E0E]">{loadError}</p>}
        {/* Tabs Bar */}
        <div className="flex items-center gap-3 border-b border-[#003C5F]/15 pb-2">
          <button
            type="button"
            onClick={() => handleTabChange('active')}
            className={`min-h-[42px] px-5 py-2 rounded-lg text-[15px] font-medium transition-colors cursor-pointer flex items-center gap-2 ${
              currentTab === 'active'
                ? 'bg-deepBlue text-paper font-semibold'
                : 'text-[#455A6A] hover:text-deepBlue hover:bg-[#F2EDE2]'
            }`}
          >
            <span>Active projects</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                currentTab === 'active'
                  ? 'bg-paper/20 text-paper'
                  : 'bg-[#003C5F]/10 text-deepBlue'
              }`}
            >
              {activeList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('invitations')}
            className={`min-h-[42px] px-5 py-2 rounded-lg text-[15px] font-medium transition-colors cursor-pointer flex items-center gap-2 ${
              currentTab === 'invitations'
                ? 'bg-deepBlue text-paper font-semibold'
                : 'text-[#455A6A] hover:text-deepBlue hover:bg-[#F2EDE2]'
            }`}
          >
            <span>Invitations</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                currentTab === 'invitations'
                  ? 'bg-paper/20 text-paper'
                  : 'bg-[#003C5F]/10 text-deepBlue'
              }`}
            >
              {invitationsList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('completed')}
            className={`min-h-[42px] px-5 py-2 rounded-lg text-[15px] font-medium transition-colors cursor-pointer flex items-center gap-2 ${
              currentTab === 'completed'
                ? 'bg-deepBlue text-paper font-semibold'
                : 'text-[#455A6A] hover:text-deepBlue hover:bg-[#F2EDE2]'
            }`}
          >
            <span>Completed</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                currentTab === 'completed'
                  ? 'bg-paper/20 text-paper'
                  : 'bg-[#003C5F]/10 text-deepBlue'
              }`}
            >
              {completedList.length}
            </span>
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#F6F3EC] p-3.5 sm:p-4 rounded-xl border border-[#003C5F]/10">
          <div className="relative flex-1 min-w-[240px]">
            <label htmlFor="projects-search" className="sr-only">
              Search projects
            </label>
            <input
              id="projects-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by client, title, or skills..."
              className="w-full min-h-[42px] px-4 py-2 bg-paper text-deepBlue border border-[#003C5F]/20 rounded-lg text-[15px] placeholder:text-[#455A6A]/70 focus-visible:ring-2 focus-visible:ring-deepBlue focus-visible:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-[#455A6A] font-medium mr-1">Discipline:</span>
            {(['All', 'Design', 'Engineering', 'Writing'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setSelectedDiscipline(d)}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors cursor-pointer ${
                  selectedDiscipline === d
                    ? 'bg-deepBlue text-paper'
                    : 'bg-paper text-deepBlue border border-[#003C5F]/20 hover:bg-[#F0EBE1]'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* AG-Grid Theme Table (Desktop) */}
        <div className="hidden lg:block overflow-x-auto border border-[#003C5F]/15 rounded-xl bg-paper">
          <table className="w-full text-left border-collapse" aria-label="Projects Table">
            <thead>
              <tr className="border-b border-[#003C5F]/15 bg-[#F6F3EC] text-[13px] uppercase tracking-wider text-[#455A6A] font-semibold">
                <th scope="col" className="py-3.5 px-5">Client</th>
                <th scope="col" className="py-3.5 px-5">Project title</th>
                <th scope="col" className="py-3.5 px-5">Skills</th>
                <th scope="col" className="py-3.5 px-5">Contract total</th>
                <th scope="col" className="py-3.5 px-5">Target date</th>
                <th scope="col" className="py-3.5 px-5">Status</th>
                <th scope="col" className="py-3.5 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#003C5F]/10 text-[15px]">
              {currentList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 px-5 text-center text-[#455A6A]">
                    No projects found for this filter.
                  </td>
                </tr>
              ) : (
                currentList.map((project) => (
                  <tr
                    key={project.id}
                    className="hover:bg-[#F8F5EE] transition-colors focus-within:bg-[#F8F5EE]"
                  >
                    <td className="py-4 px-5 font-medium text-deepBlue whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-full bg-[#003C5F]/10 text-deepBlue flex items-center justify-center font-bold text-xs">
                          {project.clientAvatarText}
                        </span>
                        <span>{project.client}</span>
                      </div>
                    </td>
                    <td className="py-4 px-5 font-semibold text-deepBlue max-w-[280px]">
                      {project.title}
                    </td>
                    <td className="py-4 px-5">
                      <div className="flex flex-wrap gap-1.5">
                        {project.requiredSkills.slice(0, 3).map((s: string) => (
                          <span
                            key={s}
                            className="text-[13px] px-2 py-0.5 rounded bg-[#F2EDE2] text-deepBlue border border-[#003C5F]/10 whitespace-nowrap"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-4 px-5 font-display text-lg text-deepBlue whitespace-nowrap">
                      ${project.totalBudget.toLocaleString()}
                    </td>
                    <td className="py-4 px-5 text-[#455A6A] text-[14px] whitespace-nowrap">
                      {project.deadline}
                    </td>
                    <td className="py-4 px-5 whitespace-nowrap">
                      <StatusPill status={project.status} />
                    </td>
                    <td className="py-4 px-5 text-right whitespace-nowrap">
                      {project.status === 'invitation' ? (
                        <Link
                          to={`/freelancer/projects/${project.id}/invitation`}
                          className="inline-flex items-center min-h-[38px] px-4 py-1.5 bg-deepBlue text-paper rounded-lg text-[13px] font-medium hover:bg-[#002E4A] transition-colors"
                        >
                          Review brief
                        </Link>
                      ) : (
                        <Link
                          to={`/freelancer/projects/${project.id}`}
                          className="inline-flex items-center min-h-[38px] px-4 py-1.5 bg-[#F2EDE2] text-deepBlue border border-[#003C5F]/20 rounded-lg text-[13px] font-medium hover:bg-[#E8DFC8] transition-colors"
                        >
                          {project.status === 'completed' ? 'View record' : 'Open workspace'}
                        </Link>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Stacked Cards for Mobile */}
        <div className="lg:hidden space-y-4">
          {currentList.length === 0 ? (
            <div className="py-10 px-4 text-center text-[#455A6A] bg-[#F6F3EC] rounded-xl border border-[#003C5F]/10">
              No projects found for this filter.
            </div>
          ) : (
            currentList.map((project) => (
              <article
                key={project.id}
                className="bg-paper border border-[#003C5F]/15 rounded-xl p-5 space-y-3.5"
              >
                <div className="flex items-baseline justify-between gap-2 border-b border-[#003C5F]/10 pb-3">
                  <span className="text-[13px] uppercase tracking-wider text-[#455A6A] font-medium">
                    {project.client}
                  </span>
                  <StatusPill status={project.status} />
                </div>

                <h3 className="text-lg font-semibold text-deepBlue leading-snug">
                  {project.title}
                </h3>

                <div className="flex flex-wrap gap-1.5">
                  {project.requiredSkills.map((skill: string) => (
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
                    <span className="text-[13px] text-[#455A6A] block">Contract</span>
                    <span className="font-display text-lg text-deepBlue">
                      ${project.totalBudget.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[13px] text-[#455A6A] block">Target date</span>
                    <span className="text-[14px] text-deepBlue">{project.deadline}</span>
                  </div>
                </div>

                <div className="pt-2">
                  {project.status === 'invitation' ? (
                    <Link
                      to={`/freelancer/projects/${project.id}/invitation`}
                      className="block w-full text-center min-h-[42px] px-4 py-2.5 bg-deepBlue text-paper rounded-lg text-[14px] font-medium hover:bg-[#002E4A] transition-colors"
                    >
                      Review brief
                    </Link>
                  ) : (
                    <Link
                      to={`/freelancer/projects/${project.id}`}
                      className="block w-full text-center min-h-[42px] px-4 py-2.5 bg-[#F2EDE2] text-deepBlue border border-[#003C5F]/20 rounded-lg text-[14px] font-medium hover:bg-[#E8DFC8] transition-colors"
                    >
                      {project.status === 'completed' ? 'View record' : 'Open workspace'}
                    </Link>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </main>

      <Toast />
    </div>
  );
};
