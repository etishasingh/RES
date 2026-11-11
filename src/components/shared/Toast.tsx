import React from 'react';
import { useDemoStore } from '../../state/demoStore';

export const Toast: React.FC = () => {
  const { toasts, dismissToast } = useDemoStore();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-md w-full px-4 pointer-events-none"
    >
      {toasts.map((toast) => {
        let borderClass = 'border-[#003C5F]/20';
        let bgClass = 'bg-[#003C5F] text-[#FDFBF7]';
        let icon = 'ℹ️';

        if (toast.type === 'success') {
          borderClass = 'border-[#2E6B4A]/40';
          bgClass = 'bg-[#002D47] text-[#FDFBF7]';
          icon = '✓';
        } else if (toast.type === 'caution') {
          borderClass = 'border-[#A86315]/40';
          bgClass = 'bg-[#2A1D0E] text-[#FDFBF7]';
          icon = '⚠️';
        }

        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto p-4 rounded-xl border shadow-xl flex items-start gap-3 transition-all duration-200 animate-fade-rise ${bgClass} ${borderClass}`}
          >
            <span className="font-bold text-sm shrink-0 pt-0.5">{icon}</span>
            <div className="flex-1 text-[13px] leading-relaxed">
              <p>{toast.text}</p>
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="text-[#FDFBF7]/60 hover:text-[#FDFBF7] text-xs font-bold px-1.5 py-0.5 rounded focus-visible:ring-2 focus-visible:ring-white shrink-0"
              aria-label="Dismiss notification"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
};
