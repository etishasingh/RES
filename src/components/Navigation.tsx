import React, { useState } from 'react';
import { UserRole } from '../types/auth';

interface NavigationProps {
  currentView: 'signin' | 'signup' | 'onboarding' | 'dashboard';
  onNavigate: (view: 'signin' | 'signup' | 'onboarding' | 'dashboard', role?: UserRole) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentView, onNavigate }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLinkClick = (view: 'signin' | 'signup' | 'onboarding' | 'dashboard', role?: UserRole) => {
    onNavigate(view, role);
    setMobileMenuOpen(false);
  };

  return (
    <header className="w-full relative z-30 pt-6 px-4 sm:px-8">
      <nav
        className="max-w-[1280px] mx-auto liquid-glass rounded-full px-6 sm:px-8 py-3.5 sm:py-4 flex items-center justify-between transition-all duration-300"
        aria-label="Main Navigation"
      >
        {/* Brand */}
        <button
          type="button"
          onClick={() => handleLinkClick('signin')}
          className="font-display text-[28px] sm:text-[32px] leading-none text-white tracking-tight hover:opacity-90 transition-opacity focus-visible:ring-2 focus-visible:ring-white rounded-lg p-1 -m-1"
        >
          PayPilot AI
        </button>

        {/* Desktop Navigation Links */}
        <div className="hidden md:flex items-center gap-7 text-sm font-medium">
          <button
            type="button"
            onClick={() => handleLinkClick('signup', 'freelancer')}
            className="text-white/80 hover:text-white transition-colors cursor-pointer py-1"
          >
            For freelancers
          </button>
          <button
            type="button"
            onClick={() => handleLinkClick('signup', 'client')}
            className="text-white/80 hover:text-white transition-colors cursor-pointer py-1"
          >
            For clients
          </button>
          <button
            type="button"
            onClick={() => handleLinkClick('signin')}
            className={`transition-colors cursor-pointer py-1 ${
              currentView === 'signin'
                ? 'text-white font-semibold underline underline-offset-4 decoration-white/60'
                : 'text-white/80 hover:text-white'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => handleLinkClick('signup')}
            className="bg-white text-black font-semibold px-5 py-2 rounded-full hover:bg-white/90 active:scale-[0.98] transition-all duration-150 shadow-sm cursor-pointer ml-1"
          >
            Get started
          </button>
        </div>

        {/* Mobile Hamburger Button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          className="md:hidden text-white/90 hover:text-white p-2 rounded-full border border-white/20 text-xs uppercase tracking-wider font-semibold focus-visible:ring-2 focus-visible:ring-white"
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-nav-menu"
        >
          {mobileMenuOpen ? 'Close' : 'Menu'}
        </button>

        {/* Mobile Dropdown Panel */}
        {mobileMenuOpen && (
          <div
            id="mobile-nav-menu"
            className="absolute top-[calc(100%+12px)] left-4 right-4 liquid-glass rounded-2xl p-5 flex flex-col gap-3 shadow-2xl md:hidden z-50 animate-fade-rise"
          >
            <button
              type="button"
              onClick={() => handleLinkClick('signup', 'freelancer')}
              className="text-left text-white/85 hover:text-white py-2 text-sm font-medium border-b border-white/10"
            >
              For freelancers
            </button>
            <button
              type="button"
              onClick={() => handleLinkClick('signup', 'client')}
              className="text-left text-white/85 hover:text-white py-2 text-sm font-medium border-b border-white/10"
            >
              For clients
            </button>
            <button
              type="button"
              onClick={() => handleLinkClick('signin')}
              className="text-left text-white/85 hover:text-white py-2 text-sm font-medium border-b border-white/10"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => handleLinkClick('signup')}
              className="w-full bg-white text-black font-semibold py-2.5 rounded-xl hover:bg-white/90 transition-all text-center text-sm mt-1"
            >
              Get started
            </button>
          </div>
        )}
      </nav>
    </header>
  );
};
