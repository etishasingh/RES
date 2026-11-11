import React, { useState } from 'react';
import { LoginPayload, UserProfile } from '../types/auth';
import { useAuth } from '../context/AuthContext';

interface SignInFormProps {
  onNavigateToSignUp: () => void;
  onSuccess?: (user: UserProfile) => void;
}

export const SignInForm: React.FC<SignInFormProps> = ({ onNavigateToSignUp, onSuccess }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Field validation states
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Loading & error feedback
  const [isLoading, setIsLoading] = useState(false);
  const [serverMessage, setServerMessage] = useState<{
    type: 'error' | 'info';
    text: string;
  } | null>(null);

  const [forgotPasswordNote, setForgotPasswordNote] = useState(false);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const validateField = (field: string, val: string): string => {
    switch (field) {
      case 'email':
        if (!val.trim()) return 'Please enter your email address.';
        if (!emailRegex.test(val.trim())) return 'Please enter a valid email (e.g. name@example.com).';
        return '';
      case 'password':
        if (!val) return 'Please enter your password.';
        return '';
      default:
        return '';
    }
  };

  const handleBlur = (field: string, val: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const error = validateField(field, val);
    setErrors((prev) => ({ ...prev, [field]: error }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerMessage(null);

    const newErrors: Record<string, string> = {
      email: validateField('email', email),
      password: validateField('password', password),
    };

    setErrors(newErrors);
    setTouched({ email: true, password: true });

    const firstInvalidField = Object.keys(newErrors).find((k) => !!newErrors[k]);
    if (firstInvalidField) {
      const el = document.getElementById(`signin-${firstInvalidField}`);
      el?.focus();
      return;
    }

    setIsLoading(true);

    const payload: LoginPayload = {
      email: email.trim(),
      password,
      rememberMe,
    };

    try {
      const user = await login(payload);
      onSuccess?.(user);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred while attempting sign in.';
      setServerMessage({ type: 'error', text: message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      {/* Form Header */}
      <div className="mb-6">
        <h2 className="font-display text-3xl sm:text-4xl text-white tracking-tight leading-tight mb-2">
          Welcome back.
        </h2>
        <p className="text-white/70 text-sm leading-relaxed">
          Pick up where you left off.
        </p>
      </div>

      {/* Backend connection / status notification */}
      {serverMessage && (
        <div
          role="alert"
          className="mb-5 p-3.5 rounded-xl border border-red-500/40 bg-red-950/40 text-red-200 text-xs leading-relaxed flex items-start gap-2.5 animate-fade-rise"
        >
          <span className="text-red-400 font-bold shrink-0">✕</span>
          <div>
            <p className="font-medium">{serverMessage.text}</p>
          </div>
        </div>
      )}

      {/* Forgot password pending notice */}
      {forgotPasswordNote && (
        <div
          role="status"
          className="mb-4 p-3 rounded-xl border border-amber-500/30 bg-amber-950/30 text-amber-200 text-xs leading-relaxed flex items-start justify-between gap-2"
        >
          <span>Self-service password recovery is pending until the backend mailing system is connected.</span>
          <button
            type="button"
            onClick={() => setForgotPasswordNote(false)}
            className="text-amber-400 hover:text-amber-300 font-bold shrink-0"
            aria-label="Dismiss note"
          >
            ✕
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Email Address */}
        <div>
          <label htmlFor="signin-email" className="block text-xs font-medium text-white/85 mb-1.5">
            Email address <span className="text-red-400">*</span>
          </label>
          <input
            id="signin-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (touched.email) {
                setErrors((prev) => ({ ...prev, email: validateField('email', e.target.value) }));
              }
            }}
            onBlur={() => handleBlur('email', email)}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'signin-email-error' : undefined}
            className={`w-full h-11 px-3.5 rounded-xl text-sm liquid-glass-input ${
              errors.email ? 'border-red-500 ring-1 ring-red-500/50' : ''
            }`}
          />
          {errors.email && (
            <p id="signin-email-error" role="alert" className="text-red-400 text-xs mt-1">
              {errors.email}
            </p>
          )}
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="signin-password" className="block text-xs font-medium text-white/85">
              Password <span className="text-red-400">*</span>
            </label>
            <button
              type="button"
              onClick={() => setForgotPasswordNote(true)}
              className="text-[12px] text-white/60 hover:text-white transition-colors cursor-pointer"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <input
              id="signin-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (touched.password) {
                  setErrors((prev) => ({
                    ...prev,
                    password: validateField('password', e.target.value),
                  }));
                }
              }}
              onBlur={() => handleBlur('password', password)}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'signin-password-error' : undefined}
              className={`w-full h-11 pl-3.5 pr-14 rounded-xl text-sm liquid-glass-input ${
                errors.password ? 'border-red-500 ring-1 ring-red-500/50' : ''
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-white/60 hover:text-white px-2 py-1 rounded transition-colors"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          {errors.password && (
            <p id="signin-password-error" role="alert" className="text-red-400 text-xs mt-1">
              {errors.password}
            </p>
          )}
        </div>

        {/* Remember me & safe signin */}
        <div className="flex items-center gap-2 pt-1">
          <input
            id="signin-remember"
            name="remember"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="w-4 h-4 rounded border-white/20 bg-black/40 text-white focus:ring-2 focus:ring-white cursor-pointer accent-white"
          />
          <label htmlFor="signin-remember" className="text-xs text-white/75 select-none cursor-pointer">
            Remember this device for 30 days
          </label>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-11 bg-white text-black font-semibold text-sm rounded-xl hover:bg-white/90 active:scale-[0.99] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 shadow-lg mt-3"
        >
          {isLoading ? (
            <>
              <svg
                className="animate-spin h-4 w-4 text-black"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Signing in...</span>
            </>
          ) : (
            'Sign in'
          )}
        </button>

        {/* Switch to Sign Up */}
        <div className="text-center pt-2">
          <p className="text-xs text-white/70">
            Don&apos;t have an account yet?{' '}
            <button
              type="button"
              onClick={onNavigateToSignUp}
              className="text-white font-medium underline underline-offset-2 hover:text-white/80 transition-colors cursor-pointer"
            >
              Create an account
            </button>
          </p>
        </div>
      </form>
    </div>
  );
};
