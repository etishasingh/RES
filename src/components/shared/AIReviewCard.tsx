import React from 'react';
import type { EvaluationResult, RequirementAssessmentStatus } from '../../types/freelancer';
import { useCountUp } from '../../hooks/useCountUp';

interface AIReviewCardProps {
  review: EvaluationResult;
  className?: string;
}

function getAssessmentBadge(status: RequirementAssessmentStatus) {
  switch (status) {
    case 'satisfied':
      return {
        label: 'Satisfied',
        badgeClass: 'bg-[#EAF5EF] text-[#24543A] border-[#B2DAC3]',
        dotClass: 'bg-[#2E6B4A]',
      };
    case 'partially_satisfied':
      return {
        label: 'Partially satisfied',
        badgeClass: 'bg-[#FAF3E7] text-[#874E0E] border-[#E8D2AC]',
        dotClass: 'bg-[#A86315]',
      };
    case 'not_satisfied':
      return {
        label: 'Not satisfied',
        badgeClass: 'bg-[#FDF2F2] text-[#9E3C3C] border-[#F5C2C2]',
        dotClass: 'bg-[#9E3C3C]',
      };
    case 'unverified':
    default:
      return {
        label: 'Unverified',
        badgeClass: 'bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]',
        dotClass: 'bg-[#94A3B8]',
      };
  }
}

export const AIReviewCard: React.FC<AIReviewCardProps> = ({ review, className = '' }) => {
  const rawScore = review.overall_score ?? review.overallScore ?? 0;
  const score = Math.round(rawScore);
  const animatedScore = useCountUp(score, { duration: 1000 });

  const rawConf = review.confidence ?? 0;
  const confPct = Math.round(rawConf <= 1 && rawConf > 0 ? rawConf * 100 : rawConf);
  const animatedConfidence = useCountUp(confPct, { duration: 800 });

  const assessments = review.requirement_assessments ?? review.requirementAssessments ?? [];
  const missingRequirements = review.missing_requirements ?? review.missingRequirements ?? [];
  const improvementSuggestions = review.improvement_suggestions ?? review.improvementSuggestions ?? [];
  const limitations = review.limitations ?? [];

  return (
    <div
      className={`bg-paper border border-[#003C5F]/20 rounded-xl p-6 space-y-6 ${className}`}
      aria-labelledby="ai-review-card-title"
    >
      {/* Header with ProofFlow model label */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#003C5F]/15 pb-4">
        <div className="flex items-center gap-3">
          <span
            id="ai-review-card-title"
            className="font-display text-2xl text-deepBlue"
          >
            Milestone Evaluation
          </span>
          <span className="px-2.5 py-0.5 rounded text-[13px] font-semibold bg-[#EBF3F8] text-[#003C5F] border border-[#B7D2E3]">
            AI evaluation (ProofFlow model)
          </span>
        </div>
        {review.reviewedAt && (
          <span className="text-[13px] text-[#455A6A] font-medium">
            Generated {review.reviewedAt}
          </span>
        )}
      </div>

      {/* Notice that the client makes the final decision */}
      <div className="p-3.5 rounded-lg bg-[#F6F3EC] border border-[#003C5F]/15 text-[13px] text-[#003C5F] leading-relaxed">
        <strong>Important notice:</strong> This automated evaluation is an advisory preview for the freelancer and client. The client evaluates the deliverables independently and makes the final acceptance and release decision.
      </div>

      {/* 1. Requirement checklist first */}
      <div className="space-y-3">
        <h4 className="text-[15px] font-semibold text-deepBlue">Requirement assessments</h4>
        <div className="space-y-2.5">
          {assessments.map((item, idx) => {
            const badge = getAssessmentBadge(item.status);
            const title =
              item.description ||
              item.criterion ||
              (item.criterion_id ? `Requirement ${item.criterion_id}` : `Requirement ${idx + 1}`);

            return (
              <div
                key={item.criterion_id || idx}
                className="p-3.5 rounded-lg bg-[#FDFBF7] border border-[#003C5F]/10 space-y-1.5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="font-medium text-[14px] text-deepBlue">{title}</span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[13px] font-medium border shrink-0 ${badge.badgeClass}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${badge.dotClass}`} />
                    {badge.label}
                  </span>
                </div>
                {item.explanation && (
                  <p className="text-[13px] text-[#455A6A] leading-relaxed">{item.explanation}</p>
                )}
                {item.evidence && (
                  <p className="text-[12px] text-[#455A6A]/85 italic bg-[#FAF8F3] p-2 rounded border border-[#003C5F]/5">
                    <span className="font-semibold not-italic text-[#003C5F]">Evidence:</span> {item.evidence}
                  </p>
                )}
                {!item.explanation && !item.evidence && item.detail && (
                  <p className="text-[13px] text-[#455A6A] leading-relaxed">{item.detail}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Missing requirements and improvement suggestions */}
      {(missingRequirements.length > 0 || improvementSuggestions.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {missingRequirements.length > 0 && (
            <div className="p-4 rounded-lg bg-[#FAF8F3] border border-[#003C5F]/10 space-y-2">
              <h5 className="text-[14px] font-semibold text-[#874E0E] flex items-center gap-1.5">
                <span>Items to verify before sign-off</span>
              </h5>
              <ul className="list-disc pl-4 space-y-1 text-[13px] text-[#455A6A]">
                {missingRequirements.map((item, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {improvementSuggestions.length > 0 && (
            <div className="p-4 rounded-lg bg-[#FAF8F3] border border-[#003C5F]/10 space-y-2">
              <h5 className="text-[14px] font-semibold text-[#003C5F] flex items-center gap-1.5">
                <span>Suggestions for subsequent milestones</span>
              </h5>
              <ul className="list-disc pl-4 space-y-1 text-[13px] text-[#455A6A]">
                {improvementSuggestions.map((item, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 3. Score labelled "AI score (estimate)" */}
      <div className="p-4 rounded-lg bg-[#FAF8F3] border border-[#003C5F]/10 space-y-2">
        <span className="text-[13px] uppercase tracking-wider text-[#455A6A] font-medium block">
          AI score (estimate)
        </span>
        <div className="flex items-baseline gap-2">
          <span className="font-display text-4xl text-deepBlue">{animatedScore}</span>
          <span className="text-sm text-[#455A6A]">/ 100</span>
        </div>
        <div className="w-full bg-[#E5DEC9] h-2 rounded-full overflow-hidden">
          <div
            className="bg-[#003C5F] h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${Math.min(100, Math.max(0, rawScore))}%` }}
          />
        </div>
        <p className="text-xs text-[#455A6A] pt-1">
          The final score combines the AI score and your client's score.
        </p>
      </div>

      {/* 4. Confidence and limitations in small text */}
      <div className="space-y-2 text-xs text-[#455A6A] pt-1 border-t border-[#003C5F]/10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            <strong>Confidence:</strong> {animatedConfidence}%
          </span>
          {review.evaluation_method && (
            <span className="text-[#455A6A]/80">
              Method: {review.evaluation_method}
            </span>
          )}
        </div>
        {limitations.length > 0 && (
          <div className="space-y-1">
            <span className="font-semibold text-[#455A6A]">Model Limitations:</span>
            <ul className="list-disc pl-4 space-y-0.5">
              {limitations.map((lim, idx) => (
                <li key={idx}>{lim}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
