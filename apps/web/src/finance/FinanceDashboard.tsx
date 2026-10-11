import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '../components/ui/Button.js';
import { DataTable } from '../components/ui/DataTable.js';
import { Dialog } from '../components/ui/Dialog.js';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PermissionDeniedState,
} from '../components/ui/States.js';
import { useAcademicsWorkspace } from '../academics/academics-queries.js';
import type {
  AcademicClass,
  AcademicYear,
} from '../academics/academics-api.js';
import { apiMessage, useOrganizationAccess } from '../staff/StaffPageShared.js';
import { useToast } from '../components/ui/ToastProvider.js';
import type {
  FeeHead,
  FeeStructure,
  InvoiceStatus,
  PaymentMethod,
  StudentInvoice,
} from './finance-api.js';
import {
  useDeleteFeeStructure,
  useFinanceWorkspace,
  useGenerateInvoices,
  useRecordInvoicePayment,
  useSaveFeeStructure,
} from './finance-queries.js';

const tabs = ['Invoices & billing', 'Bulk generate', 'Fee structures'] as const;
type Tab = (typeof tabs)[number];
type FeeHeadDraft = { title: string; amount: string; isOptional: boolean };

const statusLabels: Record<InvoiceStatus, string> = {
  unpaid: 'Unpaid',
  partial: 'Partial',
  paid: 'Paid',
  overdue: 'Overdue',
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function amountText(value: number) {
  return value.toFixed(2);
}

function campusName(id: string, campuses: { id: string; name: string }[]) {
  return campuses.find((campus) => campus.id === id)?.name ?? 'Campus';
}

function className(id: string, classes: AcademicClass[]) {
  return classes.find((item) => item.id === id)?.name ?? 'Class';
}

function yearName(id: string, years: AcademicYear[]) {
  return years.find((year) => year.id === id)?.name ?? 'Academic year';
}

function FinanceField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="finance-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function initialFeeHeads(): FeeHeadDraft[] {
  return [{ title: 'Tuition', amount: '', isOptional: false }];
}

export function FinanceDashboard() {
  const { organizationId = '' } = useParams();
  const access = useOrganizationAccess(organizationId);
  const canRead = access.data?.permissions.includes('finance.read') ?? false;
  const canWrite = access.data?.permissions.includes('finance.write') ?? false;
  const academics = useAcademicsWorkspace(
    organizationId,
    Boolean(access.data && canRead),
  );
  const campuses = academics.campuses.data?.campuses ?? [];
  const years = academics.years.data?.items ?? [];
  const classes = academics.classes.data?.items ?? [];
  const [tab, setTab] = useState<Tab>('Invoices & billing');
  const [campusFilter, setCampusFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const filters = useMemo(
    () => ({
      campusId: campusFilter || undefined,
      classId: classFilter || undefined,
      status: statusFilter || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [campusFilter, classFilter, statusFilter, dateFrom, dateTo],
  );
  const finance = useFinanceWorkspace(
    organizationId,
    Boolean(access.data && canRead),
    filters,
  );
  const feeStructures = finance.feeStructures.data?.items ?? [];
  const invoices = finance.invoices.data?.items ?? [];
  const saveStructure = useSaveFeeStructure(organizationId);
  const deleteStructure = useDeleteFeeStructure(organizationId);
  const generateInvoices = useGenerateInvoices(organizationId);
  const recordPayment = useRecordInvoicePayment(organizationId);
  const toast = useToast();

  const [academicYearId, setAcademicYearId] = useState('');
  const [bulkClassId, setBulkClassId] = useState('');
  const [feeStructureId, setFeeStructureId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [billingCycle, setBillingCycle] = useState('');
  const [generationSummary, setGenerationSummary] = useState('');
  const [editingFeeId, setEditingFeeId] = useState('');
  const [structureName, setStructureName] = useState('');
  const [structureYearId, setStructureYearId] = useState('');
  const [structureCampusId, setStructureCampusId] = useState('');
  const [structureClassId, setStructureClassId] = useState('');
  const [feeHeads, setFeeHeads] = useState<FeeHeadDraft[]>(initialFeeHeads);
  const [paymentInvoice, setPaymentInvoice] = useState<StudentInvoice | null>(
    null,
  );
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentDate, setPaymentDate] = useState(today());
  const [transactionReference, setTransactionReference] = useState('');
  const [formError, setFormError] = useState('');

  const filteredStructureClasses = classes.filter(
    (item) => !structureCampusId || item.campusId === structureCampusId,
  );
  const matchedStructures = feeStructures.filter(
    (item) =>
      item.classId === bulkClassId &&
      item.academicYearId === academicYearId,
  );

  function openPayment(invoice: StudentInvoice) {
    setPaymentInvoice(invoice);
    setPaymentAmount(amountText(invoice.totalAmount - invoice.paidAmount));
    setPaymentDate(today());
    setFormError('');
  }

  async function submitGeneration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    setGenerationSummary('');
    try {
      const result = await generateInvoices.mutateAsync({
        classId: bulkClassId,
        academicYearId,
        feeStructureId,
        dueDate,
        billingCycle,
      });
      if (result.createdCount > 0) {
        toast.showToast(
          `Successfully generated ${result.createdCount} invoices.`,
        );
      } else {
        const message =
          'No active enrolled students found for the selected class/year.';
        toast.showToast(message, 'info');
        setGenerationSummary(message);
        return;
      }
      setGenerationSummary(
        `${result.createdCount} invoice${result.createdCount === 1 ? '' : 's'} generated. ${result.skippedCount} already existed for this billing cycle.`,
      );
    } catch (error) {
      setFormError(apiMessage(error));
    }
  }

  function startEdit(structure: FeeStructure) {
    setEditingFeeId(structure.id);
    setStructureName(structure.name);
    setStructureYearId(structure.academicYearId);
    setStructureCampusId(structure.campusId);
    setStructureClassId(structure.classId);
    setFeeHeads(
      structure.feeHeads.map((head) => ({
        title: head.title,
        amount: amountText(head.amount),
        isOptional: head.isOptional,
      })),
    );
  }

  function resetStructureForm() {
    setEditingFeeId('');
    setStructureName('');
    setStructureYearId('');
    setStructureCampusId('');
    setStructureClassId('');
    setFeeHeads(initialFeeHeads());
  }

  async function submitStructure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    const parsedHeads: FeeHead[] = feeHeads.map((head) => ({
      title: head.title.trim(),
      amount: Number(head.amount),
      isOptional: head.isOptional,
    }));
    if (
      parsedHeads.some(
        (head) =>
          !head.title ||
          !Number.isFinite(head.amount) ||
          head.amount < 0 ||
          Number(head.amount.toFixed(2)) !== head.amount,
      )
    ) {
      setFormError('Enter a valid title and amount for each fee head.');
      return;
    }
    try {
      await saveStructure.mutateAsync({
        id: editingFeeId || undefined,
        data: {
          name: structureName.trim(),
          academicYearId: structureYearId,
          classId: structureClassId,
          campusId: structureCampusId,
          feeHeads: parsedHeads,
        },
      });
      resetStructureForm();
      toast.showToast(
        editingFeeId ? 'Fee structure updated.' : 'Fee structure created.',
      );
    } catch (error) {
      setFormError(apiMessage(error));
    }
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paymentInvoice) return;
    setFormError('');
    try {
      const result = await recordPayment.mutateAsync({
        invoiceId: paymentInvoice.id,
        data: {
          amountPaid: Number(paymentAmount),
          paymentMethod,
          paymentDate,
          ...(transactionReference.trim()
            ? { transactionReference: transactionReference.trim() }
            : {}),
        },
      });
      setPaymentInvoice(null);
      setPaymentAmount('');
      setTransactionReference('');
      toast.showToast(`Payment recorded · receipt ${result.receipt.receiptNumber}.`);
    } catch (error) {
      setFormError(apiMessage(error));
    }
  }

  if (access.isPending) return <LoadingState message="Checking finance access..." />;
  if (access.error || !access.data) {
    return (
      <ErrorState
        title="Organization unavailable"
        description={
          access.error
            ? apiMessage(access.error)
            : 'Finance access could not be verified for this organization.'
        }
        onRetry={() => void access.refetch()}
      />
    );
  }
  if (!canRead) return <PermissionDeniedState />;

  const queryError =
    finance.feeStructures.error ??
    (finance.invoices.data ? null : finance.invoices.error) ??
    academics.years.error ??
    academics.classes.error ??
    academics.campuses.error;
  if (queryError) {
    return (
      <ErrorState
        title="Finance workspace could not be loaded"
        description={apiMessage(queryError)}
        onRetry={() => {
          void finance.feeStructures.refetch();
          void finance.invoices.refetch();
          void academics.years.refetch();
          void academics.classes.refetch();
          void academics.campuses.refetch();
        }}
      />
    );
  }
  if (
    finance.feeStructures.isPending ||
    (finance.invoices.isPending && !finance.invoices.data) ||
    academics.years.isPending ||
    academics.classes.isPending ||
    academics.campuses.isPending
  ) {
    return <LoadingState message="Loading finance workspace..." />;
  }

  return (
    <main className="finance-page">
      <header className="page-heading finance-page-heading">
        <div>
          <p className="eyebrow">Organization workspace</p>
          <h1>Fee & financial management</h1>
          <p className="page-description">
            Set fee schedules, generate student invoices, and record collections.
          </p>
        </div>
      </header>

      <label className="finance-mobile-tab-switcher">
        <span className="visually-hidden">Finance view</span>
        <select
          aria-label="Finance view"
          className="finance-select"
          value={tab}
          onChange={(event) => setTab(event.currentTarget.value as Tab)}
        >
          {tabs.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <nav className="finance-tabs" aria-label="Finance sections">
        {tabs.map((item) => (
          <button
            aria-current={tab === item ? 'page' : undefined}
            className={`finance-tab${tab === item ? ' finance-tab-active' : ''}`}
            key={item}
            onClick={() => setTab(item)}
            type="button"
          >
            {item}
          </button>
        ))}
      </nav>

      {!canWrite && (
        <div className="finance-readonly-note" role="status">
          You have read-only access to finance records.
        </div>
      )}
      {formError && (
        <div className="finance-form-error" role="alert">
          {formError}
        </div>
      )}

      {tab === 'Invoices & billing' && (
        <section className="finance-section" aria-label="Invoices and billing">
          <div className="finance-section-heading">
            <div>
              <h2>Student invoices</h2>
              <p>Review balances and record payments against an invoice.</p>
            </div>
            <span className="finance-result-count">{invoices.length} invoices</span>
          </div>
          <div className="finance-filter-grid">
            <FinanceField label="Campus">
              <select
                className="finance-select"
                value={campusFilter}
                onChange={(event) => setCampusFilter(event.target.value)}
              >
                <option value="">All campuses</option>
                {campuses.map((campus) => (
                  <option key={campus.id} value={campus.id}>
                    {campus.name}
                  </option>
                ))}
              </select>
            </FinanceField>
            <FinanceField label="Class">
              <select
                className="finance-select"
                value={classFilter}
                onChange={(event) => setClassFilter(event.target.value)}
              >
                <option value="">All classes</option>
                {classes
                  .filter(
                    (item) =>
                      !campusFilter || item.campusId === campusFilter,
                  )
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </FinanceField>
            <FinanceField label="Payment status">
              <select
                className="finance-select"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as InvoiceStatus | '')
                }
              >
                <option value="">All statuses</option>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FinanceField>
            <FinanceField label="Issued from">
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </FinanceField>
            <FinanceField label="Issued to">
              <input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </FinanceField>
          </div>
          {finance.invoices.isFetching && (
            <div className="finance-refresh-indicator" role="status">
              <span className="finance-refresh-spinner" aria-hidden="true" />
              Updating invoices…
            </div>
          )}
          <div className="finance-invoices-table">
            <DataTable
              caption="Student invoices"
              rows={invoices}
              rowKey={(row) => row.id}
              emptyTitle="No invoices match these filters"
              emptyDescription="Generate a billing cycle or adjust your filters."
              columns={[
                {
                  header: 'Invoice',
                  render: (row) => (
                    <div>
                      <strong>{row.invoiceNumber}</strong>
                      <span className="finance-cell-secondary">
                        {row.studentName}
                      </span>
                    </div>
                  ),
                },
                {
                  header: 'Class / campus',
                  render: (row) => (
                    <div>
                      <span>{className(row.classId, classes)}</span>
                      <span className="finance-cell-secondary">
                        {campusName(row.campusId, campuses)}
                      </span>
                    </div>
                  ),
                },
                {
                  header: 'Due date',
                  render: (row) => new Date(row.dueDate).toLocaleDateString(),
                },
                {
                  header: 'Total / paid',
                  align: 'right',
                  render: (row) => (
                    <div>
                      <strong>{amountText(row.totalAmount)}</strong>
                      <span className="finance-cell-secondary">
                        Paid {amountText(row.paidAmount)}
                      </span>
                    </div>
                  ),
                },
                {
                  header: 'Status',
                  render: (row) => (
                    <span
                      className={`status-badge finance-status finance-status-${row.status}`}
                    >
                      {statusLabels[row.status]}
                    </span>
                  ),
                },
                {
                  header: 'Action',
                  render: (row) => (
                    <Button
                      disabled={!canWrite || row.status === 'paid'}
                      onClick={() => openPayment(row)}
                    >
                      Record payment
                    </Button>
                  ),
                },
              ]}
            />
          </div>
          <div className="finance-invoice-cards">
            {invoices.length ? (
              invoices.map((invoice) => (
                <article className="finance-invoice-card" key={invoice.id}>
                  <header className="finance-invoice-card-header">
                    <div>
                      <span className="finance-card-label">Invoice</span>
                      <h3>{invoice.invoiceNumber}</h3>
                      <p>{invoice.studentName}</p>
                    </div>
                    <span
                      className={`status-badge finance-status finance-status-${invoice.status}`}
                    >
                      {statusLabels[invoice.status]}
                    </span>
                  </header>
                  <dl className="finance-invoice-card-details">
                    <div>
                      <dt>Class / campus</dt>
                      <dd>
                        {className(invoice.classId, classes)} ·{' '}
                        {campusName(invoice.campusId, campuses)}
                      </dd>
                    </div>
                    <div>
                      <dt>Due date</dt>
                      <dd>{new Date(invoice.dueDate).toLocaleDateString()}</dd>
                    </div>
                    <div>
                      <dt>Total amount</dt>
                      <dd>{amountText(invoice.totalAmount)}</dd>
                    </div>
                    <div>
                      <dt>Paid amount</dt>
                      <dd>{amountText(invoice.paidAmount)}</dd>
                    </div>
                  </dl>
                  <Button
                    className="finance-card-payment-button"
                    disabled={!canWrite || invoice.status === 'paid'}
                    onClick={() => openPayment(invoice)}
                  >
                    Record Payment
                  </Button>
                </article>
              ))
            ) : (
              <EmptyState
                title="No invoices match these filters"
                description="Generate a billing cycle or adjust your filters."
              />
            )}
          </div>
        </section>
      )}

      {tab === 'Bulk generate' && (
        <section className="finance-section finance-form-section">
          <div className="finance-section-heading">
            <div>
              <h2>Generate class invoices</h2>
              <p>
                Create one invoice for each actively enrolled student with an
                active placement in the selected class.
              </p>
            </div>
          </div>
          {canWrite ? (
            <form
              className="finance-generation-form"
              onSubmit={submitGeneration}
            >
              <div className="finance-form-grid">
                <FinanceField label="Academic year">
                  <select
                    className="finance-select"
                    required
                    value={academicYearId}
                    onChange={(event) => {
                      setAcademicYearId(event.target.value);
                      setFeeStructureId('');
                    }}
                  >
                    <option value="">Select academic year</option>
                    {years.map((year) => (
                      <option key={year.id} value={year.id}>
                        {year.name}
                      </option>
                    ))}
                  </select>
                </FinanceField>
                <FinanceField label="Class">
                  <select
                    className="finance-select"
                    required
                    value={bulkClassId}
                    onChange={(event) => {
                      setBulkClassId(event.target.value);
                      setFeeStructureId('');
                    }}
                  >
                    <option value="">Select class</option>
                    {classes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} · {campusName(item.campusId, campuses)}
                      </option>
                    ))}
                  </select>
                </FinanceField>
                <FinanceField label="Fee structure">
                  <select
                    className="finance-select"
                    required
                    value={feeStructureId}
                    onChange={(event) => setFeeStructureId(event.target.value)}
                  >
                    <option value="">Select fee structure</option>
                    {matchedStructures.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </FinanceField>
                <FinanceField label="Billing cycle">
                  <input
                    maxLength={60}
                    placeholder="e.g. 2026-term-1"
                    required
                    value={billingCycle}
                    onChange={(event) => setBillingCycle(event.target.value)}
                  />
                </FinanceField>
                <FinanceField label="Due date">
                  <input
                    required
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                  />
                </FinanceField>
              </div>
              <div className="finance-form-actions">
                <Button
                  className="finance-generate-button"
                  disabled={
                    generateInvoices.isPending ||
                    !matchedStructures.length ||
                    !bulkClassId ||
                    !academicYearId
                  }
                  type="submit"
                  variant="primary"
                >
                  {generateInvoices.isPending
                    ? 'Generating…'
                    : 'Generate invoices'}
                </Button>
              </div>
              {generationSummary && (
                <p className="finance-success-message" role="status">
                  {generationSummary}
                </p>
              )}
              {!matchedStructures.length && (
                <p className="finance-field-hint">
                  Create a fee structure for this class and year before
                  generating invoices.
                </p>
              )}
            </form>
          ) : (
            <PermissionDeniedState
              title="Invoice generation is restricted"
              description="Your finance role can view records but cannot create billing cycles."
            />
          )}
        </section>
      )}

      {tab === 'Fee structures' && (
        <div className="finance-structure-layout">
          <section className="finance-section finance-form-section">
            <div className="finance-section-heading">
              <div>
                <h2>{editingFeeId ? 'Edit fee structure' : 'Create fee structure'}</h2>
                <p>Define required and optional fee heads for a class and year.</p>
              </div>
            </div>
            {canWrite ? (
              <form className="finance-form-grid" onSubmit={submitStructure}>
                <FinanceField label="Structure name">
                  <input
                    maxLength={120}
                    required
                    value={structureName}
                    onChange={(event) => setStructureName(event.target.value)}
                  />
                </FinanceField>
                <FinanceField label="Academic year">
                  <select
                    className="finance-select"
                    required
                    value={structureYearId}
                    onChange={(event) => setStructureYearId(event.target.value)}
                  >
                    <option value="">Select academic year</option>
                    {years.map((year) => (
                      <option key={year.id} value={year.id}>
                        {year.name}
                      </option>
                    ))}
                  </select>
                </FinanceField>
                <FinanceField label="Campus">
                  <select
                    className="finance-select"
                    required
                    value={structureCampusId}
                    onChange={(event) => {
                      setStructureCampusId(event.target.value);
                      setStructureClassId('');
                    }}
                  >
                    <option value="">Select campus</option>
                    {campuses.map((campus) => (
                      <option key={campus.id} value={campus.id}>
                        {campus.name}
                      </option>
                    ))}
                  </select>
                </FinanceField>
                <FinanceField label="Class">
                  <select
                    className="finance-select"
                    required
                    value={structureClassId}
                    onChange={(event) => setStructureClassId(event.target.value)}
                  >
                    <option value="">Select class</option>
                    {filteredStructureClasses.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </FinanceField>
                <div className="finance-fee-heads">
                  <div className="finance-fee-heads-heading">
                    <h3>Fee heads</h3>
                    <Button
                      className="finance-add-head-button"
                      disabled={feeHeads.length >= 40}
                      onClick={() =>
                        setFeeHeads((current) => [
                          ...current,
                          { title: '', amount: '', isOptional: false },
                        ])
                      }
                      type="button"
                    >
                      Add fee head
                    </Button>
                  </div>
                  {feeHeads.map((head, index) => (
                    <div className="finance-fee-head-row" key={index}>
                      <FinanceField label="Fee head">
                        <input
                          maxLength={100}
                          placeholder="e.g. Tuition"
                          required
                          value={head.title}
                          onChange={(event) =>
                            setFeeHeads((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, title: event.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      </FinanceField>
                      <FinanceField label="Amount">
                        <input
                          min="0"
                          placeholder="0.00"
                          required
                          step="0.01"
                          type="number"
                          value={head.amount}
                          onChange={(event) =>
                            setFeeHeads((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, amount: event.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      </FinanceField>
                      <FinanceField label="Fee type">
                        <select
                          className="finance-select"
                          value={head.isOptional ? 'optional' : 'required'}
                          onChange={(event) =>
                            setFeeHeads((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? {
                                      ...item,
                                      isOptional: event.target.value === 'optional',
                                    }
                                  : item,
                              ),
                            )
                          }
                        >
                          <option value="required">Required</option>
                          <option value="optional">Optional</option>
                        </select>
                      </FinanceField>
                      <Button
                        aria-label={`Remove ${head.title || `fee head ${index + 1}`}`}
                        className="finance-remove-head"
                        disabled={feeHeads.length <= 1}
                        onClick={() =>
                          setFeeHeads((current) =>
                            current.filter((_, itemIndex) => itemIndex !== index),
                          )
                        }
                        type="button"
                        variant="quiet"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="finance-form-actions">
                  <Button
                    disabled={saveStructure.isPending}
                    type="submit"
                    variant="primary"
                  >
                    {editingFeeId ? 'Save changes' : 'Create fee structure'}
                  </Button>
                  {editingFeeId && (
                    <Button onClick={resetStructureForm} type="button">
                      Cancel edit
                    </Button>
                  )}
                </div>
              </form>
            ) : (
              <PermissionDeniedState
                title="Fee structure changes are restricted"
                description="Your finance role can view fee structures but cannot manage them."
              />
            )}
          </section>

          <section className="finance-section">
            <div className="finance-section-heading">
              <div>
                <h2>Fee structures</h2>
                <p>{feeStructures.length} configured</p>
              </div>
            </div>
            {feeStructures.length ? (
              <div className="finance-structure-list">
                {feeStructures.map((structure) => (
                  <article className="finance-structure-item" key={structure.id}>
                    <div className="finance-structure-item-heading">
                      <div>
                        <h3>{structure.name}</h3>
                        <p>
                          {className(structure.classId, classes)} ·{' '}
                          {campusName(structure.campusId, campuses)} ·{' '}
                          {yearName(structure.academicYearId, years)}
                        </p>
                      </div>
                      {canWrite && (
                        <div className="button-row">
                          <Button onClick={() => startEdit(structure)}>
                            Edit
                          </Button>
                          <Button
                            onClick={async () => {
                              if (
                                !window.confirm(
                                  `Delete "${structure.name}"? Structures used by invoices cannot be deleted.`,
                                )
                              ) {
                                return;
                              }
                              try {
                                await deleteStructure.mutateAsync(structure.id);
                                toast.showToast('Fee structure deleted.');
                              } catch (error) {
                                setFormError(apiMessage(error));
                              }
                            }}
                            variant="danger"
                          >
                            Delete
                          </Button>
                        </div>
                      )}
                    </div>
                    <ul className="finance-fee-head-list">
                      {structure.feeHeads.map((head) => (
                        <li key={head.title}>
                          <span>
                            {head.title}
                            {head.isOptional && (
                              <small className="finance-cell-secondary">
                                Optional
                              </small>
                            )}
                          </span>
                          <strong>{amountText(head.amount)}</strong>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No fee structures yet"
                description="Create a class fee structure to begin billing."
              />
            )}
          </section>
        </div>
      )}

      <Dialog
        open={Boolean(paymentInvoice)}
        title="Record invoice payment"
        description={
          paymentInvoice
            ? `${paymentInvoice.invoiceNumber} · ${paymentInvoice.studentName} · remaining balance ${amountText(paymentInvoice.totalAmount - paymentInvoice.paidAmount)}`
            : undefined
        }
        onOpenChange={(open) => {
          if (!open) setPaymentInvoice(null);
        }}
      >
        {paymentInvoice && (
          <form className="finance-dialog-form" onSubmit={submitPayment}>
            <FinanceField label="Amount paid">
              <input
                autoFocus
                min="0.01"
                max={amountText(paymentInvoice.totalAmount - paymentInvoice.paidAmount)}
                required
                step="0.01"
                type="number"
                value={paymentAmount}
                onChange={(event) => setPaymentAmount(event.target.value)}
              />
            </FinanceField>
            <FinanceField label="Payment method">
              <select
                className="finance-select"
                value={paymentMethod}
                onChange={(event) =>
                  setPaymentMethod(event.target.value as PaymentMethod)
                }
              >
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="card">Card</option>
                <option value="online">Online</option>
              </select>
            </FinanceField>
            <FinanceField label="Payment date">
              <input
                max={today()}
                required
                type="date"
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
              />
            </FinanceField>
            <FinanceField label="Transaction reference">
              <input
                maxLength={160}
                value={transactionReference}
                onChange={(event) =>
                  setTransactionReference(event.target.value)
                }
              />
            </FinanceField>
            {formError && (
              <p className="finance-form-error" role="alert">
                {formError}
              </p>
            )}
            <div className="finance-form-actions">
              <Button
                disabled={recordPayment.isPending}
                type="submit"
                variant="primary"
              >
                {recordPayment.isPending ? 'Recording…' : 'Record payment'}
              </Button>
              <Button
                onClick={() => setPaymentInvoice(null)}
                type="button"
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </main>
  );
}
