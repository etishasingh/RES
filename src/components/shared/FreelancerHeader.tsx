import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { BackgroundVideo } from '../BackgroundVideo';
import { useAuth } from '../../context/AuthContext';

const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4';

interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface FreelancerHeaderProps {
  title?: string;
  subtitle?: string;
  dateLine?: string;
  breadcrumbs?: BreadcrumbItem[];
  children?: React.ReactNode;
}

export const FreelancerHeader: React.FC<FreelancerHeaderProps> = ({
  title,
  subtitle,
  dateLine,
  breadcrumbs,
  children,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const pathname = location.pathname;

  const isNavActive = (path: string) => {
    if (path === '/freelancer/projects') {
      return pathname.startsWith('/freelancer/projects');
    }
    return pathname === path;
  };

  const handleSignOut = async () => {
    await logout();
    navigate('/signin', { replace: true });
  };

  const displayName = user?.name || 'Freelancer';
  const displayMonogram = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="relative w-full bg-[#003C5F] text-[#FDFBF7] overflow-hidden pt-5 pb-10 sm:pb-14 px-4 sm:px-8 border-b border-[#003C5F]/20">
      <BackgroundVideo src={VIDEO_URL} />

      <div className="relative z-10 max-w-[1280px] mx-auto w-full flex flex-col justify-between">
        {/* Navigation Bar */}
        <nav
          className="w-full flex items-center justify-between pb-6 sm:pb-8 border-b border-[#FDFBF7]/15"
          aria-label="Freelancer Navigation"
        >
          {/* Logo & Workspace badge */}
          <div className="flex items-center gap-6">
            <Link
              to="/freelancer/dashboard"
              className="font-display text-2xl sm:text-3xl text-[#FDFBF7] hover:opacity-90 transition-opacity focus-visible:ring-2 focus-visible:ring-[#FDFBF7] rounded px-1 -mx-1"
            >
              PayPilot AI
            </Link>
            <span className="hidden sm:inline-block text-xs uppercase tracking-wider text-[#FDFBF7]/60 font-medium px-2.5 py-1 rounded border border-[#FDFBF7]/20">
              Freelancer Workspace
            </span>
          </div>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-6 text-[14px] font-medium">
            <Link
              to="/freelancer/dashboard"
              className={`min-h-[40px] px-3 py-1.5 transition-colors rounded focus-visible:ring-2 focus-visible:ring-[#FDFBF7] flex items-center ${
                isNavActive('/freelancer/dashboard')
                  ? 'text-[#FDFBF7] font-semibold border-b-2 border-[#FDFBF7]'
                  : 'text-[#FDFBF7]/75 hover:text-[#FDFBF7]'
              }`}
            >
              Dashboard
            </Link>
            <Link
              to="/freelancer/journey"
              className={`min-h-[40px] px-3 py-1.5 transition-colors rounded focus-visible:ring-2 focus-visible:ring-[#FDFBF7] flex items-center ${
                isNavActive('/freelancer/journey')
                  ? 'text-[#FDFBF7] font-semibold border-b-2 border-[#FDFBF7]'
                  : 'text-[#FDFBF7]/75 hover:text-[#FDFBF7]'
              }`}
            >
              Journey
            </Link>
            <Link
              to="/freelancer/learning"
              className={`min-h-[40px] px-3 py-1.5 transition-colors rounded focus-visible:ring-2 focus-visible:ring-[#FDFBF7] flex items-center ${
                isNavActive('/freelancer/learning')
                  ? 'text-[#FDFBF7] font-semibold border-b-2 border-[#FDFBF7]'
                  : 'text-[#FDFBF7]/75 hover:text-[#FDFBF7]'
              }`}
            >
              Learning
            </Link>
            <Link
              to="/freelancer/projects"
              className={`min-h-[40px] px-3 py-1.5 transition-colors rounded focus-visible:ring-2 focus-visible:ring-[#FDFBF7] flex items-center ${
                isNavActive('/freelancer/projects')
                  ? 'text-[#FDFBF7] font-semibold border-b-2 border-[#FDFBF7]'
                  : 'text-[#FDFBF7]/75 hover:text-[#FDFBF7]'
              }`}
            >
              Projects
            </Link>
            <Link
              to="/freelancer/impact"
              className={`min-h-[40px] px-3 py-1.5 transition-colors rounded focus-visible:ring-2 focus-visible:ring-[#FDFBF7] flex items-center ${
                pathname.includes('/impact')
                  ? 'text-[#FDFBF7] font-semibold border-b-2 border-[#FDFBF7]'
                  : 'text-[#FDFBF7]/75 hover:text-[#FDFBF7]'
              }`}
            >
              Impact
            </Link>
          </div>

          {/* User Monogram & Sign out */}
          <div className="hidden md:flex items-center gap-4">
            <div className="flex items-center gap-3 pl-3 border-l border-[#FDFBF7]/20">
              <div
                className="w-9 h-9 rounded-full bg-[#FDFBF7]/15 border border-[#FDFBF7]/30 flex items-center justify-center text-xs font-semibold tracking-wider text-[#FDFBF7]"
                aria-label={`User avatar for ${displayName}`}
              >
                {displayMonogram}
              </div>
              <div className="text-left text-xs">
                <p className="font-medium text-[#FDFBF7] leading-none mb-1">{displayName}</p>
                <p className="text-[#FDFBF7]/70 leading-none">Freelancer</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="min-h-[40px] text-xs text-[#FDFBF7]/75 hover:text-[#FDFBF7] px-2.5 py-1.5 rounded transition-colors focus-visible:ring-2 focus-visible:ring-[#FDFBF7] cursor-pointer"
            >
              Sign out
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden min-h-[40px] min-w-[40px] px-3 py-2 rounded-lg border border-[#FDFBF7]/25 text-xs text-[#FDFBF7] font-medium tracking-wide uppercase focus-visible:ring-2 focus-visible:ring-[#FDFBF7]"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-panel"
          >
            {mobileMenuOpen ? 'Close' : 'Menu'}
          </button>
        </nav>

        {/* Mobile Nav Drawer */}
        {mobileMenuOpen && (
          <div
            id="mobile-nav-panel"
            className="md:hidden mt-4 p-4 rounded-xl bg-[#002D47] border border-[#FDFBF7]/20 flex flex-col gap-2 text-sm text-[#FDFBF7] animate-fade-rise"
          >
            <div className="flex items-center gap-3 pb-3 border-b border-[#FDFBF7]/15">
              <div className="w-8 h-8 rounded-full bg-[#FDFBF7]/20 flex items-center justify-center font-semibold text-xs">
                {displayMonogram}
              </div>
              <div>
                <p className="font-medium text-[#FDFBF7]">{displayName}</p>
                <p className="text-xs text-[#FDFBF7]/70">Freelancer Account</p>
              </div>
            </div>
            <Link
              to="/freelancer/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className={`min-h-[40px] text-left px-2 py-2 rounded flex items-center ${
                isNavActive('/freelancer/dashboard')
                  ? 'bg-[#FDFBF7]/15 font-semibold'
                  : 'text-[#FDFBF7]/80'
              }`}
            >
              Dashboard
            </Link>
            <Link
              to="/freelancer/journey"
              onClick={() => setMobileMenuOpen(false)}
              className={`min-h-[40px] text-left px-2 py-2 rounded flex items-center ${
                isNavActive('/freelancer/journey')
                  ? 'bg-[#FDFBF7]/15 font-semibold'
                  : 'text-[#FDFBF7]/80'
              }`}
            >
              Journey
            </Link>
            <Link
              to="/freelancer/learning"
              onClick={() => setMobileMenuOpen(false)}
              className={`min-h-[40px] text-left px-2 py-2 rounded flex items-center ${
                isNavActive('/freelancer/learning')
                  ? 'bg-[#FDFBF7]/15 font-semibold'
                  : 'text-[#FDFBF7]/80'
              }`}
            >
              Learning
            </Link>
            <Link
              to="/freelancer/projects"
              onClick={() => setMobileMenuOpen(false)}
              className={`min-h-[40px] text-left px-2 py-2 rounded flex items-center ${
                isNavActive('/freelancer/projects')
                  ? 'bg-[#FDFBF7]/15 font-semibold'
                  : 'text-[#FDFBF7]/80'
              }`}
            >
              Projects
            </Link>
            <Link
              to="/freelancer/impact"
              onClick={() => setMobileMenuOpen(false)}
              className={`min-h-[40px] text-left px-2 py-2 rounded flex items-center ${
                pathname.includes('/impact')
                  ? 'bg-[#FDFBF7]/15 font-semibold'
                  : 'text-[#FDFBF7]/80'
              }`}
            >
              Impact
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="min-h-[40px] text-left px-2 py-2 text-xs text-[#FDFBF7]/70 border-t border-[#FDFBF7]/15 mt-1 cursor-pointer"
            >
              Sign out
            </button>
          </div>
        )}

        {/* Breadcrumbs if provided */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="pt-4 sm:pt-6">
            <ol className="flex items-center flex-wrap gap-2 text-[13px] text-[#FDFBF7]/70">
              {breadcrumbs.map((crumb, idx) => {
                const isLast = idx === breadcrumbs.length - 1;
                return (
                  <li key={idx} className="flex items-center gap-2">
                    {idx > 0 && <span className="text-[#FDFBF7]/40">/</span>}
                    {crumb.path && !isLast ? (
                      <Link
                        to={crumb.path}
                        className="hover:text-[#FDFBF7] underline underline-offset-2 transition-colors"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className={isLast ? 'text-[#FDFBF7] font-medium' : ''}>
                        {crumb.label}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
        )}

        {/* Headline / context area if provided */}
        {(title || subtitle || dateLine || children) && (
          <div className="pt-6 sm:pt-10">
            {dateLine && (
              <p className="text-[13px] uppercase tracking-widest text-[#FDFBF7]/70 font-medium mb-2.5">
                {dateLine}
              </p>
            )}
            {title && (
              <h1 className="font-display text-4xl sm:text-5xl md:text-6xl text-[#FDFBF7] tracking-tight leading-[1.05] mb-2.5">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="text-[15px] sm:text-base text-[#FDFBF7]/85 max-w-[65ch] leading-relaxed mb-4">
                {subtitle}
              </p>
            )}
            {children}
          </div>
        )}
      </div>
    </header>
  );
};
