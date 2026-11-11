import React, { useState } from 'react';
import { UserRole, RegisterPayload, UserProfile } from '../types/auth';
import { useAuth } from '../context/AuthContext';
import { RoleSelector } from './RoleSelector';
import { SkillSelector } from './SkillSelector';

interface SignUpFormProps {
  initialRole?: UserRole;
  onNavigateToSignIn: () => void;
  onSuccess?: (user: UserProfile) => void;
}

export const SignUpForm: React.FC<SignUpFormProps> = ({
  initialRole = 'freelancer',
  onNavigateToSignIn,
  onSuccess,
}) => {
  const { register } = useAuth();
  const [role, setRole] = useState<UserRole>(initialRole);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [headline, setHeadline] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [organization, setOrganization] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Field error messages
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Submission state
  const [isLoading, setIsLoading] = useState(false);
  const [serverMessage, setServerMessage] = useState<{
    type: 'error' | 'info';
    text: string;
  } | null>(null);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const validateField = (field: string, val: string): string => {
    switch (field) {
      case 'name':
        if (!val.trim()) return 'Please enter your full name.';
        if (val.trim().length < 2) return 'Name must be at least 2 characters.';
        return '';
      case 'email':
        if (!val.trim()) return 'Please enter your email address.';
        if (!emailRegex.test(val.trim())) return 'Please enter a valid email (e.g. name@example.com).';
        return '';
      case 'password':
        if (!val) return 'Please create a password.';
        if (val.length < 8) return 'Password must be at least 8 characters.';
        if (new TextEncoder().encode(val).length > 72) return 'Password must be at most 72 UTF-8 bytes.';
        return '';
      case 'confirmPassword':
        if (!val) return 'Please confirm your password.';
        if (val !== password) return 'Passwords do not match.';
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

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    if (newRole === 'client' && errors.skills) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.skills;
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerMessage(null);

    // Validate all standard fields
    const newErrors: Record<string, string> = {
      name: validateField('name', name),
      email: validateField('email', email),
      password: validateField('password', password),
      confirmPassword: validateField('confirmPassword', confirmPassword),
    };

    // Freelancer specific validation: at least one skill required
    if (role === 'freelancer' && selectedSkills.length === 0) {
      newErrors.skills = 'Please select at least one skill to continue.';
    }

    setErrors(newErrors);
    setTouched({
      name: true,
      email: true,
      password: true,
      confirmPassword: true,
      skills: true,
    });

    const firstInvalidField = Object.keys(newErrors).find((k) => !!newErrors[k]);
    if (firstInvalidField) {
      if (firstInvalidField === 'skills') {
        const el =
          document.getElementById('custom-skill-input') ||
          document.getElementById('skills-section-label');
        el?.focus();
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        const el = document.getElementById(`signup-${firstInvalidField}`);
        el?.focus();
      }
      return;
    }

    setIsLoading(true);

    // Build payload ensuring strict role isolation:
    // Freelancer: skills (required array), headline (optional string)
    // Client: organization (optional string), NO skills or headline
    // Neither: experience level is collected or sent
    const payload: RegisterPayload = {
      name: name.trim(),
      email: email.trim(),
      password,
      role,
      ...(role === 'freelancer'
        ? {
            skills: selectedSkills,
            ...(headline.trim() ? { headline: headline.trim() } : {}),
          }
        : {}),
      ...(role === 'client'
        ? {
            ...(organization.trim() ? { organization: organization.trim() } : {}),
          }
        : {}),
    };

    try {
      const user = await register(payload);
      onSuccess?.(user);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred while attempting registration.';
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
          Build what&apos;s next.
        </h2>
        <p className="text-white/70 text-sm leading-relaxed">
          Create your PayPilot AI account and take the next step in your freelance journey.
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

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Role Selector */}
        <RoleSelector selectedRole={role} onChange={handleRoleChange} />

        {/* Full Name */}
        <div>
          <label htmlFor="signup-name" className="block text-xs font-medium text-white/85 mb-1.5">
            Full name <span className="text-red-400">*</span>
          </label>
          <input
            id="signup-name"
            name="name"
            type="text"
            autoComplete="name"
            placeholder="Jane Doe"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (touched.name) {
                setErrors((prev) => ({ ...prev, name: validateField('name', e.target.value) }));
              }
            }}
            onBlur={() => handleBlur('name', name)}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'signup-name-error' : undefined}
            className={`w-full h-11 px-3.5 rounded-xl text-sm liquid-glass-input ${
              errors.name ? 'border-red-500 ring-1 ring-red-500/50' : ''
            }`}
          />
          {errors.name && (
            <p id="signup-name-error" role="alert" className="text-red-400 text-xs mt-1">
              {errors.name}
            </p>
          )}
        </div>

        {/* Email Address */}
        <div>
          <label htmlFor="signup-email" className="block text-xs font-medium text-white/85 mb-1.5">
            Email address <span className="text-red-400">*</span>
          </label>
          <input
            id="signup-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="jane@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (touched.email) {
                setErrors((prev) => ({ ...prev, email: validateField('email', e.target.value) }));
              }
            }}
            onBlur={() => handleBlur('email', email)}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'signup-email-error' : undefined}
            className={`w-full h-11 px-3.5 rounded-xl text-sm liquid-glass-input ${
              errors.email ? 'border-red-500 ring-1 ring-red-500/50' : ''
            }`}
          />
          {errors.email && (
            <p id="signup-email-error" role="alert" className="text-red-400 text-xs mt-1">
              {errors.email}
            </p>
          )}
        </div>

        {/* Role-specific fields */}
        {role === 'freelancer' ? (
          <div className="space-y-4 pt-1">
            {/* Professional Headline */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="signup-headline" className="block text-xs font-medium text-white/85">
                  Professional headline (optional)
                </label>
                <span className="text-white/40 text-[11px]">Optional</span>
              </div>
              <input
                id="signup-headline"
                name="headline"
                type="text"
                placeholder="e.g. Aspiring Machine Learning Engineer"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl text-sm liquid-glass-input placeholder:text-white/30"
              />
            </div>

            {/* Selectable Skill Chips */}
            <SkillSelector
              selectedSkills={selectedSkills}
              onChange={(skills) => {
                setSelectedSkills(skills);
                if (errors.skills && skills.length > 0) {
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next.skills;
                    return next;
                  });
                }
              }}
              error={errors.skills}
              onClearError={() => {
                if (errors.skills) {
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next.skills;
                    return next;
                  });
                }
              }}
            />
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="signup-org" className="block text-xs font-medium text-white/85">
                Company or organization name
              </label>
              <span className="text-white/40 text-[11px]">Optional</span>
            </div>
            <input
              id="signup-org"
              name="organization"
              type="text"
              placeholder="e.g. Apex Digital Studios Ltd."
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl text-sm liquid-glass-input placeholder:text-white/30"
            />
          </div>
        )}

        {/* Password */}
        <div>
          <label htmlFor="signup-password" className="block text-xs font-medium text-white/85 mb-1.5">
            Password <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <input
              id="signup-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              maxLength={72}
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
              aria-describedby={errors.password ? 'signup-password-error' : undefined}
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
            <p id="signup-password-error" role="alert" className="text-red-400 text-xs mt-1">
              {errors.password}
            </p>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <label htmlFor="signup-confirm-password" className="block text-xs font-medium text-white/85 mb-1.5">
            Confirm password <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <input
              id="signup-confirm-password"
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (touched.confirmPassword) {
                  setErrors((prev) => ({
                    ...prev,
                    confirmPassword: validateField('confirmPassword', e.target.value),
                  }));
                }
              }}
              onBlur={() => handleBlur('confirmPassword', confirmPassword)}
              aria-invalid={!!errors.confirmPassword}
              aria-describedby={errors.confirmPassword ? 'signup-confirm-error' : undefined}
              className={`w-full h-11 pl-3.5 pr-14 rounded-xl text-sm liquid-glass-input ${
                errors.confirmPassword ? 'border-red-500 ring-1 ring-red-500/50' : ''
              }`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-white/60 hover:text-white px-2 py-1 rounded transition-colors"
            >
              {showConfirmPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          {errors.confirmPassword && (
            <p id="signup-confirm-error" role="alert" className="text-red-400 text-xs mt-1">
              {errors.confirmPassword}
            </p>
          )}
        </div>

        {/* Terms notice */}
        <p className="text-[11px] text-white/50 leading-relaxed pt-1">
          By signing up, you agree to PayPilot AI&apos;s Terms of Service and Privacy Policy. Password managers and paste are fully supported.
        </p>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-11 bg-white text-black font-semibold text-sm rounded-xl hover:bg-white/90 active:scale-[0.99] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 shadow-lg mt-2"
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
              <span>Creating account...</span>
            </>
          ) : (
            'Create account'
          )}
        </button>

        {/* Switch to Sign In */}
        <div className="text-center pt-2">
          <p className="text-xs text-white/70">
            Already have a PayPilot AI account?{' '}
            <button
              type="button"
              onClick={onNavigateToSignIn}
              className="text-white font-medium underline underline-offset-2 hover:text-white/80 transition-colors cursor-pointer"
            >
              Sign in
            </button>
          </p>
        </div>
      </form>
    </div>
  );
};
