import React, { FormEvent, useEffect, useState } from 'react';
import { ClientHeader } from '../shared/ClientHeader';
import { Toast } from '../shared/Toast';
import { useAuth } from '../../context/AuthContext';
import { useDemoStore } from '../../state/demoStore';
import { apiFetch } from '../../lib/api';

interface ClientProfileForm {
  organization: string;
  industry: string;
  website: string;
  location: string;
  about: string;
}

const emptyProfile: ClientProfileForm = {
  organization: '',
  industry: '',
  website: '',
  location: '',
  about: '',
};

const validate = (profile: ClientProfileForm) => {
  const errors: Partial<Record<keyof ClientProfileForm, string>> = {};
  if (profile.organization.length > 255) errors.organization = 'Organization must be at most 255 characters.';
  if (profile.industry.length > 100) errors.industry = 'Industry must be at most 100 characters.';
  if (profile.location.length > 100) errors.location = 'Location must be at most 100 characters.';
  if (profile.about.length > 2000) errors.about = 'About must be at most 2000 characters.';
  if (profile.website) {
    try {
      const url = new URL(profile.website);
      if (!['http:', 'https:'].includes(url.protocol)) errors.website = 'Website must start with http:// or https://.';
    } catch {
      errors.website = 'Website must be a valid http(s) URL.';
    }
  }
  return errors;
};

export const ClientProfilePage: React.FC = () => {
  const { user, setUser } = useAuth();
  const { showToast } = useDemoStore();
  const [profile, setProfile] = useState<ClientProfileForm>(emptyProfile);
  const [errors, setErrors] = useState<Partial<Record<keyof ClientProfileForm, string>>>({});
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch('/api/profile/me')
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load your organization profile.');
        return response.json() as Promise<ClientProfileForm>;
      })
      .then((data) => setProfile({
        organization: data.organization || '',
        industry: data.industry || '',
        website: data.website || '',
        location: data.location || '',
        about: data.about || '',
      }))
      .catch((error: unknown) => setLoadError(error instanceof Error ? error.message : 'Unable to load your organization profile.'))
      .finally(() => setLoading(false));
  }, []);

  const setField = (field: keyof ClientProfileForm, value: string) => {
    setProfile((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationErrors = validate(profile);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSaving(true);
    setLoadError('');
    try {
      const response = await apiFetch('/api/profile/me', {
        method: 'PATCH',
        body: JSON.stringify(profile),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.detail || 'Unable to save your organization profile.');
      setProfile({
        organization: data.organization || '', industry: data.industry || '', website: data.website || '',
        location: data.location || '', about: data.about || '',
      });
      if (user) setUser({ ...user, organization: data.organization || '' });
      showToast('Organization profile saved.', 'success');
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : 'Unable to save your organization profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#1E293B]">
      <ClientHeader
        title="Organization profile"
        subtitle="Keep your company details current for collaborators and project invitations."
        breadcrumbs={[{ label: 'Dashboard', path: '/client/dashboard' }, { label: 'Profile' }]}
      />
      <main className="max-w-[800px] mx-auto px-4 sm:px-8 py-10 sm:py-14">
        <section className="bg-[#FDFBF7] border border-[#003C5F]/15 rounded-xl p-6 sm:p-8">
          <div className="border-b border-[#003C5F]/10 pb-5 mb-6">
            <h1 className="font-display text-2xl sm:text-3xl text-deepBlue">Your organization</h1>
            <p className="mt-1 text-[15px] text-[#455A6A]">These details are visible only in your client account.</p>
          </div>
          {loading ? (
            <p role="status" className="text-[#455A6A]">Loading organization profile…</p>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {loadError && <p role="alert" className="rounded-lg border border-[#E8D2AC] bg-[#FAF3E7] px-4 py-3 text-sm text-[#874E0E]">{loadError}</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field label="Organization" field="organization" value={profile.organization} error={errors.organization} onChange={setField} maxLength={255} required />
                <Field label="Industry" field="industry" value={profile.industry} error={errors.industry} onChange={setField} maxLength={100} />
                <Field label="Website" field="website" value={profile.website} error={errors.website} onChange={setField} type="url" maxLength={2048} />
                <Field label="Location" field="location" value={profile.location} error={errors.location} onChange={setField} maxLength={100} />
              </div>
              <div>
                <label htmlFor="about" className="block text-sm font-semibold text-deepBlue">About your organization</label>
                <textarea id="about" rows={6} maxLength={2000} value={profile.about} onChange={(event) => setField('about', event.target.value)} aria-invalid={!!errors.about} aria-describedby={errors.about ? 'about-error' : undefined} className={`mt-1.5 w-full rounded-lg border px-3.5 py-3 text-sm text-deepBlue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deepBlue ${errors.about ? 'border-red-500' : 'border-[#003C5F]/20'}`} />
                {errors.about && <p id="about-error" role="alert" className="mt-1 text-xs text-red-600">{errors.about}</p>}
              </div>
              <div className="pt-2 flex justify-end">
                <button type="submit" disabled={saving} className="min-h-[42px] rounded-lg bg-deepBlue px-5 py-2 text-sm font-semibold text-[#FDFBF7] hover:bg-[#002E4A] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deepBlue">
                  {saving ? 'Saving…' : 'Save profile'}
                </button>
              </div>
            </form>
          )}
        </section>
      </main>
      <Toast />
    </div>
  );
};

function Field({ label, field, value, error, onChange, type = 'text', maxLength, required = false }: {
  label: string; field: keyof ClientProfileForm; value: string; error?: string;
  onChange: (field: keyof ClientProfileForm, value: string) => void; type?: string; maxLength: number; required?: boolean;
}) {
  const id = `client-${field}`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-deepBlue">{label}{required && <span className="text-red-600"> *</span>}</label>
      <input id={id} type={type} value={value} maxLength={maxLength} onChange={(event) => onChange(field, event.target.value)} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} className={`mt-1.5 min-h-[42px] w-full rounded-lg border px-3.5 text-sm text-deepBlue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deepBlue ${error ? 'border-red-500' : 'border-[#003C5F]/20'}`} />
      {error && <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
