import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/Button.js';
import {
  ErrorState,
  LoadingState,
  PermissionDeniedState,
} from '../components/ui/States.js';
import { useOrganizationAccess, apiMessage } from '../staff/StaffPageShared.js';
import { useStaffList } from '../staff/staff-queries.js';
import { useToast } from '../components/ui/ToastProvider.js';
import {
  useCreatePayrollAdvance,
  useGeneratePayroll,
  usePayrollWorkspace,
  useRecordPayrollPayment,
  useSavePayrollSalary,
} from './payroll-queries.js';
import type { PayrollRecord, PayrollSalaryProfile } from './payroll-api.js';

type Section = 'payroll' | 'salaries' | 'advances';
const today = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const currentMonth = () => today().slice(0, 7);
const currency = (value: number) =>
  `Rs ${value.toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;

export function PayrollDashboard() {
  const { organizationId = '' } = useParams();
  const access = useOrganizationAccess(organizationId);
  const canRead = access.data?.permissions.includes('finance.read') ?? false;
  const canWrite = access.data?.permissions.includes('finance.write') ?? false;
  const [month, setMonth] = useState(currentMonth());
  const [section, setSection] = useState<Section>('payroll');
  const [selectedStaff, setSelectedStaff] = useState('');
  const [salaryAmount, setSalaryAmount] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(today());
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceDate, setAdvanceDate] = useState(today());
  const [paymentTarget, setPaymentTarget] = useState<PayrollRecord | null>(
    null,
  );
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<
    'cash' | 'bank_transfer' | 'card' | 'online'
  >('cash');
  const [paymentDate, setPaymentDate] = useState(today());
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const workspace = usePayrollWorkspace(
    organizationId,
    month,
    Boolean(access.data && canRead),
  );
  const staff = useStaffList(
    organizationId,
    { search: '', department: '', status: 'active', page: 1, pageSize: 100 },
    Boolean(access.data && canRead),
  );
  const saveSalary = useSavePayrollSalary(organizationId);
  const generate = useGeneratePayroll(organizationId);
  const recordPayment = useRecordPayrollPayment(organizationId);
  const createAdvance = useCreatePayrollAdvance(organizationId);
  const salaryItems = workspace.salaries.data?.items ?? [];
  const payrollItems = workspace.payroll.data?.items ?? [];
  const advanceItems = workspace.advances.data?.items ?? [];
  const activeStaff = staff.data?.items ?? [];
  const profileMap = useMemo(
    () => new Map(salaryItems.map((item) => [item.staffId, item])),
    [salaryItems],
  );
  const totalSalary = payrollItems.reduce((sum, item) => sum + item.payable, 0);
  const totalPaid = payrollItems.reduce(
    (sum, item) => sum + item.paidAmount,
    0,
  );
  const totalPending = payrollItems.reduce(
    (sum, item) => sum + item.pendingAmount,
    0,
  );
  const outstandingAdvances = advanceItems.reduce(
    (sum, item) => sum + item.remainingAmount,
    0,
  );

  if (access.isPending)
    return <LoadingState message="Checking finance access..." />;
  if (access.isError)
    return (
      <ErrorState
        title="Payroll unavailable"
        description={apiMessage(access.error)}
        onRetry={() => void access.refetch()}
      />
    );
  if (!canRead) return <PermissionDeniedState />;

  const submitSalary = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!selectedStaff || !salaryAmount || Number(salaryAmount) <= 0) {
      setError('Select a staff member and enter a valid monthly salary.');
      return;
    }
    saveSalary.mutate(
      {
        staffId: selectedStaff,
        monthlySalary: Number(salaryAmount),
        effectiveFrom,
      },
      {
        onSuccess: async () => {
          showToast('Monthly salary setup saved.');
          setSalaryAmount('');
          await queryClient.invalidateQueries({
            queryKey: ['staff', organizationId],
          });
        },
        onError: (cause) => setError(apiMessage(cause)),
      },
    );
  };

  const submitAdvance = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!selectedStaff || !advanceAmount || Number(advanceAmount) <= 0) {
      setError('Select a staff member and enter a valid advance amount.');
      return;
    }
    createAdvance.mutate(
      {
        staffId: selectedStaff,
        amount: Number(advanceAmount),
        paymentMethod,
        advanceDate,
        reference: reference || undefined,
      },
      {
        onSuccess: () => {
          showToast('Salary advance recorded.');
          setAdvanceAmount('');
          setReference('');
        },
        onError: (cause) => setError(apiMessage(cause)),
      },
    );
  };

  const submitPayment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      !paymentTarget ||
      !paymentAmount ||
      !Number.isFinite(Number(paymentAmount)) ||
      Number(paymentAmount) <= 0 ||
      Number(paymentAmount) > paymentTarget.pendingAmount
    ) {
      setError('Enter a valid payment amount within the pending balance.');
      return;
    }
    setError('');
    recordPayment.mutate(
      {
        payrollId: paymentTarget.id,
        amount: Number(paymentAmount),
        paymentMethod,
        paymentDate,
        reference: reference || undefined,
      },
      {
        onSuccess: () => {
          showToast('Salary payment recorded.');
          setPaymentTarget(null);
          setPaymentAmount('');
          setReference('');
        },
        onError: (cause) => setError(apiMessage(cause)),
      },
    );
  };

  return (
    <main className="page-stack finance-page payroll-page">
      <header className="finance-page-heading">
        <div>
          <span className="finance-eyebrow">FINANCE / STAFF PAYROLL</span>
          <h1>Payroll &amp; Salaries</h1>
          <p>
            Set monthly salaries, generate payroll, record payments and track
            advances.
          </p>
        </div>
        <div className="payroll-month-control">
          <label htmlFor="payroll-month">Payroll month</label>
          <input
            id="payroll-month"
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
        </div>
      </header>

      <nav className="payroll-section-tabs" aria-label="Payroll sections">
        <button
          className={section === 'payroll' ? 'is-active' : ''}
          onClick={() => setSection('payroll')}
        >
          Monthly Payroll
        </button>
        <button
          className={section === 'salaries' ? 'is-active' : ''}
          onClick={() => setSection('salaries')}
        >
          Salary Setup
        </button>
        <button
          className={section === 'advances' ? 'is-active' : ''}
          onClick={() => setSection('advances')}
        >
          Salary Advances
        </button>
      </nav>

      {error && (
        <p className="finance-form-error" role="alert">
          {error}
        </p>
      )}
      {section === 'payroll' && (
        <>
          <section
            className="payroll-summary-grid"
            aria-label="Monthly payroll summary"
          >
            <article className="payroll-summary-card is-payable">
              <span>Monthly payable</span>
              <strong>{currency(totalSalary)}</strong>
              <small>{payrollItems.length} staff records</small>
            </article>
            <article className="payroll-summary-card is-paid">
              <span>Paid</span>
              <strong>{currency(totalPaid)}</strong>
              <small>Actual salary payments</small>
            </article>
            <article className="payroll-summary-card is-pending">
              <span>Pending</span>
              <strong>{currency(totalPending)}</strong>
              <small>Remaining salary balance</small>
            </article>
            <article className="payroll-summary-card is-advance">
              <span>Advance balance</span>
              <strong>{currency(outstandingAdvances)}</strong>
              <small>Not yet adjusted</small>
            </article>
          </section>
          <section
            className="payroll-quick-links"
            aria-label="Payroll management shortcuts"
          >
            <button
              type="button"
              className="payroll-quick-link"
              onClick={() => setSection('salaries')}
            >
              <span>Salary setup</span>
              <strong>{salaryItems.length} staff profiles configured</strong>
              <small>
                {activeStaff.length} active staff in directory · Manage monthly
                salaries
              </small>
            </button>
            <button
              type="button"
              className="payroll-quick-link"
              onClick={() => setSection('advances')}
            >
              <span>Salary advances</span>
              <strong>{currency(outstandingAdvances)} remaining</strong>
              <small>
                {advanceItems.length} advance records · Review and record
                advances
              </small>
            </button>
          </section>
          <section className="panel payroll-content-panel">
            <div className="finance-section-heading">
              <div>
                <h2>Monthly salary register</h2>
                <p>
                  Generate fixed monthly salaries for active staff with a saved
                  salary setup.
                </p>
              </div>
              {canWrite && (
                <Button
                  variant="primary"
                  onClick={() =>
                    generate.mutate(month, {
                      onSuccess: (result) =>
                        showToast(
                          `Payroll generated: ${result.created} new, ${result.skipped} already existed.`,
                        ),
                      onError: (cause) => setError(apiMessage(cause)),
                    })
                  }
                  disabled={generate.isPending}
                >
                  {generate.isPending ? 'Generating...' : 'Generate payroll'}
                </Button>
              )}
            </div>
            {workspace.payroll.isPending ? (
              <LoadingState message="Loading monthly payroll..." />
            ) : workspace.payroll.isError ? (
              <ErrorState
                title="Payroll could not load"
                description={apiMessage(workspace.payroll.error)}
                onRetry={() => void workspace.payroll.refetch()}
              />
            ) : payrollItems.length === 0 ? (
              <div className="payroll-empty">
                <strong>No payroll generated for {month}</strong>
                <p>
                  First save monthly salaries in Salary Setup, then generate
                  this month’s payroll.
                </p>
              </div>
            ) : (
              <div className="table-scroll payroll-table-scroll">
                <table className="data-table payroll-table">
                  <thead>
                    <tr>
                      <th>Staff member</th>
                      <th>Monthly salary</th>
                      <th>Advance adjusted</th>
                      <th>Payable</th>
                      <th>Paid</th>
                      <th>Pending</th>
                      <th>Status</th>
                      <th>Payment history</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payrollItems.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.staffName}</strong>
                          <small>{item.employeeCode || 'Staff'}</small>
                        </td>
                        <td>{currency(item.grossSalary)}</td>
                        <td>{currency(item.advanceAdjusted)}</td>
                        <td>{currency(item.payable)}</td>
                        <td>{currency(item.paidAmount)}</td>
                        <td>{currency(item.pendingAmount)}</td>
                        <td>
                          <span className={`payroll-status is-${item.status}`}>
                            {item.status === 'partial'
                              ? 'Partially paid'
                              : item.status === 'paid'
                                ? 'Paid'
                                : 'Pending'}
                          </span>
                        </td>
                        <td>
                          {item.payments.length ? (
                            <details className="payroll-payment-history">
                              <summary>
                                {item.payments.length} payment(s)
                              </summary>
                              <ul>
                                {item.payments.map((payment, index) => (
                                  <li key={index}>
                                    <strong>{currency(payment.amount)}</strong>
                                    <span>
                                      {payment.paymentDate} /{' '}
                                      {payment.paymentMethod.replace('_', ' ')}
                                    </span>
                                    {payment.reference && (
                                      <small>{payment.reference}</small>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </details>
                          ) : (
                            'No payments'
                          )}
                        </td>
                        <td>
                          {canWrite && item.pendingAmount > 0 ? (
                            <Button
                              variant="primary"
                              onClick={() => {
                                setPaymentTarget(item);
                                setPaymentAmount(String(item.pendingAmount));
                                setError('');
                              }}
                            >
                              Record payment
                            </Button>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!workspace.payroll.isPending && !workspace.payroll.isError && (
              <div
                className="payroll-mobile-cards"
                aria-label="Monthly payroll staff cards"
              >
                {payrollItems.length === 0 ? (
                  <div className="payroll-empty">
                    <strong>No payroll generated for {month}</strong>
                    <p>
                      Save staff salaries first, then generate this month’s
                      payroll.
                    </p>
                  </div>
                ) : (
                  payrollItems.map((item) => (
                    <article className="payroll-mobile-card" key={item.id}>
                      <div className="payroll-mobile-card-heading">
                        <div className="payroll-mobile-person">
                          <strong>{item.staffName}</strong>
                          <small>{item.employeeCode || 'Staff'}</small>
                        </div>
                        <span className={`payroll-status is-${item.status}`}>
                          {item.status === 'partial'
                            ? 'Partially paid'
                            : item.status === 'paid'
                              ? 'Paid'
                              : 'Pending'}
                        </span>
                      </div>
                      <div className="payroll-mobile-card-grid">
                        <div>
                          <span>Monthly salary</span>
                          <strong>{currency(item.grossSalary)}</strong>
                        </div>
                        <div>
                          <span>Advance adjusted</span>
                          <strong>{currency(item.advanceAdjusted)}</strong>
                        </div>
                        <div>
                          <span>Payable</span>
                          <strong>{currency(item.payable)}</strong>
                        </div>
                        <div>
                          <span>Paid</span>
                          <strong>{currency(item.paidAmount)}</strong>
                        </div>
                        <div className="payroll-mobile-card-wide">
                          <span>Pending balance</span>
                          <strong>{currency(item.pendingAmount)}</strong>
                        </div>
                      </div>
                      <details className="payroll-payment-history payroll-mobile-payment-history">
                        <summary>
                          {item.payments.length
                            ? `${item.payments.length} payment(s) recorded`
                            : 'Payment history — no payments yet'}
                        </summary>
                        {item.payments.length > 0 && (
                          <ul>
                            {item.payments.map((payment, index) => (
                              <li key={`${item.id}-payment-${index}`}>
                                <strong>{currency(payment.amount)}</strong>
                                <span>
                                  {payment.paymentDate} /{' '}
                                  {payment.paymentMethod.replace('_', ' ')}
                                </span>
                                {payment.reference && (
                                  <small>{payment.reference}</small>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </details>
                      {canWrite && item.pendingAmount > 0 && (
                        <Button
                          variant="primary"
                          onClick={() => {
                            setPaymentTarget(item);
                            setPaymentAmount(String(item.pendingAmount));
                            setError('');
                          }}
                        >
                          Record payment
                        </Button>
                      )}
                    </article>
                  ))
                )}
              </div>
            )}
          </section>
          {paymentTarget && (
            <section className="panel payroll-inline-form">
              <div className="finance-section-heading">
                <div>
                  <h2>Record salary payment</h2>
                  <p>
                    {paymentTarget.staffName} · Pending{' '}
                    {currency(paymentTarget.pendingAmount)}
                  </p>
                </div>
                <Button variant="quiet" onClick={() => setPaymentTarget(null)}>
                  Cancel
                </Button>
              </div>
              <form onSubmit={submitPayment} className="payroll-form-grid">
                <label>
                  Amount
                  <input
                    type="number"
                    min="0.01"
                    max={paymentTarget.pendingAmount}
                    step="0.01"
                    value={paymentAmount}
                    onChange={(event) => setPaymentAmount(event.target.value)}
                    required
                  />
                </label>
                <label>
                  Payment method
                  <select
                    value={paymentMethod}
                    onChange={(event) =>
                      setPaymentMethod(
                        event.target.value as typeof paymentMethod,
                      )
                    }
                  >
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank transfer</option>
                    <option value="card">Card</option>
                    <option value="online">Online</option>
                  </select>
                </label>
                <label>
                  Payment date
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(event) => setPaymentDate(event.target.value)}
                    required
                  />
                </label>
                <label>
                  Reference (optional)
                  <input
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                    maxLength={160}
                  />
                </label>
                <div>
                  <Button
                    variant="primary"
                    type="submit"
                    disabled={recordPayment.isPending}
                  >
                    {recordPayment.isPending ? 'Saving...' : 'Save payment'}
                  </Button>
                </div>
              </form>
            </section>
          )}
        </>
      )}

      {section === 'salaries' && (
        <section className="payroll-two-column">
          <div className="panel payroll-content-panel">
            <div className="finance-section-heading">
              <div>
                <h2>Staff salary setup</h2>
                <p>
                  Fixed monthly salary linked to the existing Staff Directory.
                </p>
              </div>
            </div>
            {staff.isPending || workspace.salaries.isPending ? (
              <LoadingState message="Loading staff salary setup..." />
            ) : staff.isError || workspace.salaries.isError ? (
              <ErrorState
                title="Staff salary setup unavailable"
                description={apiMessage(
                  staff.error ?? workspace.salaries.error,
                )}
                onRetry={() => {
                  void staff.refetch();
                  void workspace.salaries.refetch();
                }}
              />
            ) : (
              <div className="table-scroll payroll-table-scroll">
                <table className="data-table payroll-salary-table">
                  <thead>
                    <tr>
                      <th>Staff member</th>
                      <th>Monthly salary</th>
                      <th>Effective from</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {salaryItems.map((item: PayrollSalaryProfile) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.staffName}</strong>
                          <small>{item.employeeCode || item.staffType}</small>
                        </td>
                        <td>{currency(item.monthlySalary)}</td>
                        <td>{item.effectiveFrom}</td>
                        <td>{item.isActive ? 'Active' : 'Inactive'}</td>
                        <td>
                          {canWrite ? (
                            <Button
                              variant="secondary"
                              onClick={() => {
                                setSelectedStaff(item.staffId);
                                setSalaryAmount(String(item.monthlySalary));
                                setEffectiveFrom(item.effectiveFrom);
                              }}
                            >
                              Edit
                            </Button>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {salaryItems.length === 0 && (
                  <div className="payroll-empty">
                    <strong>No salary profiles yet</strong>
                    <p>Add salary details for staff using the form.</p>
                  </div>
                )}
              </div>
            )}
            {!staff.isPending &&
              !workspace.salaries.isPending &&
              !staff.isError &&
              !workspace.salaries.isError && (
                <div
                  className="payroll-mobile-cards"
                  aria-label="Staff salary cards"
                >
                  {salaryItems.length === 0 ? (
                    <div className="payroll-empty">
                      <strong>No salary profiles yet</strong>
                      <p>Add salary details for staff using the form.</p>
                    </div>
                  ) : (
                    salaryItems.map((item: PayrollSalaryProfile) => (
                      <article className="payroll-mobile-card" key={item.id}>
                        <div className="payroll-mobile-card-heading">
                          <div className="payroll-mobile-person">
                            <strong>{item.staffName}</strong>
                            <small>{item.employeeCode || item.staffType}</small>
                          </div>
                          <span
                            className={`payroll-status ${item.isActive ? 'is-paid' : ''}`}
                          >
                            {item.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="payroll-mobile-card-grid">
                          <div className="payroll-mobile-card-wide">
                            <span>Monthly salary</span>
                            <strong>{currency(item.monthlySalary)}</strong>
                          </div>
                          <div>
                            <span>Effective from</span>
                            <strong>{item.effectiveFrom}</strong>
                          </div>
                        </div>
                        {canWrite && (
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setSelectedStaff(item.staffId);
                              setSalaryAmount(String(item.monthlySalary));
                              setEffectiveFrom(item.effectiveFrom);
                            }}
                          >
                            Edit salary
                          </Button>
                        )}
                      </article>
                    ))
                  )}
                </div>
              )}
          </div>
          {canWrite && (
            <div className="panel payroll-content-panel payroll-form-card">
              <div className="payroll-form-card-heading">
                <span className="payroll-form-kicker">SALARY DETAILS</span>
                <h2>Set monthly salary</h2>
                <p>
                  Choose a staff member and enter their fixed monthly salary.
                </p>
              </div>
              <form className="payroll-form-stack" onSubmit={submitSalary}>
                <label>
                  Staff member
                  <select
                    value={selectedStaff}
                    onChange={(event) => {
                      const id = event.target.value;
                      setSelectedStaff(id);
                      const existing = profileMap.get(id);
                      setSalaryAmount(
                        existing ? String(existing.monthlySalary) : '',
                      );
                      setEffectiveFrom(existing?.effectiveFrom ?? today());
                    }}
                    required
                  >
                    <option value="">Select active staff</option>
                    {activeStaff.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.firstName} {person.lastName}{' '}
                        {person.employeeCode ? `· ${person.employeeCode}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Monthly salary (Rs)
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={salaryAmount}
                    onChange={(event) => setSalaryAmount(event.target.value)}
                    required
                  />
                </label>
                <label>
                  Effective from
                  <input
                    type="date"
                    value={effectiveFrom}
                    onChange={(event) => setEffectiveFrom(event.target.value)}
                    required
                  />
                </label>
                <Button
                  variant="primary"
                  type="submit"
                  disabled={saveSalary.isPending}
                >
                  {saveSalary.isPending ? 'Saving...' : 'Save salary setup'}
                </Button>
              </form>
            </div>
          )}
        </section>
      )}

      {section === 'advances' && (
        <section className="payroll-two-column">
          <div className="panel payroll-content-panel">
            <div className="finance-section-heading">
              <div>
                <h2>Salary advance history</h2>
                <p>
                  Track advances already paid and the amount remaining to
                  adjust.
                </p>
              </div>
            </div>
            {workspace.advances.isPending ? (
              <LoadingState message="Loading advances..." />
            ) : workspace.advances.isError ? (
              <ErrorState
                title="Advance history unavailable"
                description={apiMessage(workspace.advances.error)}
                onRetry={() => void workspace.advances.refetch()}
              />
            ) : (
              <div className="table-scroll payroll-table-scroll">
                <table className="data-table payroll-advance-table">
                  <thead>
                    <tr>
                      <th>Staff member</th>
                      <th>Date</th>
                      <th>Advance</th>
                      <th>Adjusted</th>
                      <th>Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {advanceItems.map((item) => (
                      <tr key={item.id}>
                        <td>{item.staffName}</td>
                        <td>{item.advanceDate}</td>
                        <td>{currency(item.amount)}</td>
                        <td>{currency(item.adjustedAmount)}</td>
                        <td>{currency(item.remainingAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {advanceItems.length === 0 && (
                  <div className="payroll-empty">
                    <strong>No salary advances recorded</strong>
                  </div>
                )}
              </div>
            )}
            {!workspace.advances.isPending && !workspace.advances.isError && (
              <div
                className="payroll-mobile-cards"
                aria-label="Salary advance history cards"
              >
                {advanceItems.length === 0 ? (
                  <div className="payroll-empty">
                    <strong>No salary advances recorded</strong>
                  </div>
                ) : (
                  advanceItems.map((item) => (
                    <article className="payroll-mobile-card" key={item.id}>
                      <div className="payroll-mobile-card-heading">
                        <div className="payroll-mobile-person">
                          <strong>{item.staffName}</strong>
                          <small>{item.advanceDate}</small>
                        </div>
                        <span className="payroll-status">
                          {item.remainingAmount > 0
                            ? 'Adjustment pending'
                            : 'Adjusted'}
                        </span>
                      </div>
                      <div className="payroll-mobile-card-grid">
                        <div>
                          <span>Advance</span>
                          <strong>{currency(item.amount)}</strong>
                        </div>
                        <div>
                          <span>Adjusted</span>
                          <strong>{currency(item.adjustedAmount)}</strong>
                        </div>
                        <div className="payroll-mobile-card-wide">
                          <span>Remaining</span>
                          <strong>{currency(item.remainingAmount)}</strong>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            )}
          </div>
          {canWrite && (
            <div className="panel payroll-content-panel payroll-form-card">
              <div className="payroll-form-card-heading">
                <span className="payroll-form-kicker">ADVANCE DETAILS</span>
                <h2>Record salary advance</h2>
              </div>
              <p className="payroll-helper-text">
                An advance is recorded as an actual cash outflow now, then
                adjusted against future generated salary.
              </p>
              <form className="payroll-form-stack" onSubmit={submitAdvance}>
                <label>
                  Staff member
                  <select
                    value={selectedStaff}
                    onChange={(event) => setSelectedStaff(event.target.value)}
                    required
                  >
                    <option value="">Select active staff</option>
                    {activeStaff.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.firstName} {person.lastName}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Advance amount (Rs)
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={advanceAmount}
                    onChange={(event) => setAdvanceAmount(event.target.value)}
                    required
                  />
                </label>
                <label>
                  Payment date
                  <input
                    type="date"
                    value={advanceDate}
                    onChange={(event) => setAdvanceDate(event.target.value)}
                    required
                  />
                </label>
                <label>
                  Payment method
                  <select
                    value={paymentMethod}
                    onChange={(event) =>
                      setPaymentMethod(
                        event.target.value as typeof paymentMethod,
                      )
                    }
                  >
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank transfer</option>
                    <option value="card">Card</option>
                    <option value="online">Online</option>
                  </select>
                </label>
                <label>
                  Reference (optional)
                  <input
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                    maxLength={160}
                  />
                </label>
                <Button
                  variant="primary"
                  type="submit"
                  disabled={createAdvance.isPending}
                >
                  {createAdvance.isPending ? 'Saving...' : 'Record advance'}
                </Button>
              </form>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
