import React from 'react';
import type { MilestoneStatus } from '../../types/freelancer';

interface StatusPillProps {
  status: MilestoneStatus | 'invitation' | 'active' | 'completed';
  className?: string;
}

export const StatusPill: React.FC<StatusPillProps> = ({ status, className = '' }) => {
  let label = '';
  let dotColor = 'bg-[#64748B]';
  let badgeClasses = 'bg-[#F2EDE2] text-[#455A6A] border-[#003C5F]/15';

  switch (status) {
    case 'not_started':
      label = 'Not started';
      dotColor = 'bg-[#94A3B8]';
      badgeClasses = 'bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]';
      break;
    case 'in_progress':
      label = 'In progress';
      dotColor = 'bg-[#003C5F]';
      badgeClasses = 'bg-[#EBF3F8] text-[#003C5F] border-[#B7D2E3]';
      break;
    case 'submitted':
    case 'under_review':
      label = 'Under client review';
      dotColor = 'bg-[#A86315]';
      badgeClasses = 'bg-[#FAF3E7] text-[#874E0E] border-[#E8D2AC]';
      break;
    case 'accepted':
      label = 'Milestone accepted';
      dotColor = 'bg-[#2E6B4A]';
      badgeClasses = 'bg-[#EAF5EF] text-[#24543A] border-[#B2DAC3]';
      break;
    case 'paid':
      label = 'Paid via Sandbox';
      dotColor = 'bg-[#2E6B4A]';
      badgeClasses = 'bg-[#EAF5EF] text-[#24543A] border-[#B2DAC3]';
      break;
    case 'invitation':
      label = 'Open invitation';
      dotColor = 'bg-[#7C3AED]';
      badgeClasses = 'bg-[#F3EFFE] text-[#5B21B6] border-[#DDD0FA]';
      break;
    case 'active':
      label = 'Active contract';
      dotColor = 'bg-[#003C5F]';
      badgeClasses = 'bg-[#EBF3F8] text-[#003C5F] border-[#B7D2E3]';
      break;
    case 'completed':
      label = 'Completed';
      dotColor = 'bg-[#2E6B4A]';
      badgeClasses = 'bg-[#EAF5EF] text-[#24543A] border-[#B2DAC3]';
      break;
    default:
      label = status;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] font-medium border ${badgeClasses} ${className}`}
    >
      <span className={`w-2 h-2 rounded-full ${dotColor}`} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
};
