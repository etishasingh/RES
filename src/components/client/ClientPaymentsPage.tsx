import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClientHeader } from '../shared/ClientHeader';
import { useReveal } from '../../hooks/useReveal';
import { useCountUp } from '../../hooks/useCountUp';
import { paymentService } from '../../services/paymentService';
import type { PaymentTransaction } from '../../types/client';

const STATUS_CONFIG = {
  paid_sandbox: {
    label: 'Paid (Sandbox)',
    className: 'bg-[#EAF5EF] text-[#24543A] border-[#B2DAC3]',
  },
  pending_approval: {
    label: 'Pending Approval',
    className: 'bg-[#FAF3E7] text-[#874E0E] border-[#E8D2AC]',
  },
  scheduled: {
    label: 'Scheduled',
    className: 'bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]',
  },
};

export const ClientPaymentsPage: React.FC = () => {
  const [clientPayments, setClientPayments] = useState<PaymentTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const { ref: pageRef } = useReveal<HTMLDivElement>();

  useEffect(() => {
    document.title = 'PayPilot AI — Payments';
    setIsLoading(true);
    setLoadError('');
    paymentService
      .listMyPayments()
      .then(setClientPayments)
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : 'Unable to load payment transactions.');
      })
      .finally(() => setIsLoading(false));
  }, []);

  const totalPaidSandbox = clientPayments
    .filter((t) => t.status === 'paid_sandbox')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalAllAllocated = clientPayments.reduce((sum, t) => sum + t.amount, 0);
  const totalRemaining = Math.max(0, totalAllAllocated - totalPaidSandbox);

  const countPaid = useCountUp(totalPaidSandbox, { duration: 900 });
  const countRemaining = useCountUp(totalRemaining, { duration: 900 });

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#1E293B]">
      <ClientHeader
        breadcrumbs={[
          { label: 'Dashboard', path: '/client/dashboard' },
          { label: 'Payments' },
        ]}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div ref={pageRef} className="space-y-8">
          {/* Page Header with Sandbox Notice */}
          <div className="border-b border-[#003C5F]/15 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <span className="text-[13px] font-semibold text-[#003C5F] tracking-wide uppercase">
                  Transaction Ledger
                </span>
                <h1 className="font-display text-3xl sm:text-4xl text-deepBlue mt-1">
                  Payments
                </h1>
              </div>

              {/* Prominent Sandbox Notice */}
              <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-[#FAF3E7] border border-[#E8D2AC] max-w-sm">
                <svg
                  className="w-5 h-5 text-[#A86315] flex-shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <circle cx="12" cy="12" r="10" strokeWidth="2" />
                  <line x1="12" y1="8" x2="12" y2="12" strokeWidth="2" />
                  <circle cx="12" cy="16" r="1" fill="currentColor" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-[#874E0E]">PayPal Sandbox Only</p>
                  <p className="text-[13px] text-[#874E0E]/80 mt-0.5 leading-relaxed">
                    These transactions use PayPal&apos;s test environment. No real money moves.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          {clientPayments.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-paper border border-[#003C5F]/15 rounded-xl p-6">
                <div className="text-[13px] text-[#455A6A] mb-1">Total Paid (Sandbox)</div>
                <div className="font-display text-3xl text-[#24543A]">
                  ${countPaid.toLocaleString()}
                </div>
                <div className="text-[13px] text-[#455A6A] mt-1.5">
                  Across {clientPayments.filter((t) => t.status === 'paid_sandbox').length} settled transactions
                </div>
              </div>

              <div className="bg-paper border border-[#003C5F]/15 rounded-xl p-6">
                <div className="text-[13px] text-[#455A6A] mb-1">Remaining Allocated</div>
                <div className="font-display text-3xl text-[#874E0E]">
                  ${countRemaining.toLocaleString()}
                </div>
                <div className="text-[13px] text-[#455A6A] mt-1.5">
                  Pending milestone approvals
                </div>
              </div>

              <div className="bg-paper border border-[#003C5F]/15 rounded-xl p-6">
                <div className="text-[13px] text-[#455A6A] mb-1">Total Transactions</div>
                <div className="font-display text-3xl text-deepBlue">{clientPayments.length}</div>
                <div className="text-[13px] text-[#455A6A] mt-1.5">
                  Including pending and scheduled
                </div>
              </div>
            </div>
          )}

          {/* Transactions Table or Loading / Empty State */}
          {loadError && (
            <div role="alert" className="p-4 rounded-xl bg-[#FDF2F2] border border-[#F5C2C2] text-sm text-[#991B1B]">
              {loadError}
            </div>
          )}

          {isLoading ? (
            <div className="bg-paper border border-[#003C5F]/15 rounded-xl p-12 text-center space-y-3">
              <div className="animate-spin h-7 w-7 border-4 border-[#003C5F] border-t-transparent rounded-full mx-auto" />
              <p className="text-sm text-[#455A6A]">Loading PayPal Sandbox transactions…</p>
            </div>
          ) : clientPayments.length === 0 ? (
            <div className="bg-paper border border-[#003C5F]/15 rounded-xl p-16 text-center space-y-4">
              <svg
                className="w-12 h-12 text-[#003C5F]/20 mx-auto"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
              <h2 className="font-display text-2xl text-deepBlue">No transactions yet</h2>
              <p className="text-[#455A6A] text-sm max-w-sm mx-auto leading-relaxed">
                Once you accept a milestone and initiate PayPal Sandbox payment authorization, your
                transactions will appear here.
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <Link
                  to="/client/dashboard"
                  className="px-5 py-2.5 rounded-lg bg-[#003C5F] text-[#FDFBF7] text-sm font-semibold hover:bg-[#002B45] transition-colors"
                >
                  View Active Projects
                </Link>
              </div>

              {/* Sandbox context even in empty state */}
              <div className="mt-6 pt-6 border-t border-[#003C5F]/10 text-[13px] text-[#455A6A]">
                <span className="font-semibold text-[#874E0E]">Reminder:</span> PayPal Sandbox is a
                test environment. All payment flows here are simulated and no real funds are
                transferred.
              </div>
            </div>
          ) : (
            <div className="bg-paper border border-[#003C5F]/15 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" aria-label="Payment transactions">
                  <thead>
                    <tr className="border-b border-[#003C5F]/10 bg-[#F4EFE6]/50">
                      <th scope="col" className="text-left px-5 py-3.5 text-[13px] font-semibold text-deepBlue whitespace-nowrap">
                        Date
                      </th>
                      <th scope="col" className="text-left px-4 py-3.5 text-[13px] font-semibold text-deepBlue">
                        Project
                      </th>
                      <th scope="col" className="text-left px-4 py-3.5 text-[13px] font-semibold text-deepBlue">
                        Milestone
                      </th>
                      <th scope="col" className="text-right px-4 py-3.5 text-[13px] font-semibold text-deepBlue">
                        Amount (USD)
                      </th>
                      <th scope="col" className="text-left px-4 py-3.5 text-[13px] font-semibold text-deepBlue whitespace-nowrap">
                        Sandbox Ref.
                      </th>
                      <th scope="col" className="text-left px-4 py-3.5 text-[13px] font-semibold text-deepBlue">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientPayments.map((tx, idx) => {
                      const statusCfg = STATUS_CONFIG[tx.status];
                      return (
                        <tr
                          key={tx.id}
                          className={`border-b border-[#003C5F]/8 hover:bg-[#003C5F]/3 transition-colors ${
                            idx % 2 === 1 ? 'bg-[#FDFBF7]' : 'bg-white/60'
                          }`}
                        >
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className="text-[13px] text-[#455A6A]">{tx.date}</span>
                          </td>
                          <td className="px-4 py-4">
                            <Link
                              to={`/client/projects/${tx.projectId}`}
                              className="font-semibold text-deepBlue hover:underline underline-offset-2 text-sm"
                            >
                              {tx.projectTitle}
                            </Link>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-[#003C5F]/10 text-deepBlue flex items-center justify-center text-xs font-bold flex-shrink-0">
                                {tx.milestoneNumber}
                              </span>
                              <span className="text-[#1E293B] text-[13px]">
                                {tx.milestoneTitle}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <span className="font-display text-base text-deepBlue font-semibold">
                              ${tx.amount.toLocaleString()}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <code className="text-[13px] font-mono text-[#455A6A] bg-[#003C5F]/5 px-2 py-0.5 rounded">
                              {tx.sandboxReference}
                            </code>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`inline-flex px-2.5 py-0.5 rounded text-[13px] font-semibold border ${statusCfg.className}`}
                              >
                                {statusCfg.label}
                              </span>
                              {tx.status === 'pending_approval' && (
                                <Link
                                  to={`/client/projects/${tx.projectId}`}
                                  className="text-xs font-semibold text-[#003C5F] hover:underline underline-offset-2 whitespace-nowrap"
                                >
                                  Pay via PayPal &rarr;
                                </Link>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-[#003C5F]/15 bg-[#F4EFE6]/30">
                      <td colSpan={3} className="px-5 py-4 text-[13px] font-semibold text-deepBlue">
                        Total settled (Sandbox)
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="font-display text-xl text-deepBlue font-semibold">
                          ${totalPaidSandbox.toLocaleString()}
                        </span>
                      </td>
                      <td colSpan={2} className="px-4 py-4">
                        <span className="text-[13px] text-[#874E0E] font-medium">
                          PayPal Sandbox, not real money
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
