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
  InvoiceDeleteOtpChallenge,
  InvoiceStatus,
  PaymentMethod,
  StudentInvoice,
} from './finance-api.js';
import {
  useDeleteFeeStructure,
  useDeleteInvoice,
  useFinanceWorkspace,
  useGenerateInvoices,
  useRecordInvoicePayment,
  useRequestInvoiceDeleteOtp,
  useSaveFeeStructure,
  useSetInvoiceDiscount,
} from './finance-queries.js';
import { StudentFeeLedgerModal } from './StudentFeeLedgerModal.js';
import { StudentConcessionModal } from './StudentConcessionModal.js';

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

function handlePrintReceipt(invoice: StudentInvoice, classNameText: string) {
  const remaining = Math.max(0, invoice.totalAmount - invoice.paidAmount);

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Fee Receipt - ${invoice.invoiceNumber}</title>
      <style>
        * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        body { padding: 30px; margin: 0; background: #ffffff; color: #0f172a; }
        .receipt-card { border: 2px solid #0f172a; border-radius: 8px; padding: 24px; max-width: 520px; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 16px; }
        .header h2 { margin: 0; font-size: 20px; color: #0f172a; }
        .badge { padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
        .badge.paid { background: #dcfce7; color: #166534; }
        .badge.partial { background: #fef3c7; color: #854d0e; }
        .badge.unpaid { background: #fee2e2; color: #991b1b; }
        .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px; margin-bottom: 20px; }
        .meta-grid div strong { color: #64748b; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; }
        td { padding: 10px 0; }
        .row-total { border-top: 1px solid #e2e8f0; }
        .row-paid { color: #15803d; }
        .row-balance { border-top: 2px dashed #94a3b8; font-size: 16px; font-weight: bold; color: #b91c1c; }
        .text-right { text-align: right; }
        .footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="receipt-card">
        <div class="header">
          <h2>InstituteOS Fee Receipt</h2>
          <span class="badge ${invoice.status}">${invoice.status}</span>
        </div>
        <div class="meta-grid">
          <div><strong>Invoice:</strong> ${invoice.invoiceNumber}</div>
          <div><strong>Student:</strong> ${invoice.studentName}</div>
          <div><strong>Class:</strong> ${classNameText}</div>
          <div><strong>Billing Cycle:</strong> ${invoice.billingCycle}</div>
          <div><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</div>
        </div>
        <table>
          ${
            invoice.discountAmount && invoice.discountAmount > 0
              ? `
          <tr class="row-total">
            <td>Current Fee:</td>
            <td class="text-right">Rs. ${Number(invoice.currentAmount ?? invoice.totalAmount).toFixed(2)}</td>
          </tr>
          <tr style="color: #16a34a;">
            <td>Concession (${invoice.discountReason || 'Discount'}):</td>
            <td class="text-right"><strong>- Rs. ${Number(invoice.discountAmount).toFixed(2)}</strong></td>
          </tr>`
              : ''
          }
          ${
            invoice.arrearsAmount && invoice.arrearsAmount > 0
              ? `
          <tr style="color: #d97706;">
            <td>Previous Arrears:</td>
            <td class="text-right">+ Rs. ${Number(invoice.arrearsAmount).toFixed(2)}</td>
          </tr>`
              : ''
          }
          <tr class="row-total">
            <td>Net Total Payable:</td>
            <td class="text-right"><strong>Rs. ${Number(invoice.totalAmount).toFixed(2)}</strong></td>
          </tr>
          <tr class="row-paid">
            <td>Paid Amount:</td>
            <td class="text-right"><strong>Rs. ${Number(invoice.paidAmount).toFixed(2)}</strong></td>
          </tr>
          <tr class="row-balance">
            <td>Remaining Balance (Baqaya):</td>
            <td class="text-right">Rs. ${remaining.toFixed(2)}</td>
          </tr>
        </table>
        <div class="footer">
          Computer generated official fee receipt. Valid without signature.
        </div>
      </div>
    </body>
    </html>
  `;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(htmlContent);
  doc.close();

  iframe.contentWindow?.focus();
  setTimeout(() => {
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 250);
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
  const requestDeleteOtp = useRequestInvoiceDeleteOtp(organizationId);
  const deleteInvoiceMutation = useDeleteInvoice(organizationId);
  const setInvoiceDiscountMutation = useSetInvoiceDiscount(organizationId);
  const toast = useToast();

  const [deletingInvoice, setDeletingInvoice] = useState<StudentInvoice | null>(null);
  const [deleteOtpChallenge, setDeleteOtpChallenge] =
    useState<InvoiceDeleteOtpChallenge | null>(null);
  const [deleteOtpInput, setDeleteOtpInput] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const [academicYearId, setAcademicYearId] = useState('');
  const [bulkClassId, setBulkClassId] = useState('');
  const [feeStructureId, setFeeStructureId] = useState('');
  const [ledgerStudent, setLedgerStudent] = useState<{ id: string; name: string } | null>(null);
  const [concessionStudent, setConcessionStudent] = useState<{ id: string; name: string } | null>(null);
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
  const [receiptInvoice, setReceiptInvoice] = useState<StudentInvoice | null>(
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

  async function handleToggleInvoiceDiscount(
    invoice: StudentInvoice,
    applyDiscount: boolean,
  ) {
    try {
      await setInvoiceDiscountMutation.mutateAsync({
        invoiceId: invoice.id,
        applyDiscount,
      });
      toast.showToast(
        applyDiscount
          ? `Concession applied to ${invoice.invoiceNumber}.`
          : `Concession removed from ${invoice.invoiceNumber}.`,
      );
    } catch (error) {
      setFormError(apiMessage(error));
    }
  }

  async function initiateDeleteInvoice(invoice: StudentInvoice) {
    setDeleteError('');
    setDeleteOtpInput('');
    setDeleteOtpChallenge(null);

    // Agar Unpaid hai (Paid === 0), toh direct confirmation se delete kar dein
    if (invoice.paidAmount <= 0) {
      if (
        !window.confirm(
          `Delete unpaid invoice ${invoice.invoiceNumber} (${invoice.studentName})?`,
        )
      ) {
        return;
      }
      try {
        await deleteInvoiceMutation.mutateAsync({ invoiceId: invoice.id });
        toast.showToast(`Invoice ${invoice.invoiceNumber} deleted.`);
      } catch (error) {
        setFormError(apiMessage(error));
      }
      return;
    }

    // Agar Paid ya Partial hai, toh Owner OTP Security Dialog kholein
    setDeletingInvoice(invoice);
  }

  async function handleSendOwnerOtp() {
    if (!deletingInvoice) return;
    setDeleteError('');
    try {
      const challenge = await requestDeleteOtp.mutateAsync(deletingInvoice.id);
      setDeleteOtpChallenge(challenge);
      toast.showToast('Security alert & OTP generated for Institute Owner.');
      if (challenge.whatsAppAlertUrl) {
        window.open(challenge.whatsAppAlertUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      setDeleteError(apiMessage(error));
    }
  }

  async function handleConfirmProtectedDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!deletingInvoice) return;
    setDeleteError('');
    try {
      await deleteInvoiceMutation.mutateAsync({
        invoiceId: deletingInvoice.id,
        otpCode: deleteOtpInput.trim(),
      });
      toast.showToast(
        `Invoice ${deletingInvoice.invoiceNumber} and its receipts deleted after Owner approval.`,
      );
      setDeletingInvoice(null);
      setDeleteOtpChallenge(null);
      setDeleteOtpInput('');
    } catch (error) {
      setDeleteError(apiMessage(error));
    }
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

      if (result.notification?.whatsAppUrl) {
        window.open(result.notification.whatsAppUrl, '_blank', 'noopener,noreferrer');
      }
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
                  render: (row) => {
                    const remaining = Math.max(0, row.totalAmount - row.paidAmount);
                    const hasDiscount = Boolean(row.discountAmount && row.discountAmount > 0);
                    const baseFee =
                      row.currentAmount && row.currentAmount > 0
                        ? row.currentAmount
                        : row.totalAmount + (row.discountAmount ?? 0);
                    return (
                      <div>
                        {hasDiscount ? (
                          <>
                            <span
                              className="finance-cell-secondary"
                              style={{ textDecoration: 'line-through', opacity: 0.75 }}
                            >
                              Fee: {amountText(baseFee)}
                            </span>
                            <span
                              className="finance-cell-secondary"
                              style={{ color: '#16a34a', fontWeight: 600 }}
                              title={row.discountReason || 'Concession applied'}
                            >
                              Discount: -{amountText(row.discountAmount ?? 0)}
                            </span>
                          </>
                        ) : null}
                        <strong>Net: {amountText(row.totalAmount)}</strong>
                        <span className="finance-cell-secondary">
                          Paid {amountText(row.paidAmount)}
                          {remaining > 0 ? ` · Due ${amountText(remaining)}` : ''}
                        </span>
                        {canWrite && (
                          <button
                            type="button"
                            onClick={() => handleToggleInvoiceDiscount(row, !hasDiscount)}
                            disabled={setInvoiceDiscountMutation.isPending}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              marginTop: '0.2rem',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              color: hasDiscount ? '#d97706' : '#2563eb',
                              cursor: 'pointer',
                              textDecoration: 'underline',
                            }}
                            title={
                              hasDiscount
                                ? 'Remove discount from this specific invoice only'
                                : 'Apply student active concession to this invoice'
                            }
                          >
                            {hasDiscount ? 'Remove discount here' : 'Apply discount here'}
                          </button>
                        )}
                      </div>
                    );
                  },
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
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <Button
                        disabled={!canWrite || row.status === 'paid'}
                        onClick={() => openPayment(row)}
                      >
                        Record payment
                      </Button>
                      <Button
                        variant="quiet"
                        onClick={() => setReceiptInvoice(row)}
                      >
                        Receipt
                      </Button>
                      <Button
                        variant="quiet"
                        onClick={() =>
                          setLedgerStudent({
                            id: row.studentId,
                            name: row.studentName,
                          })
                        }
                      >
                        Ledger
                      </Button>
                      {canWrite && (
                        <>
                          <Button
                            variant="quiet"
                            onClick={() =>
                              setConcessionStudent({
                                id: row.studentId,
                                name: row.studentName,
                              })
                            }
                            title="Manage student fee concessions and scholarships"
                          >
                            Discount
                          </Button>
                          <Button
                            variant="danger"
                            onClick={() => void initiateDeleteInvoice(row)}
                            title={
                              row.paidAmount > 0
                                ? 'Requires Institute Owner OTP approval'
                                : 'Delete unpaid invoice'
                            }
                          >
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
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
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                    <Button
                      className="finance-card-payment-button"
                      disabled={!canWrite || invoice.status === 'paid'}
                      onClick={() => openPayment(invoice)}
                    >
                      Record Payment
                    </Button>
                    <Button
                      variant="quiet"
                      onClick={() => setReceiptInvoice(invoice)}
                    >
                      Receipt
                    </Button>
                    <Button
                      variant="quiet"
                      onClick={() =>
                        setLedgerStudent({
                          id: invoice.studentId,
                          name: invoice.studentName,
                        })
                      }
                    >
                      Ledger
                    </Button>
                    {canWrite && (
                      <Button
                        variant="quiet"
                        onClick={() =>
                          setConcessionStudent({
                            id: invoice.studentId,
                            name: invoice.studentName,
                          })
                        }
                      >
                        Discount
                      </Button>
                    )}
                  </div>
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

      {/* Record Payment Dialog */}
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

      {/* Printable Receipt & Proof Dialog */}
      <Dialog
        open={Boolean(receiptInvoice)}
        title="Student Fee Receipt"
        description={
          receiptInvoice
            ? `Official payment slip for ${receiptInvoice.studentName} (${receiptInvoice.invoiceNumber})`
            : undefined
        }
        onOpenChange={(open) => {
          if (!open) setReceiptInvoice(null);
        }}
      >
        {receiptInvoice && (
          <div className="finance-receipt-dialog">
            <div className="finance-receipt-card" id="printable-fee-receipt">
              <div className="finance-receipt-header">
                <h3>InstituteOS Fee Receipt</h3>
                <span className="finance-receipt-tag">
                  {statusLabels[receiptInvoice.status]}
                </span>
              </div>
              <hr style={{ margin: '0.75rem 0', opacity: 0.2 }} />
              <div className="finance-receipt-meta">
                <div>
                  <strong>Invoice:</strong> {receiptInvoice.invoiceNumber}
                </div>
                <div>
                  <strong>Student:</strong> {receiptInvoice.studentName}
                </div>
                <div>
                  <strong>Class:</strong> {className(receiptInvoice.classId, classes)}
                </div>
                <div>
                  <strong>Cycle:</strong> {receiptInvoice.billingCycle}
                </div>
                <div>
                  <strong>Due Date:</strong> {new Date(receiptInvoice.dueDate).toLocaleDateString()}
                </div>
              </div>
              <hr style={{ margin: '0.75rem 0', opacity: 0.2 }} />
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.5rem' }}>
                <tbody>
                  {receiptInvoice.discountAmount && receiptInvoice.discountAmount > 0 ? (
                    <>
                      <tr>
                        <td style={{ padding: '0.35rem 0', color: '#64748b' }}>Base Fee:</td>
                        <td style={{ textAlign: 'right', color: '#64748b' }}>
                          Rs. {amountText(receiptInvoice.currentAmount ?? receiptInvoice.totalAmount)}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '0.35rem 0', color: '#16a34a' }}>
                          Discount ({receiptInvoice.discountReason || 'Concession'}):
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#16a34a' }}>
                          - Rs. {amountText(receiptInvoice.discountAmount)}
                        </td>
                      </tr>
                    </>
                  ) : null}
                  <tr>
                    <td style={{ padding: '0.35rem 0' }}>Net Total Billed:</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                      Rs. {amountText(receiptInvoice.totalAmount)}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.35rem 0', color: '#10b981' }}>Paid Amount:</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#10b981' }}>
                      Rs. {amountText(receiptInvoice.paidAmount)}
                    </td>
                  </tr>
                  <tr style={{ borderTop: '1px dashed #cbd5e1' }}>
                    <td style={{ padding: '0.5rem 0', fontWeight: 'bold', color: '#dc2626' }}>
                      Remaining Balance (Baqaya):
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '1.1rem', color: '#dc2626' }}>
                      Rs. {amountText(receiptInvoice.totalAmount - receiptInvoice.paidAmount)}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: '#64748b', textAlign: 'center' }}>
                Computer generated fee slip. Valid without manual signature.
              </div>
            </div>

            <div className="finance-form-actions" style={{ marginTop: '1.25rem' }}>
              <Button
                variant="primary"
                onClick={() =>
                  handlePrintReceipt(
                    receiptInvoice,
                    className(receiptInvoice.classId, classes),
                  )
                }
              >
                Print Receipt
              </Button>
              <Button
                onClick={() => setReceiptInvoice(null)}
                type="button"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Student Fee Ledger Modal */}
      {ledgerStudent && (
        <StudentFeeLedgerModal
          organizationId={organizationId}
          studentId={ledgerStudent.id}
          studentName={ledgerStudent.name}
          isOpen={Boolean(ledgerStudent)}
          onClose={() => setLedgerStudent(null)}
        />
      )}

      {/* Student Fee Concession / Discount Modal */}
      {concessionStudent && (
        <StudentConcessionModal
          organizationId={organizationId}
          studentId={concessionStudent.id}
          studentName={concessionStudent.name}
          isOpen={Boolean(concessionStudent)}
          onClose={() => setConcessionStudent(null)}
        />
      )}

      {/* Owner OTP Anti-Fraud Invoice Deletion Dialog */}
      <Dialog
        open={Boolean(deletingInvoice)}
        title="🚨 Owner Security Approval Required"
        description={
          deletingInvoice
            ? `Invoice ${deletingInvoice.invoiceNumber} (${deletingInvoice.studentName}) has Rs. ${amountText(deletingInvoice.paidAmount)} in collected payments.`
            : undefined
        }
        onOpenChange={(open) => {
          if (!open) {
            setDeletingInvoice(null);
            setDeleteOtpChallenge(null);
            setDeleteOtpInput('');
            setDeleteError('');
          }
        }}
      >
        {deletingInvoice && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '10px',
                padding: '0.9rem 1rem',
                color: '#991b1b',
                fontSize: '0.85rem',
                lineHeight: 1.5,
              }}
            >
              <strong>Anti-Fraud Protection Active:</strong> Paid or partially paid
              invoices cannot be deleted by staff alone. An alert with the collected
              amount (<strong>Rs. {amountText(deletingInvoice.paidAmount)}</strong>)
              will be sent to the Institute Owner. The Owner should only share the OTP
              if this is a verified test or mistake entry.
            </div>

            {!deleteOtpChallenge ? (
              <div className="finance-form-actions">
                <Button
                  variant="primary"
                  disabled={requestDeleteOtp.isPending}
                  onClick={() => void handleSendOwnerOtp()}
                  type="button"
                >
                  {requestDeleteOtp.isPending
                    ? 'Sending Alert to Owner…'
                    : 'Send Fraud Alert & OTP to Owner'}
                </Button>
                <Button
                  onClick={() => setDeletingInvoice(null)}
                  type="button"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <form
                className="finance-dialog-form"
                onSubmit={handleConfirmProtectedDelete}
              >
                {deleteOtpChallenge.devOtpPreview && (
                  <div
                    style={{
                      background: '#eff6ff',
                      border: '1px dashed #60a5fa',
                      borderRadius: '8px',
                      padding: '0.65rem 0.85rem',
                      fontSize: '0.82rem',
                      color: '#1e3a8a',
                    }}
                  >
                    <strong>Owner / Dev Preview OTP:</strong>{' '}
                    <code style={{ fontSize: '1rem', fontWeight: 700 }}>
                      {deleteOtpChallenge.devOtpPreview}
                    </code>{' '}
                    <span style={{ opacity: 0.8 }}>
                      (Also opened in WhatsApp Alert & API console)
                    </span>
                  </div>
                )}

                <FinanceField label="Enter 6-Digit Owner Approval OTP">
                  <input
                    autoFocus
                    maxLength={6}
                    placeholder="e.g. 482910"
                    required
                    value={deleteOtpInput}
                    onChange={(event) => setDeleteOtpInput(event.target.value)}
                  />
                </FinanceField>

                {deleteError && (
                  <p className="finance-form-error" role="alert">
                    {deleteError}
                  </p>
                )}

                <div className="finance-form-actions">
                  <Button
                    variant="danger"
                    disabled={
                      deleteInvoiceMutation.isPending ||
                      deleteOtpInput.trim().length < 6
                    }
                    type="submit"
                  >
                    {deleteInvoiceMutation.isPending
                      ? 'Verifying & Deleting…'
                      : 'Verify OTP & Delete Invoice'}
                  </Button>
                  <Button
                    onClick={() => void handleSendOwnerOtp()}
                    disabled={requestDeleteOtp.isPending}
                    type="button"
                    variant="quiet"
                  >
                    Resend OTP
                  </Button>
                  <Button
                    onClick={() => setDeletingInvoice(null)}
                    type="button"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </Dialog>
    </main>
  );
}