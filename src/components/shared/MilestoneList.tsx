import React from 'react';
import type { Milestone } from '../../types/freelancer';
import { StatusPill } from './StatusPill';

interface MilestoneListProps {
  milestones: Milestone[];
  activeMilestoneId?: string;
  onSelectMilestone?: (milestone: Milestone) => void;
  allowSelection?: boolean;
}

export const MilestoneList: React.FC<MilestoneListProps> = ({
  milestones,
  activeMilestoneId,
  onSelectMilestone,
  allowSelection = false,
}) => {
  return (
    <div className="space-y-3">
      {milestones.map((m, index) => {
        const isSelected = activeMilestoneId === m.id;
        return (
          <div
            key={m.id}
            onClick={() => allowSelection && onSelectMilestone?.(m)}
            className={`p-4 rounded-xl border transition-all text-left ${
              allowSelection ? 'cursor-pointer' : ''
            } ${
              isSelected
                ? 'bg-[#F4EFE6] border-[#003C5F] shadow-sm'
                : 'bg-paper border-[#003C5F]/15 hover:border-[#003C5F]/30'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-[#003C5F]/10 text-deepBlue flex items-center justify-center text-[13px] font-bold">
                  {m.number ?? index + 1}
                </span>
                <h4 className="text-[15px] font-semibold text-deepBlue">{m.title}</h4>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-display text-lg text-deepBlue">
                  ${(m.amount ?? 0).toLocaleString()}
                </span>
                <StatusPill status={m.status} />
              </div>
            </div>

            <div className="text-[13px] text-[#455A6A] flex flex-wrap items-center gap-4 pt-2 border-t border-[#003C5F]/10">
              <span>Target date: {m.dueDate || (m as any).due_date || 'Not set'}</span>
              {Array.isArray(m.acceptanceCriteria) && m.acceptanceCriteria.length > 0 && (
                <span>{m.acceptanceCriteria.length} acceptance criteria</span>
              )}
              {m.submittedAt && (
                <span className="text-[#874E0E] font-medium">Submitted on {m.submittedAt}</span>
              )}
            </div>

            {Array.isArray(m.acceptanceCriteria) && m.acceptanceCriteria.length > 0 && (
              <div className="mt-3 pt-3 border-t border-[#003C5F]/10">
                <p className="text-[13px] font-medium text-deepBlue mb-1.5">Acceptance Criteria:</p>
                <ul className="space-y-1 pl-4 list-disc text-[13px] text-[#455A6A]">
                  {m.acceptanceCriteria.map((criterion, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {criterion}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
