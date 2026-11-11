import React, { useState, useEffect } from 'react';

interface SpotlightBadgeProps {
  remainingSeconds?: number;
  expiresAt?: string;
  size?: 'sm' | 'md' | 'lg';
  showCountdown?: boolean;
}

export const SpotlightBadge: React.FC<SpotlightBadgeProps> = ({
  remainingSeconds: initialSeconds,
  expiresAt,
  size = 'md',
  showCountdown = true,
}) => {
  const [seconds, setSeconds] = useState<number>(() => {
    if (initialSeconds !== undefined) return initialSeconds;
    if (expiresAt) {
      const diff = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000);
      return Math.max(0, diff);
    }
    return 0;
  });

  useEffect(() => {
    if (seconds <= 0) return;
    const interval = setInterval(() => {
      setSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [seconds]);

  const formatTime = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m left`;
  };

  const isExpired = seconds <= 0;

  if (isExpired && showCountdown) {
    return null;
  }

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3.5 py-1.5 gap-2',
  }[size];

  return (
    <div
      className={`inline-flex items-center rounded-full font-medium tracking-wide border shadow-sm transition-all bg-gradient-to-r from-[#FFFBEB] via-[#FEF3C7] to-[#FDE68A] text-[#92400E] border-[#F59E0B]/40 ${sizeClasses}`}
      title="PayPilot Spotlight: Paid visibility highlight. Does not affect ML score or ranking."
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F59E0B] opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#D97706]" />
      </span>
      <span className="font-semibold uppercase tracking-wider text-[10px] text-[#B45309]">
        Featured Spotlight
      </span>
      {showCountdown && seconds > 0 && (
        <span className="text-[#92400E]/80 text-[10px] font-mono border-l border-[#F59E0B]/30 pl-1.5 ml-0.5">
          {formatTime(seconds)}
        </span>
      )}
    </div>
  );
};
