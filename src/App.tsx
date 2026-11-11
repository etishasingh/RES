import React, { useEffect } from 'react';
import {
  HashRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from 'react-router-dom';

import { AuthProvider, useAuth } from './context/AuthContext';
import { BackgroundVideo } from './components/BackgroundVideo';
import { Navigation } from './components/Navigation';
import { SignUpForm } from './components/SignUpForm';
import { SignInForm } from './components/SignInForm';
import { FreelancerOnboarding } from './components/onboarding/FreelancerOnboarding';
import { FreelancerDashboard } from './components/dashboard/FreelancerDashboard';
import { JourneyPage } from './components/freelancer/JourneyPage';
import { LearningPage } from './components/freelancer/LearningPage';
import { ProjectsPage } from './components/freelancer/ProjectsPage';
import { InvitationPage } from './components/freelancer/InvitationPage';
import { WorkspacePage } from './components/freelancer/WorkspacePage';
import { ClientDashboardPage } from './components/client/ClientDashboardPage';
import { ClientProjectsPage } from './components/client/ClientProjectsPage';
import { CreateProjectPage } from './components/client/CreateProjectPage';
import { ClientProjectPage } from './components/client/ClientProjectPage';
import { ClientHistoryPage } from './components/client/ClientHistoryPage';
import { ClientPaymentsPage } from './components/client/ClientPaymentsPage';
import { ClientProfilePage } from './components/client/ClientProfilePage';
import { ImpactPage } from './components/impact/ImpactPage';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import type { UserRole, UserProfile } from './types/auth';

const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4';

// ── helpers ─────────────────────────────────────────────────────────────────

function getDestination(u: UserProfile | { role: string; onboardingCompleted?: boolean }) {
  if (u.role === 'client') return '/client/dashboard';
  if (u.role === 'freelancer') {
    return (u as { onboardingCompleted?: boolean }).onboardingCompleted
      ? '/freelancer/dashboard'
      : '/freelancer/onboarding';
  }
  return '/signin';
}

// ── auth-aware components ────────────────────────────────────────────────────

/** Redirects authenticated users away from sign-in/sign-up to their dashboard. */
function GuestGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#003C5F] flex items-center justify-center text-white">
        <div className="animate-spin h-8 w-8 border-4 border-white border-t-transparent rounded-full" />
      </div>
    );
  }
  if (user) return <Navigate to={getDestination(user)} replace />;
  return <>{children}</>;
}


/** Protects freelancer routes: redirects clients to /client/dashboard and unauthenticated users to /signin. */
function FreelancerGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#003C5F] flex items-center justify-center text-white">
        <div className="animate-spin h-8 w-8 border-4 border-white border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!user) return <Navigate to="/signin" state={{ from: location }} replace />;
  if (user.role !== 'freelancer') return <Navigate to="/client/dashboard" replace />;
  return <>{children}</>;
}

/** Protects client routes: redirects freelancers to /freelancer/dashboard and unauthenticated users to /signin. */
function ClientGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#003C5F] flex items-center justify-center text-white">
        <div className="animate-spin h-8 w-8 border-4 border-white border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!user) return <Navigate to="/signin" state={{ from: location }} replace />;
  if (user.role !== 'client') return <Navigate to="/freelancer/dashboard" replace />;
  return <>{children}</>;
}

// ── sign-in / sign-up shell ──────────────────────────────────────────────────

function AuthShell({ view }: { view: 'signin' | 'signup' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // For URL-based role selection on signup: ?role=client
  const params = new URLSearchParams(location.search.replace(/^#.*\?/, ''));
  const roleParam = params.get('role') as UserRole | null;
  const initialRole: UserRole = roleParam === 'client' ? 'client' : 'freelancer';

  function handleSuccess(u: UserProfile) {
    navigate(getDestination(u), { replace: true });
  }

  // fake navigateTo adapter so Navigation still works
  function navAdaptor(v: string, role?: UserRole) {
    if (v === 'dashboard' && user) navigate(getDestination(user));
    else if (v === 'signup') navigate(role ? `/signup?role=${role}` : '/signup');
    else navigate(`/${v}`);
  }

  // Set page title
  useEffect(() => {
    document.title =
      view === 'signup' ? 'PayPilot AI — Create Account' : 'PayPilot AI — Sign In';
  }, [view]);

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between overflow-x-hidden text-white font-body">
      <BackgroundVideo src={VIDEO_URL} />
      <Navigation
        currentView={view}
        onNavigate={(v, role) => navAdaptor(v, role)}
      />

      <main className="relative z-10 flex-1 max-w-[1280px] w-full mx-auto px-5 sm:px-8 py-8 sm:py-12 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-center">

          {/* Left editorial column */}
          <section className="lg:col-span-7 flex flex-col justify-center space-y-6">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium tracking-wide uppercase bg-white/10 text-white/90 border border-white/15 w-fit">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Autonomous Freelance Infrastructure
              </span>

              {view === 'signup' ? (
                <>
                  <h1 className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl tracking-tight leading-[0.95] text-white animate-fade-rise">
                    Empowering the independent vanguard.
                  </h1>
                  <p className="text-white/80 text-base sm:text-lg max-w-[34ch] leading-relaxed font-light animate-fade-rise-delay-1">
                    AI-powered skill verification, instant milestone settlements, and contract intelligence built for modern freelancers and hiring teams.
                  </p>
                </>
              ) : (
                <>
                  <h1 className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl tracking-tight leading-[0.95] text-white animate-fade-rise">
                    Your freelance flight control.
                  </h1>
                  <p className="text-white/80 text-base sm:text-lg max-w-[34ch] leading-relaxed font-light animate-fade-rise-delay-1">
                    Sign in to track verified deliverables, monitor milestone releases, and manage your collaborative projects.
                  </p>
                </>
              )}
            </div>

            <div className="pt-4 border-t border-white/10 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs animate-fade-rise-delay-2">
              <div>
                <p className="text-white/50 mb-0.5">Payment Model</p>
                <p className="text-white/90 font-medium">Smart Milestones</p>
              </div>
              <div>
                <p className="text-white/50 mb-0.5">Platform Security</p>
                <p className="text-white/90 font-medium">WCAG 2.2 AA Conforming</p>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <p className="text-white/50 mb-0.5">Architecture</p>
                <p className="text-white/90 font-medium">Decoupled Auth API</p>
              </div>
            </div>
          </section>

          {/* Right auth panel */}
          <section className="lg:col-span-5 w-full flex justify-center lg:justify-end">
            <div className="w-full max-w-[480px] liquid-glass rounded-3xl p-6 sm:p-8 shadow-2xl relative animate-fade-rise-delay-2">
              {view === 'signup' ? (
                <SignUpForm
                  initialRole={initialRole}
                  onNavigateToSignIn={() => navigate('/signin')}
                  onSuccess={handleSuccess}
                />
              ) : (
                <SignInForm
                  onNavigateToSignUp={() => navigate('/signup')}
                  onSuccess={handleSuccess}
                />
              )}
            </div>
          </section>

        </div>
      </main>

      <footer className="relative z-10 w-full max-w-[1280px] mx-auto px-5 sm:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/50 border-t border-white/10">
        <p>&copy; {new Date().getFullYear()} PayPilot AI. All rights reserved.</p>
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => navigate('/signup?role=freelancer')}
            className="hover:text-white transition-colors"
          >
            Freelancer Program
          </button>
          <button
            type="button"
            onClick={() => navigate('/signup?role=client')}
            className="hover:text-white transition-colors"
          >
            Client Portal
          </button>
        </div>
      </footer>
    </div>
  );
}

// ── freelancer dashboard wrapper ─────────────────────────────────────────────

function FreelancerDashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  useEffect(() => {
    document.title = 'PayPilot AI — Freelancer Dashboard';
  }, []);

  // Block clients from reaching freelancer dashboard
  if (user && user.role !== 'freelancer') {
    return <Navigate to={getDestination(user)} replace />;
  }

  async function handleNavigate(v: string) {
    if (v === 'signin') {
      await logout();
      navigate('/signin', { replace: true });
    } else if (v === 'onboarding') {
      navigate('/freelancer/onboarding');
    } else {
      navigate(`/${v}`);
    }
  }

  return (
    <FreelancerDashboard onNavigate={handleNavigate as (v: 'signin' | 'signup' | 'onboarding' | 'dashboard') => void} />
  );
}

// ── freelancer onboarding wrapper ────────────────────────────────────────────

function FreelancerOnboardingPage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();

  useEffect(() => {
    document.title = 'PayPilot AI — Freelancer Profile Onboarding';
  }, []);

  return (
    <FreelancerOnboarding
      onExit={() => navigate('/signin')}
      onComplete={() => {
        if (user) {
          setUser({ ...user, onboardingCompleted: true });
        }
        navigate('/freelancer/dashboard');
      }}
    />
  );
}

// client pages are imported at the top of this file

// ── root with router ──────────────────────────────────────────────────────────

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#003C5F] flex items-center justify-center text-white">
        <div className="animate-spin h-8 w-8 border-4 border-white border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <Routes>
      {/* Public */}
      <Route path="/signin" element={<GuestGuard><AuthShell view="signin" /></GuestGuard>} />
      <Route path="/signup" element={<GuestGuard><AuthShell view="signup" /></GuestGuard>} />

      {/* Protected – freelancer */}
      <Route
        path="/freelancer/dashboard"
        element={<FreelancerGuard><FreelancerDashboardPage /></FreelancerGuard>}
      />
      <Route
        path="/freelancer/onboarding"
        element={<FreelancerGuard><FreelancerOnboardingPage /></FreelancerGuard>}
      />
      <Route
        path="/freelancer/journey"
        element={<FreelancerGuard><JourneyPage /></FreelancerGuard>}
      />
      <Route
        path="/freelancer/learning"
        element={<FreelancerGuard><LearningPage /></FreelancerGuard>}
      />
      <Route
        path="/freelancer/projects"
        element={<FreelancerGuard><ProjectsPage /></FreelancerGuard>}
      />
      <Route
        path="/freelancer/projects/:id/invitation"
        element={<FreelancerGuard><InvitationPage /></FreelancerGuard>}
      />
      <Route
        path="/freelancer/projects/:id"
        element={<FreelancerGuard><WorkspacePage /></FreelancerGuard>}
      />

      {/* Protected – client */}
      <Route
        path="/client/dashboard"
        element={<ClientGuard><ClientDashboardPage /></ClientGuard>}
      />
      <Route
        path="/client/projects"
        element={<ClientGuard><ClientProjectsPage /></ClientGuard>}
      />
      <Route
        path="/client/projects/new"
        element={<ClientGuard><CreateProjectPage /></ClientGuard>}
      />
      <Route
        path="/client/projects/:id"
        element={<ClientGuard><ClientProjectPage /></ClientGuard>}
      />
      <Route
        path="/client/history"
        element={<ClientGuard><ClientHistoryPage /></ClientGuard>}
      />
      <Route
        path="/client/payments"
        element={<ClientGuard><ClientPaymentsPage /></ClientGuard>}
      />
      <Route
        path="/client/profile"
        element={<ClientGuard><ClientProfilePage /></ClientGuard>}
      />

      {/* PayPilot Impact */}
      <Route path="/impact" element={<ImpactPage />} />
      <Route path="/client/impact" element={<ClientGuard><ImpactPage /></ClientGuard>} />
      <Route path="/freelancer/impact" element={<FreelancerGuard><ImpactPage /></FreelancerGuard>} />

      {/* Catch-all */}
      <Route
        path="*"
        element={
          user ? <Navigate to={getDestination(user)} replace /> : <Navigate to="/signin" replace />
        }
      />
    </Routes>
  );
}

export const App: React.FC = () => (
  <HashRouter>
    <AuthProvider>
      <ErrorBoundary>
        <AppRoutes />
      </ErrorBoundary>
    </AuthProvider>
  </HashRouter>
);
