import React, { useEffect, useState, useCallback } from 'react';
import { FreelancerHeader } from '../shared/FreelancerHeader';
import { Toast } from '../shared/Toast';
import { useCountUp } from '../../hooks/useCountUp';
import { freelancerService } from '../../services/freelancerService';
import type { LearningRoadmapData } from '../../types/freelancer';

export const LearningPage: React.FC = () => {
  const [data, setData] = useState<LearningRoadmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; status?: number } | null>(null);

  const fetchData = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    freelancerService
      .getLearningData()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setError({ message: err.message ?? 'Unknown error', status: (err as any).status });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.title = 'PayPilot AI — Learning & Skill Roadmap';
    const cancel = fetchData();
    return cancel;
  }, [fetchData]);

  const totalHours = data?.totalStudyHours ?? 0;
  const countHours = useCountUp(totalHours, { duration: 1000 });
  const countCourses = useCountUp(data?.courses.length ?? 0, { duration: 800 });
  const countGaps = useCountUp(data?.skillGaps.length ?? 0, { duration: 800 });

  /* ── Error states ─────────────────────────────────────────────────────── */

  if (error) {
    return (
      <div className="min-h-screen w-full flex flex-col bg-paper text-deepBlue font-sans">
        <FreelancerHeader
          title="Learning roadmap"
          subtitle=""
          dateLine="ProofFlow Skill Recommender"
        />
        <main className="flex-1 max-w-[720px] w-full mx-auto px-4 sm:px-8 py-16 text-center space-y-4">
          {error.status === 422 ? (
            <>
              <h2 className="font-display text-2xl">Profile incomplete</h2>
              <p className="text-[15px] text-[#455A6A]">
                The recommendation model needs your skills and preferences before it can generate suggestions.
              </p>
              <a
                href="/freelancer/onboarding"
                className="inline-block mt-2 px-5 py-2.5 rounded-lg bg-[#003C5F] text-[#FDFBF7] text-sm font-semibold hover:bg-[#00537F] transition-colors"
              >
                Complete onboarding
              </a>
            </>
          ) : error.status === 503 ? (
            <>
              <h2 className="font-display text-2xl">Model unavailable</h2>
              <p className="text-[15px] text-[#455A6A]">
                The recommendation model is unavailable right now. Please try again later.
              </p>
            </>
          ) : (
            <>
              <h2 className="font-display text-2xl">Something went wrong</h2>
              <p className="text-[15px] text-[#455A6A]">{error.message}</p>
              <button
                onClick={fetchData}
                className="inline-block mt-2 px-5 py-2.5 rounded-lg bg-[#003C5F] text-[#FDFBF7] text-sm font-semibold hover:bg-[#00537F] transition-colors"
              >
                Retry
              </button>
            </>
          )}
        </main>
        <Toast />
      </div>
    );
  }

  /* ── Loading state ────────────────────────────────────────────────────── */

  if (loading || !data) {
    return (
      <div className="min-h-screen w-full flex flex-col bg-paper text-deepBlue font-sans">
        <FreelancerHeader
          title="Learning roadmap"
          subtitle="Analysing your profile…"
          dateLine="ProofFlow Skill Recommender"
        />
        <main className="flex-1 max-w-[720px] w-full mx-auto px-4 sm:px-8 py-16 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-[#003C5F]/10 rounded w-2/3 mx-auto" />
            <div className="h-4 bg-[#003C5F]/10 rounded w-1/2 mx-auto" />
            <div className="h-4 bg-[#003C5F]/10 rounded w-3/4 mx-auto" />
          </div>
        </main>
        <Toast />
      </div>
    );
  }

  /* ── Data view ────────────────────────────────────────────────────────── */

  const { skillGaps, courses, milestones, opportunities } = data;
  const sortedGaps = [...skillGaps].sort((a, b) => b.demandCount - a.demandCount);

  return (
    <div className="min-h-screen w-full flex flex-col bg-paper text-deepBlue font-sans">
      <FreelancerHeader
        title="Learning roadmap"
        subtitle="Recommendations from the ProofFlow model"
        dateLine="ProofFlow Skill Recommender"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 max-w-[800px]">
          <div className="p-4 rounded-xl bg-[#FDFBF7]/10 border border-[#FDFBF7]/20">
            <span className="text-[13px] uppercase tracking-wider text-[#FDFBF7]/70 font-medium block mb-1">
              Identified skill gaps
            </span>
            <span className="font-display text-4xl text-white">{countGaps}</span>
            <span className="text-[13px] text-[#FDFBF7]/60 block mt-1">From top opportunities</span>
          </div>

          <div className="p-4 rounded-xl bg-[#FDFBF7]/10 border border-[#FDFBF7]/20">
            <span className="text-[13px] uppercase tracking-wider text-[#FDFBF7]/70 font-medium block mb-1">
              Curated courses
            </span>
            <span className="font-display text-4xl text-white">{countCourses}</span>
            <span className="text-[13px] text-[#FDFBF7]/60 block mt-1">Matched to your gaps</span>
          </div>

          <div className="p-4 rounded-xl bg-[#FDFBF7]/10 border border-[#FDFBF7]/20">
            <span className="text-[13px] uppercase tracking-wider text-[#FDFBF7]/70 font-medium block mb-1">
              Roadmap duration
            </span>
            <div className="flex items-baseline gap-1">
              <span className="font-display text-4xl text-white">{countHours}</span>
              <span className="text-sm text-[#FDFBF7]/70">hrs</span>
            </div>
            <span className="text-[13px] text-[#FDFBF7]/60 block mt-1">
              ~{data.totalEstimatedWeeks} weeks at your pace
            </span>
          </div>
        </div>
      </FreelancerHeader>

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-8 py-10 sm:py-14 space-y-12">
        {/* ── Section 1: Skill Gaps ──────────────────────────────────────── */}
        <section className="space-y-6">
          <div className="border-b border-[#003C5F]/15 pb-3">
            <h2 className="font-display text-3xl text-deepBlue">Skill gaps</h2>
            <p className="text-[15px] text-[#455A6A] mt-1">
              Skills most commonly required by your top-matched opportunities.
            </p>
          </div>

          {sortedGaps.length === 0 ? (
            <p className="text-[15px] text-[#455A6A] italic">
              No skill gaps detected — your profile matches the available opportunities well.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {sortedGaps.map((gap) => (
                <div
                  key={gap.skill}
                  className="bg-paper border border-[#003C5F]/15 rounded-xl p-5 flex flex-col justify-between hover:border-[#003C5F]/35 transition-all"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded text-[13px] font-semibold bg-[#FAF3E7] text-[#874E0E] border border-[#E8D2AC]">
                      {gap.demandCount} {gap.demandCount === 1 ? 'opportunity' : 'opportunities'}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-deepBlue">{gap.skill}</h3>
                  <p className="text-[13px] text-[#455A6A] mt-2">
                    Missing in {gap.demandCount} of your top matched opportunities
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Section 2: Recommended Courses ────────────────────────────── */}
        <section className="space-y-6">
          <div className="border-b border-[#003C5F]/15 pb-3">
            <h2 className="font-display text-3xl text-deepBlue">Recommended courses</h2>
            <p className="text-[15px] text-[#455A6A] mt-1">
              Courses selected to close the identified skill gaps.
            </p>
          </div>

          {courses.length === 0 ? (
            <p className="text-[15px] text-[#455A6A] italic">
              No courses to recommend at this time.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {courses.map((course) => (
                <div
                  key={course.course_id}
                  className="bg-paper border border-[#003C5F]/15 rounded-xl p-5 space-y-4 hover:border-[#003C5F]/35 transition-all"
                >
                  <div>
                    <span className="text-[13px] uppercase tracking-wider text-[#455A6A] font-medium block mb-1">
                      {course.difficulty_level} &middot; {course.platform}
                    </span>
                    <h3 className="text-lg font-semibold text-deepBlue leading-snug">
                      {course.title}
                    </h3>
                    <p className="text-[13px] text-[#455A6A] mt-1">{course.provider_institution}</p>
                  </div>

                  {course.skills_taught && course.skills_taught.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {course.skills_taught.map((skill: string) => (
                        <span
                          key={skill}
                          className="text-[12px] px-2 py-0.5 rounded bg-[#F2EDE2] text-deepBlue border border-[#003C5F]/10 font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[13px] pt-3 border-t border-[#003C5F]/10 text-[#455A6A]">
                    <span>{course.workload_hours} hrs &middot; {course.duration_weeks} wks</span>
                    <span className="text-deepBlue font-medium">
                      Score: {course.relevance_score}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Section 3: Top Opportunities ──────────────────────────────── */}
        {opportunities.length > 0 && (
          <section className="space-y-6">
            <div className="border-b border-[#003C5F]/15 pb-3">
              <h2 className="font-display text-3xl text-deepBlue">Top opportunity matches</h2>
              <p className="text-[15px] text-[#455A6A] mt-1">
                Opportunities ranked by overall match score.
              </p>
            </div>

            <div className="space-y-4">
              {opportunities.slice(0, 5).map((opp) => (
                <div
                  key={opp.opportunity_id}
                  className="bg-paper border border-[#003C5F]/15 rounded-xl p-5 sm:p-6 transition-all hover:border-[#003C5F]/30"
                >
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 mb-3">
                    <h3 className="text-lg font-semibold text-deepBlue">{opp.title}</h3>
                    <span className="px-2 py-0.5 rounded text-[13px] font-semibold bg-[#E8F5EE] text-[#2E6B4A] border border-[#B4D9C3] whitespace-nowrap">
                      {opp.overall_match_score}/100
                    </span>
                  </div>
                  <p className="text-[14px] text-[#455A6A] leading-relaxed">{opp.explanation}</p>

                  {opp.skills_matched.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {opp.skills_matched.map((s: string) => (
                        <span key={s} className="text-[12px] px-2 py-0.5 rounded bg-[#E8F5EE] text-[#2E6B4A] border border-[#B4D9C3] font-medium">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Section 4: Roadmap Milestones ─────────────────────────────── */}
        <section className="space-y-6">
          <div className="border-b border-[#003C5F]/15 pb-3">
            <h2 className="font-display text-3xl text-deepBlue">Learning roadmap</h2>
            <p className="text-[15px] text-[#455A6A] mt-1">
              Phased milestones to close your skill gaps at your own pace.
            </p>
          </div>

          {milestones.length === 0 ? (
            <p className="text-[15px] text-[#455A6A] italic">
              No milestones generated — your skill profile already covers the top opportunities.
            </p>
          ) : (
            <div className="space-y-4">
              {milestones.map((ms, idx) => (
                <div
                  key={idx}
                  className="bg-paper border border-[#003C5F]/15 rounded-xl p-5 sm:p-6 transition-all hover:border-[#003C5F]/30"
                >
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-[#003C5F]/10 pb-3 mb-4">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-[#003C5F] text-[#FDFBF7] flex items-center justify-center font-display text-lg">
                        {idx + 1}
                      </span>
                      <div>
                        <span className="text-[13px] uppercase tracking-wider text-[#455A6A] font-medium block">
                          ~{ms.workload_hours} hrs &middot; {ms.estimated_weeks_at_pace} wks
                        </span>
                        <h3 className="text-lg sm:text-xl font-semibold text-deepBlue">
                          {ms.phase}
                        </h3>
                      </div>
                    </div>
                    <span className="text-[13px] px-2 py-0.5 rounded bg-[#F2EDE2] text-deepBlue border border-[#003C5F]/10 font-medium">
                      {ms.target_skill}
                    </span>
                  </div>

                  <div className="space-y-2 text-[14px] text-[#455A6A]">
                    <p>
                      <span className="text-deepBlue font-medium">Course: </span>
                      {ms.recommended_course} ({ms.platform})
                    </p>
                    <p>
                      <span className="text-deepBlue font-medium">Why: </span>
                      {ms.projected_impact}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <Toast />
    </div>
  );
};
