import React, { useState, useEffect } from 'react';
import { spotlightService } from '../../services/spotlightService';
import type { SpotlightPackage, SpotlightPurchase } from '../../types/spotlight';

interface SpotlightModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (purchase: SpotlightPurchase) => void;
  targetType: 'proposal' | 'project';
  targetId: string;
  targetTitle: string;
}

export const SpotlightModal: React.FC<SpotlightModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  targetType,
  targetId,
  targetTitle,
}) => {
  const [packages, setPackages] = useState<SpotlightPackage[]>([]);
  const [selectedPkgId, setSelectedPkgId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState<SpotlightPurchase | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setPurchaseSuccess(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    spotlightService
      .getPackages(targetType)
      .then((pkgs) => {
        setPackages(pkgs);
        if (pkgs.length > 0) {
          // Default to featured or middle package
          const def = pkgs.find((p) => p.id === 'pkg_featured') || pkgs[0];
          setSelectedPkgId(def.id);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to load Spotlight packages.');
      })
      .finally(() => setIsLoading(false));
  }, [isOpen, targetType]);

  if (!isOpen) return null;

  const handlePurchase = async () => {
    if (!selectedPkgId) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await spotlightService.purchase({
        target_type: targetType,
        target_id: targetId,
        package_id: selectedPkgId,
        payment_reference: `SANDBOX-SPOTLIGHT-${Date.now()}`,
      });
      setPurchaseSuccess(res);
      if (onSuccess) {
        onSuccess(res);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete Spotlight purchase.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedPkg = packages.find((p) => p.id === selectedPkgId);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="spotlight-modal-title"
    >
      <div className="relative w-full max-w-lg bg-[#FDFBF7] text-[#1E293B] rounded-2xl shadow-2xl border border-[#003C5F]/15 overflow-hidden">
        {/* Header with amber accent */}
        <div className="bg-gradient-to-r from-[#003C5F] to-[#002B45] text-[#FDFBF7] p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/30">
                ✨
              </span>
              <div>
                <span className="text-[11px] uppercase tracking-wider font-semibold text-[#F59E0B]">
                  PayPilot Spotlight
                </span>
                <h2 id="spotlight-modal-title" className="font-display text-xl sm:text-2xl text-paper">
                  {targetType === 'proposal' ? 'Highlight Proposal' : 'Boost Project Visibility'}
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-[#FDFBF7]/60 hover:text-[#FDFBF7] text-lg font-bold p-1 rounded transition-colors"
              aria-label="Close modal"
            >
              ✕
            </button>
          </div>
          <p className="mt-2 text-xs text-[#FDFBF7]/75 line-clamp-1">
            Target: <span className="font-medium text-[#FDFBF7]">{targetTitle}</span>
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-[#FAF3E7] border border-[#E8D2AC] text-[#874E0E] text-xs">
              {error}
            </div>
          )}

          {purchaseSuccess ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-[#EAF5EF] border border-[#B2DAC3] text-[#24543A] flex items-center justify-center text-2xl">
                ✓
              </div>
              <h3 className="font-display text-xl text-deepBlue">Spotlight Active!</h3>
              <p className="text-xs text-[#455A6A] max-w-sm mx-auto">
                Your {targetType} is now featured with enhanced visual prominence. 20% of your payment has been automatically credited to the PayPilot Impact social fund.
              </p>
              <div className="p-3 bg-[#F6F3EC] rounded-xl border border-[#003C5F]/10 text-xs text-[#455A6A]">
                Expires: <span className="font-semibold text-deepBlue">{new Date(purchaseSuccess.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-lg bg-deepBlue text-[#FDFBF7] font-semibold text-sm hover:bg-[#002B45] transition-colors"
              >
                Done
              </button>
            </div>
          ) : isLoading ? (
            <div className="py-12 text-center text-[#455A6A] text-sm">
              <div className="animate-spin h-6 w-6 border-2 border-deepBlue border-t-transparent rounded-full mx-auto mb-2" />
              Loading Spotlight packages...
            </div>
          ) : (
            <>
              {/* Package Selector */}
              <div className="space-y-3">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#455A6A]">
                  Select Visibility Tier
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {packages.map((pkg) => {
                    const isSelected = selectedPkgId === pkg.id;
                    return (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => setSelectedPkgId(pkg.id)}
                        className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-[#FFFBEB] border-[#F59E0B] ring-2 ring-[#F59E0B]/30'
                            : 'bg-white border-[#003C5F]/15 hover:border-[#003C5F]/30'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-xs text-deepBlue">{pkg.name}</span>
                            {pkg.id === 'pkg_featured' && (
                              <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-[#F59E0B] text-white font-bold">
                                Popular
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#455A6A]">{pkg.duration_hours} hours</p>
                        </div>
                        <div className="mt-3 pt-2 border-t border-[#003C5F]/10">
                          <span className="font-display text-lg text-deepBlue font-bold">
                            ${pkg.price}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected Package Details */}
              {selectedPkg && (
                <div className="p-3.5 bg-[#F6F3EC] rounded-xl border border-[#003C5F]/10 text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-deepBlue font-medium">
                    <span>Duration: {selectedPkg.duration_hours} hours of prominent placement</span>
                    <span>${selectedPkg.price} USD</span>
                  </div>
                  <p className="text-[#455A6A] text-[11px]">
                    Includes a golden Featured Spotlight badge and top-section carousel visibility.
                  </p>
                </div>
              )}

              {/* Strict Fairness & Anti-Manipulation Notice */}
              <div className="p-3 rounded-xl bg-[#FEF3C7]/40 border border-[#F59E0B]/30 text-[11px] text-[#92400E] space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <span>⚖️</span> Platform Fairness Guarantee
                </p>
                <p className="text-[10px] leading-relaxed text-[#78350F]">
                  PayPilot Spotlight provides temporary visual prominence only. It <strong>never</strong> alters ML matching scores, skill relevancy scores, or client ratings, and does not guarantee project selection. All normal bids remain visible and free.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="w-1/3 py-2.5 rounded-lg border border-[#003C5F]/20 text-[#455A6A] font-semibold text-xs hover:bg-[#F6F3EC] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePurchase}
                  disabled={isSubmitting || !selectedPkgId}
                  className="w-2/3 py-2.5 rounded-lg bg-deepBlue text-[#FDFBF7] font-semibold text-xs hover:bg-[#002B45] transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                      Activating Spotlight...
                    </>
                  ) : (
                    <>
                      <span>Pay ${selectedPkg?.price || 0} via Sandbox</span>
                      <span className="text-[10px] opacity-75">→</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
