import React from 'react';
import { UserRole } from '../types/auth';

interface RoleSelectorProps {
  selectedRole: UserRole;
  onChange: (role: UserRole) => void;
}

export const RoleSelector: React.FC<RoleSelectorProps> = ({ selectedRole, onChange }) => {
  return (
    <div className="space-y-2">
      <label id="role-selector-label" className="block text-xs font-semibold uppercase tracking-wider text-white/80">
        I want to join as
      </label>
      <div
        role="radiogroup"
        aria-labelledby="role-selector-label"
        className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
      >
        {/* Freelancer Option */}
        <button
          type="button"
          role="radio"
          aria-checked={selectedRole === 'freelancer'}
          onClick={() => onChange('freelancer')}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              onChange('freelancer');
            }
          }}
          className={`flex flex-col text-left p-3.5 rounded-xl border transition-all duration-200 cursor-pointer ${
            selectedRole === 'freelancer'
              ? 'bg-white text-black border-white shadow-md'
              : 'liquid-glass-input text-white/85 hover:text-white hover:border-white/40'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1">
            <span className="font-semibold text-sm">Freelancer</span>
            <span
              className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                selectedRole === 'freelancer'
                  ? 'border-black bg-black'
                  : 'border-white/40 bg-transparent'
              }`}
            >
              {selectedRole === 'freelancer' && (
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
              )}
            </span>
          </div>
          <span
            className={`text-xs ${
              selectedRole === 'freelancer' ? 'text-black/70' : 'text-white/60'
            }`}
          >
            Find work & manage payments
          </span>
        </button>

        {/* Client / Hiring Manager Option */}
        <button
          type="button"
          role="radio"
          aria-checked={selectedRole === 'client'}
          onClick={() => onChange('client')}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              onChange('client');
            }
          }}
          className={`flex flex-col text-left p-3.5 rounded-xl border transition-all duration-200 cursor-pointer ${
            selectedRole === 'client'
              ? 'bg-white text-black border-white shadow-md'
              : 'liquid-glass-input text-white/85 hover:text-white hover:border-white/40'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1">
            <span className="font-semibold text-sm">Client / Manager</span>
            <span
              className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                selectedRole === 'client'
                  ? 'border-black bg-black'
                  : 'border-white/40 bg-transparent'
              }`}
            >
              {selectedRole === 'client' && (
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
              )}
            </span>
          </div>
          <span
            className={`text-xs ${
              selectedRole === 'client' ? 'text-black/70' : 'text-white/60'
            }`}
          >
            Hire talent & process payouts
          </span>
        </button>
      </div>
    </div>
  );
};
