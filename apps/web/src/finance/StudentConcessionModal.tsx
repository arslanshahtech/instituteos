import { useState } from 'react';
import { Button } from '../components/ui/Button.js';
import { LoadingState } from '../components/ui/States.js';
import {
  useStudentConcessions,
  useSaveFeeConcession,
  useDeleteFeeConcession,
} from './finance-queries.js';
import type { ConcessionType, DiscountType } from './finance-api.js';

interface StudentConcessionModalProps {
  organizationId: string;
  studentId: string;
  studentName?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function StudentConcessionModal({
  organizationId,
  studentId,
  studentName,
  isOpen,
  onClose,
}: StudentConcessionModalProps) {
  const [concessionType, setConcessionType] = useState<ConcessionType>('sibling');
  const [discountType, setDiscountType] = useState<DiscountType>('percentage');
  const [discountValue, setDiscountValue] = useState<string>('20');
  const [reason, setReason] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: concessionsData, isLoading, isError } = useStudentConcessions(
    organizationId,
    studentId,
    undefined,
    isOpen,
  );

  const saveMutation = useSaveFeeConcession(organizationId);
  const deleteMutation = useDeleteFeeConcession(organizationId);

  if (!isOpen) return null;

  const handleAddConcession = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const val = parseFloat(discountValue);
    if (isNaN(val) || val <= 0) {
      setErrorMessage('Enter a valid discount value greater than 0.');
      return;
    }

    if (discountType === 'percentage' && val > 100) {
      setErrorMessage('Percentage discount cannot exceed 100%.');
      return;
    }

    try {
      await saveMutation.mutateAsync({
        data: {
          studentId,
          concessionType,
          discountType,
          discountValue: val,
          reason: reason.trim() || undefined,
          isActive: true,
        },
      });
      setReason('');
      setDiscountValue(discountType === 'percentage' ? '20' : '500');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to save fee concession.';
      setErrorMessage(msg);
    }
  };

  const handleDelete = async (concessionId: string) => {
    if (!window.confirm('Are you sure you want to remove this fee concession?')) return;
    try {
      await deleteMutation.mutateAsync(concessionId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to delete concession.';
      setErrorMessage(msg);
    }
  };

  const concessions = concessionsData?.items ?? [];

  return (
    <div className="finance-ledger-backdrop" role="dialog" aria-modal="true">
      <div className="finance-concession-window">
        {/* Header */}
        <header className="finance-ledger-head">
          <div className="finance-ledger-title">
            <h2>Fee Concessions · {studentName || 'Student'}</h2>
            <p>Assign scholarships, sibling discounts, and fee waivers</p>
          </div>
          <button
            type="button"
            className="finance-close-btn"
            onClick={onClose}
            title="Close"
          >
            ✕
          </button>
        </header>

        {/* Modal Body */}
        <div className="finance-concession-body">
          {errorMessage && (
            <div className="finance-form-error" role="alert">
              {errorMessage}
            </div>
          )}

          {/* Add Concession Form */}
          <form className="finance-concession-form-card" onSubmit={handleAddConcession}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
              + Add New Concession / Discount
            </h3>

            <div className="finance-concession-grid">
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                  Concession Type
                </label>
                <select
                  className="finance-select"
                  value={concessionType}
                  onChange={(e) => setConcessionType(e.target.value as ConcessionType)}
                >
                  <option value="sibling">Sibling Discount</option>
                  <option value="staff_child">Staff Child Waiver</option>
                  <option value="scholarship">Merit Scholarship</option>
                  <option value="need_based">Need-Based Financial Aid</option>
                  <option value="special">Special Concession</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                  Discount Mode
                </label>
                <select
                  className="finance-select"
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as DiscountType)}
                >
                  <option value="percentage">Percentage Off (%)</option>
                  <option value="fixed">Fixed Amount (Rs.)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                  {discountType === 'percentage' ? 'Percentage (%)' : 'Amount (Rs.)'}
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  max={discountType === 'percentage' ? '100' : undefined}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={discountType === 'percentage' ? 'e.g. 25' : 'e.g. 1500'}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box' }}
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                Reason / Note (Optional)
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Sibling studying in Class 4-B"
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : 'Assign Concession'}
              </Button>
            </div>
          </form>

          {/* Active Concessions Container */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <h3 style={{ margin: '0.25rem 0', fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
              Active Concessions on Student Profile
            </h3>

            {isLoading ? (
              <LoadingState message="Loading concessions..." />
            ) : isError ? (
              <div className="finance-form-error">Could not load concessions.</div>
            ) : concessions.length === 0 ? (
              <div style={{ background: '#ffffff', padding: '1.75rem', textAlign: 'center', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.85rem' }}>
                No active concessions or discounts assigned to this student.
              </div>
            ) : (
              <>
                {/* Desktop View: Table */}
                <div className="finance-concession-desktop-view">
                  <table className="finance-ledger-full-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Benefit</th>
                        <th>Reason / Note</th>
                        <th style={{ textAlign: 'center', width: '90px' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {concessions.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <span className="finance-badge" style={{ background: '#fef3c7', color: '#92400e' }}>
                              {item.concessionType.replace('_', ' ').toUpperCase()}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700, color: '#16a34a' }}>
                            {item.discountType === 'percentage'
                              ? `${item.discountValue}% OFF`
                              : `Rs. ${item.discountValue.toLocaleString('en-PK', { minimumFractionDigits: 2 })} OFF`}
                          </td>
                          <td style={{ color: '#475569' }}>
                            {item.reason || '—'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleDelete(item.id)}
                              disabled={deleteMutation.isPending}
                              className="finance-concession-remove-btn"
                              title="Delete concession"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View: Vertical Cards (No Truncation) */}
                <div className="finance-concession-mobile-view">
                  {concessions.map((item) => (
                    <article className="finance-concession-card-item" key={`mob-${item.id}`}>
                      <div className="finance-concession-card-top">
                        <span className="finance-badge" style={{ background: '#fef3c7', color: '#92400e' }}>
                          {item.concessionType.replace('_', ' ').toUpperCase()}
                        </span>
                        <strong style={{ color: '#16a34a', fontSize: '0.9rem' }}>
                          {item.discountType === 'percentage'
                            ? `${item.discountValue}% OFF`
                            : `Rs. ${item.discountValue.toLocaleString('en-PK', { minimumFractionDigits: 2 })} OFF`}
                        </strong>
                      </div>

                      {item.reason && (
                        <div className="finance-concession-card-reason">
                          <strong>Note: </strong> {item.reason}
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.2rem' }}>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          disabled={deleteMutation.isPending}
                          className="finance-concession-remove-btn"
                        >
                          Remove Concession
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="finance-ledger-footer">
          <Button onClick={onClose} type="button">
            Done
          </Button>
        </footer>
      </div>
    </div>
  );
}