import { useState } from 'react';
import { Button } from '../components/ui/Button.js';
import { LoadingState } from '../components/ui/States.js';
import { useStudentFeeLedger } from './finance-queries.js';
import type { StudentLedgerEntry } from './finance-api.js';

interface StudentFeeLedgerModalProps {
  organizationId: string;
  studentId: string;
  studentName?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function StudentFeeLedgerModal({
  organizationId,
  studentId,
  studentName,
  isOpen,
  onClose,
}: StudentFeeLedgerModalProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [copiedRef, setCopiedRef] = useState<string | null>(null);

  const {
    data: ledger,
    isLoading,
    isError,
  } = useStudentFeeLedger(organizationId, studentId, isOpen);

  if (!isOpen) return null;

  const formatMoney = (val: number) =>
    `Rs. ${Number(val || 0).toLocaleString('en-PK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const formatReference = (ref: string) => {
    if (!ref) return '—';
    if (ref.length <= 15) return ref;
    const parts = ref.split('-');
    if (parts.length >= 2) {
      return `${parts[0]}-${parts[1].slice(0, 8)}…`;
    }
    return `${ref.slice(0, 12)}…`;
  };

  const cleanDescription = (desc: string) => {
    if (!desc) return '—';
    if (desc.toLowerCase().startsWith('invoice generated')) {
      const match = desc.match(/\((.*?)\)/);
      return match ? `Invoice · Cycle ${match[1]}` : 'Fee Invoice';
    }
    if (desc.toLowerCase().startsWith('payment received')) {
      const match = desc.match(/\((.*?)\)/);
      return match ? `Payment · ${match[1].toUpperCase()}` : 'Payment Received';
    }
    return desc;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedRef(text);
    setTimeout(() => setCopiedRef(null), 1500);
  };

  const handleShareWhatsApp = (entry?: StudentLedgerEntry) => {
    if (!ledger) return;

    let text = `*Student Fee Statement - ${ledger.studentName}*\n`;
    text += `Total Billed: ${formatMoney(ledger.totalBilled)}\n`;
    text += `Total Paid: ${formatMoney(ledger.totalPaid)}\n`;
    text += `*Baqaya (Balance): ${formatMoney(ledger.outstandingBalance)}*\n`;

    if (entry) {
      text += `\n*Transaction Detail:*\n`;
      text += `Date: ${entry.date || 'N/A'}\nRef: ${entry.referenceNumber}\n`;
      text +=
        entry.type === 'payment'
          ? `Amount Paid: ${formatMoney(entry.credit)}\n`
          : `Invoice Billed: ${formatMoney(entry.debit)}\n`;
      text += `Running Balance: ${formatMoney(entry.balance)}\n`;
    }

    text += `\nInstituteOS Fee Management`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="finance-ledger-backdrop" role="dialog" aria-modal="true">
      <div
        className={`finance-ledger-window ${isMaximized ? 'is-maximized' : ''}`}
      >
        {/* Header */}
        <header className="finance-ledger-head">
          <div className="finance-ledger-title">
            <h2>
              Fee Ledger · {ledger?.studentName ?? studentName ?? 'Student'}
            </h2>
            <p>Complete debit, credit & balance statement</p>
          </div>

          <div className="finance-ledger-head-actions">
            {ledger && (
              <>
                <button
                  type="button"
                  onClick={() => handleShareWhatsApp()}
                  className="finance-icon-btn whatsapp-action"
                  title="Share summary on WhatsApp"
                >
                  WhatsApp Summary
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="finance-icon-btn"
                  title="Print Ledger Statement"
                >
                  Print
                </button>
              </>
            )}

            <button
              type="button"
              className="finance-icon-btn finance-desktop-only-btn"
              onClick={() => setIsMaximized((prev) => !prev)}
              title={isMaximized ? 'Restore down' : 'Maximize window'}
            >
              {isMaximized ? '❐ Restore' : '⛶ Maximize'}
            </button>

            <button
              type="button"
              className="finance-close-btn"
              onClick={onClose}
              title="Close window"
            >
              ✕
            </button>
          </div>
        </header>

        {/* Scrollable Body */}
        <div className="finance-ledger-body">
          {isLoading ? (
            <LoadingState message="Loading student ledger records..." />
          ) : isError || !ledger ? (
            <div className="finance-form-error" role="alert">
              Unable to load fee ledger records for this student.
            </div>
          ) : (
            <>
              {/* Summary Metrics */}
              <div className="finance-ledger-metrics">
                <div className="finance-metric-card billed">
                  <div className="finance-metric-card-lbl">Total Billed</div>
                  <div className="finance-metric-card-val">
                    {formatMoney(ledger.totalBilled)}
                  </div>
                </div>
                <div className="finance-metric-card paid">
                  <div className="finance-metric-card-lbl">Total Collected</div>
                  <div className="finance-metric-card-val">
                    {formatMoney(ledger.totalPaid)}
                  </div>
                </div>
                <div className="finance-metric-card balance">
                  <div className="finance-metric-card-lbl">
                    Outstanding Baqaya
                  </div>
                  <div className="finance-metric-card-val">
                    {formatMoney(ledger.outstandingBalance)}
                  </div>
                </div>
              </div>

              {/* Desktop Balanced Table View */}
              <div className="finance-desktop-ledger-view">
                <table className="finance-ledger-full-table">
                  <colgroup>
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '17%' }} />
                    <col style={{ width: '22%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '13%' }} />
                    <col style={{ width: '14%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Reference</th>
                      <th>Description</th>
                      <th style={{ textAlign: 'right' }}>Debit</th>
                      <th style={{ textAlign: 'right' }}>Credit</th>
                      <th style={{ textAlign: 'right' }}>Balance</th>
                      <th style={{ textAlign: 'center' }}>Slip</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.entries.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          style={{
                            textAlign: 'center',
                            padding: '3.5rem',
                            color: '#94a3b8',
                          }}
                        >
                          No fee transactions recorded for this student yet.
                        </td>
                      </tr>
                    ) : (
                      ledger.entries.map((entry, idx) => (
                        <tr key={`${entry.referenceNumber}-${idx}`}>
                          <td
                            style={{ color: '#64748b', whiteSpace: 'nowrap' }}
                          >
                            {entry.date || '—'}
                          </td>
                          <td>
                            <span className={`finance-badge ${entry.type}`}>
                              {entry.type === 'invoice' ? 'Invoice' : 'Paid'}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() =>
                                copyToClipboard(entry.referenceNumber)
                              }
                              className="finance-ref-tag"
                              title={`Full: ${entry.referenceNumber} (Click to copy)`}
                            >
                              <span>
                                {formatReference(entry.referenceNumber)}
                              </span>
                              <span
                                style={{ fontSize: '0.7rem', opacity: 0.6 }}
                              >
                                {copiedRef === entry.referenceNumber
                                  ? '✓'
                                  : '⧉'}
                              </span>
                            </button>
                          </td>
                          <td style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>
                            {cleanDescription(entry.description)}
                          </td>
                          <td
                            style={{
                              textAlign: 'right',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {entry.debit > 0 ? formatMoney(entry.debit) : '—'}
                          </td>
                          <td
                            style={{
                              textAlign: 'right',
                              fontWeight: 600,
                              color: '#16a34a',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {entry.credit > 0 ? formatMoney(entry.credit) : '—'}
                          </td>
                          <td
                            style={{
                              textAlign: 'right',
                              fontWeight: 700,
                              color: '#0f172a',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {formatMoney(entry.balance)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="finance-whatsapp-full-btn"
                              onClick={() => handleShareWhatsApp(entry)}
                              title="Share slip on WhatsApp"
                            >
                              WhatsApp Slip
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile View: Vertical Cards */}
              <div className="finance-mobile-ledger-view">
                {ledger.entries.length === 0 ? (
                  <p
                    style={{
                      textAlign: 'center',
                      padding: '2rem',
                      color: '#94a3b8',
                    }}
                  >
                    No fee transactions found.
                  </p>
                ) : (
                  ledger.entries.map((entry, idx) => (
                    <article
                      className="finance-tx-card"
                      key={`m-${entry.referenceNumber}-${idx}`}
                    >
                      <div className="finance-tx-card-header">
                        <span className="finance-tx-card-date">
                          {entry.date || 'No Date'}
                        </span>
                        <span className={`finance-badge ${entry.type}`}>
                          {entry.type === 'invoice' ? 'Invoice' : 'Payment'}
                        </span>
                      </div>

                      <div className="finance-tx-card-body">
                        <div>
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(entry.referenceNumber)
                            }
                            className="finance-ref-tag"
                            title="Click to copy full reference"
                          >
                            <span>{entry.referenceNumber}</span>
                            <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>
                              {copiedRef === entry.referenceNumber
                                ? '✓ Copied'
                                : '⧉'}
                            </span>
                          </button>
                        </div>
                        <span>{cleanDescription(entry.description)}</span>
                      </div>

                      <div className="finance-tx-card-amounts">
                        <div>
                          <small style={{ color: '#64748b', display: 'block' }}>
                            {entry.type === 'invoice'
                              ? 'Debit (Billed)'
                              : 'Credit (Paid)'}
                          </small>
                          <strong
                            style={{
                              color:
                                entry.type === 'invoice'
                                  ? '#0f172a'
                                  : '#16a34a',
                            }}
                          >
                            {entry.type === 'invoice'
                              ? formatMoney(entry.debit)
                              : formatMoney(entry.credit)}
                          </strong>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <small style={{ color: '#64748b', display: 'block' }}>
                            Running Baqaya
                          </small>
                          <strong style={{ color: '#dc2626' }}>
                            {formatMoney(entry.balance)}
                          </strong>
                        </div>
                      </div>

                      <div className="finance-tx-card-footer">
                        <button
                          type="button"
                          className="finance-whatsapp-full-btn"
                          onClick={() => handleShareWhatsApp(entry)}
                        >
                          WhatsApp Slip
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <footer className="finance-ledger-footer">
          <Button onClick={onClose} type="button">
            Close Statement
          </Button>
        </footer>
      </div>
    </div>
  );
}
