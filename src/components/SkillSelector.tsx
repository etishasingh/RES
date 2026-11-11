import React, { useState } from 'react';

export const PREDEFINED_SKILLS: readonly string[] = [
  'Python',
  'JavaScript',
  'TypeScript',
  'React',
  'HTML & CSS',
  'UI/UX Design',
  'Data Analysis',
  'Machine Learning',
  'Data Science',
  'Graphic Design',
  'Content Writing',
  'Digital Marketing',
  'Video Editing',
  'Figma',
] as const;

export const MAX_SKILLS_LIMIT = 10;

interface SkillSelectorProps {
  selectedSkills: string[];
  onChange: (skills: string[]) => void;
  error?: string;
  onClearError?: () => void;
}

export const SkillSelector: React.FC<SkillSelectorProps> = ({
  selectedSkills,
  onChange,
  error,
  onClearError,
}) => {
  const [customSkillInput, setCustomSkillInput] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);

  // Identify any custom skills (skills present in selectedSkills that are not in the predefined catalogue)
  const customSkills = selectedSkills.filter(
    (skill) => !PREDEFINED_SKILLS.some((pre) => pre.toLowerCase() === skill.toLowerCase())
  );

  const toggleSkill = (skill: string) => {
    setCustomError(null);
    onClearError?.();

    const exists = selectedSkills.some(
      (s) => s.toLowerCase() === skill.toLowerCase()
    );

    if (exists) {
      // Deselect/remove
      onChange(selectedSkills.filter((s) => s.toLowerCase() !== skill.toLowerCase()));
    } else {
      if (selectedSkills.length >= MAX_SKILLS_LIMIT) {
        setCustomError(`Maximum limit of ${MAX_SKILLS_LIMIT} skills reached.`);
        return;
      }
      onChange([...selectedSkills, skill]);
    }
  };

  const handleAddCustomSkill = (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    setCustomError(null);

    const trimmed = customSkillInput.trim();

    if (!trimmed) {
      setCustomError('Please enter a skill name.');
      return;
    }

    // Check duplicate ignoring case and surrounding whitespace
    const isDuplicate = selectedSkills.some(
      (s) => s.trim().toLowerCase() === trimmed.toLowerCase()
    );

    if (isDuplicate) {
      setCustomError(`"${trimmed}" has already been added.`);
      return;
    }

    if (selectedSkills.length >= MAX_SKILLS_LIMIT) {
      setCustomError(`Maximum limit of ${MAX_SKILLS_LIMIT} skills reached. Remove a skill to add another.`);
      return;
    }

    onClearError?.();
    onChange([...selectedSkills, trimmed]);
    setCustomSkillInput('');
  };

  const removeCustomSkill = (skillToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCustomError(null);
    onChange(selectedSkills.filter((s) => s !== skillToRemove));
  };

  return (
    <div className="space-y-3">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
        <label id="skills-section-label" className="block text-xs font-medium text-white/85">
          Skills <span className="text-red-400">*</span>
        </label>
        <span className="text-[11px] text-white/50" aria-live="polite">
          Select 1 to {MAX_SKILLS_LIMIT} skills ({selectedSkills.length}/{MAX_SKILLS_LIMIT})
        </span>
      </div>

      <p className="text-xs text-white/60 leading-relaxed">
        Choose skills that represent your freelance services. Our AI pathway model uses these to recommend relevant projects.
      </p>

      {/* Predefined Skill Chips */}
      <div
        role="group"
        aria-labelledby="skills-section-label"
        className="flex flex-wrap gap-2 pt-0.5"
      >
        {PREDEFINED_SKILLS.map((skill) => {
          const isSelected = selectedSkills.some(
            (s) => s.toLowerCase() === skill.toLowerCase()
          );

          return (
            <button
              key={skill}
              type="button"
              role="checkbox"
              aria-checked={isSelected}
              onClick={() => toggleSkill(skill)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 cursor-pointer flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-white ${
                isSelected
                  ? 'bg-white text-black border border-white shadow-sm'
                  : 'bg-white/5 text-white/80 border border-white/15 hover:bg-white/10 hover:text-white hover:border-white/30'
              }`}
            >
              {isSelected && (
                <svg
                  className="w-3.5 h-3.5 text-black shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              <span>{skill}</span>
            </button>
          );
        })}
      </div>

      {/* Custom Skills List (if user added custom skills) */}
      {customSkills.length > 0 && (
        <div className="pt-2">
          <span className="block text-[11px] uppercase tracking-wider font-semibold text-white/60 mb-2">
            Custom Skills Added
          </span>
          <div className="flex flex-wrap gap-2">
            {customSkills.map((custom) => (
              <span
                key={custom}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white text-black border border-white shadow-sm"
              >
                <span>{custom}</span>
                <button
                  type="button"
                  onClick={(e) => removeCustomSkill(custom, e)}
                  aria-label={`Remove custom skill ${custom}`}
                  className="w-4 h-4 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center transition-colors text-black font-bold text-xs cursor-pointer focus-visible:ring-2 focus-visible:ring-black"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Custom Skill Input & Action */}
      <div className="pt-1.5">
        <div className="flex items-center gap-2">
          <input
            type="text"
            id="custom-skill-input"
            value={customSkillInput}
            onChange={(e) => {
              setCustomSkillInput(e.target.value);
              if (customError) setCustomError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddCustomSkill();
              }
            }}
            placeholder="Add another skill (e.g. Next.js, Docker)"
            maxLength={40}
            disabled={selectedSkills.length >= MAX_SKILLS_LIMIT}
            aria-label="Add custom skill"
            aria-describedby={customError ? 'custom-skill-error' : undefined}
            className="flex-1 h-9 px-3 rounded-lg text-xs liquid-glass-input placeholder:text-white/35 disabled:opacity-40 disabled:cursor-not-allowed"
          />
          <button
            type="button"
            onClick={() => handleAddCustomSkill()}
            disabled={!customSkillInput.trim() || selectedSkills.length >= MAX_SKILLS_LIMIT}
            className="h-9 px-3.5 bg-white/10 hover:bg-white/20 active:bg-white/25 text-white text-xs font-medium rounded-lg border border-white/20 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-white"
          >
            Add skill
          </button>
        </div>

        {/* Custom skill error message */}
        {customError && (
          <p id="custom-skill-error" role="alert" className="text-amber-300 text-xs mt-1.5 flex items-center gap-1.5">
            <span>&bull;</span>
            <span>{customError}</span>
          </p>
        )}
      </div>

      {/* Required Skills Selection Validation Error */}
      {error && (
        <p id="signup-skills-error" role="alert" className="text-red-400 text-xs mt-1 font-medium flex items-center gap-1">
          <span aria-hidden="true">&times;</span>
          <span>{error}</span>
        </p>
      )}
    </div>
  );
};
