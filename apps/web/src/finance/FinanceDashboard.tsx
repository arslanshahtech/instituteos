import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  ArrowUpRight,
  Banknote,
  Download,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  WalletCards,
  BadgePercent,
} from 'lucide-react';
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
  ExpenseCategory,
  FeeHead,
  FeeStructure,
  FinanceExpense,
  FinancePayment,
  InvoiceDeleteOtpChallenge,
  InvoiceStatus,
  PaymentMethod,
  StudentInvoice,
} from './finance-api.js';
import {
  useDeleteFeeStructure,
  useDeleteFinanceExpense,
  useDeleteInvoice,
  useFinanceWorkspace,
  useGenerateInvoices,
  useCreateFinanceExpense,
  useRecordInvoicePayment,
  useRequestInvoiceDeleteOtp,
  useSaveFeeStructure,
  useSaveFinanceExpenseBudget,
} from './finance-queries.js';
import { StudentFeeLedgerModal } from './StudentFeeLedgerModal.js';
import { StudentConcessionModal } from './StudentConcessionModal.js';

const tabs = [
  'All',
  'Fee Collection',
  'Invoices',
  'Payments',
  'Expenses',
  'Ledger (Laser)',
  'Concessions',
] as const;
type WorkspaceTab = (typeof tabs)[number];
type Tab = WorkspaceTab | 'Create invoices' | 'Fee setup';

const expenseCategories: { value: ExpenseCategory; label: string }[] = [
  { value: 'salaries', label: 'Salaries' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'stationery', label: 'Stationery' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'transport', label: 'Transport' },
  { value: 'supplies', label: 'Supplies' },
  { value: 'other', label: 'Other' },
];

const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  card: 'Card',
  online: 'Online',
};

function currency(value: number) {
  return `Rs ${Math.round(value).toLocaleString('en-PK')}`;
}

function shortDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '—'
    : parsed.toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
}

type FeeHeadDraft = { title: string; amount: string; isOptional: boolean };

interface FinanceTransactionRow {
  id: string;
  date: string;
  description: string;
  detail: string;
  category: string;
  type: string;
  method: string;
  amount: number;
  status: string;
  reference: string;
  kind: 'payment' | 'expense' | 'invoice';
  invoice?: StudentInvoice;
  payment?: FinancePayment;
}

const statusLabels: Record<InvoiceStatus, string> = {
  unpaid: 'Unpaid',
  partial: 'Partial',
  paid: 'Paid',
  overdue: 'Overdue',
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthStart() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function monthEnd() {
  const date = new Date();
  const lastDay = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
  ).getDate();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

function amountText(value: number) {
  return value.toFixed(2);
}

function csvCell(value: string | number) {
  const text = String(value);
  const safeText = /^[=+\-@\t\r]/.test(text) ? "'" + text : text;
  return '"' + safeText.replaceAll('"', '""') + '"';
}

function exportInvoiceResults(
  invoices: StudentInvoice[],
  classes: AcademicClass[],
  campuses: { id: string; name: string }[],
) {
  const rows = [
    [
      'Invoice',
      'Student',
      'Class',
      'Campus',
      'Due date',
      'Total (PKR)',
      'Paid (PKR)',
      'Due (PKR)',
      'Status',
    ],
    ...invoices.map((invoice) => [
      invoice.invoiceNumber,
      invoice.studentName,
      className(invoice.classId, classes),
      campusName(invoice.campusId, campuses),
      invoice.dueDate.slice(0, 10),
      amountText(invoice.totalAmount),
      amountText(invoice.paidAmount),
      amountText(Math.max(0, invoice.totalAmount - invoice.paidAmount)),
      statusLabels[invoice.status],
    ]),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'instituteos-fee-ledger-' + today() + '.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\\r\\n');
  const blob = new Blob(['\\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function exportFinanceTransactions(
  rows: Array<{
    date: string;
    description: string;
    detail: string;
    category: string;
    type: string;
    method: string;
    amount: number;
    status: string;
    reference: string;
  }>,
) {
  downloadCsv('instituteos-finance-transactions-' + today() + '.csv', [
    [
      'Date',
      'Student / description',
      'Detail',
      'Category',
      'Type',
      'Method',
      'Amount (PKR)',
      'Status',
      'Receipt / reference',
    ],
    ...rows.map((row) => [
      row.date.slice(0, 10),
      row.description,
      row.detail,
      row.category,
      row.type,
      row.method,
      row.amount,
      row.status,
      row.reference,
    ]),
  ]);
}

function exportFinanceLedger(
  rows: Array<{
    date: string;
    description: string;
    reference: string;
    debit: number;
    credit: number;
    balance: number;
  }>,
) {
  downloadCsv('instituteos-general-ledger-' + today() + '.csv', [
    [
      'Date',
      'Particulars',
      'Voucher',
      'Debit / income (PKR)',
      'Credit / expense (PKR)',
      'Balance (PKR)',
    ],
    ...rows.map((row) => [
      row.date.slice(0, 10),
      row.description,
      row.reference,
      row.debit,
      row.credit,
      row.balance,
    ]),
  ]);
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

function handlePrintReceipt(
  invoice: StudentInvoice,
  classNameText: string,
  payment?: {
    receiptNumber: string;
    amountPaid: number;
    paymentMethod: PaymentMethod;
    paymentDate: string;
  },
) {
  const remaining = Math.max(0, invoice.totalAmount - invoice.paidAmount);

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>${payment ? 'Payment Receipt' : 'Fee Statement'} - ${invoice.invoiceNumber}</title>
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
          <h2>InstituteOS ${payment ? 'Payment Receipt' : 'Fee Statement'}</h2>
          <span class="badge ${invoice.status}">${invoice.status}</span>
        </div>
        <div class="meta-grid">
          <div><strong>Invoice:</strong> ${invoice.invoiceNumber}</div>
          ${payment ? `<div><strong>Receipt:</strong> ${payment.receiptNumber}</div><div><strong>Payment date:</strong> ${new Date(payment.paymentDate).toLocaleDateString()}</div><div><strong>Method:</strong> ${payment.paymentMethod.replace('_', ' ')}</div>` : ''}
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
          ${payment ? `<tr class="row-paid"><td>This payment (${payment.receiptNumber}):</td><td class="text-right"><strong>Rs. ${payment.amountPaid.toFixed(2)}</strong></td></tr>` : ''}
          <tr class="row-paid">
            <td>Total Paid Amount:</td>
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
  const location = useLocation();
  const roleBase = location.pathname.startsWith('/accountant')
    ? '/accountant'
    : '/admin';
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
  const [tab, setTab] = useState<Tab>('All');
  const [campusFilter, setCampusFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | ''>('');
  const [datePreset, setDatePreset] = useState('month');
  const [dateFrom, setDateFrom] = useState(monthStart());
  const [dateTo, setDateTo] = useState(monthEnd());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<
    string[]
  >([]);
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | ''>('');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<
    ExpenseCategory | ''
  >('');
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [budgetCategory, setBudgetCategory] =
    useState<ExpenseCategory>('utilities');
  const [budgetMonth, setBudgetMonth] = useState(monthStart().slice(0, 7));
  const [budgetAmount, setBudgetAmount] = useState('');
  const [budgetCampusId, setBudgetCampusId] = useState('');
  const [budgetError, setBudgetError] = useState('');
  const [ledgerAccountFilter, setLedgerAccountFilter] = useState<
    'All Accounts' | 'Fee Income' | 'Expense' | 'Cash in Hand' | 'Bank'
  >('All Accounts');
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseCategory, setExpenseCategory] =
    useState<ExpenseCategory>('utilities');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseMethod, setExpenseMethod] = useState<PaymentMethod>('cash');
  const [expenseDate, setExpenseDate] = useState(today());
  const [expenseCampusId, setExpenseCampusId] = useState('');
  const [expenseReference, setExpenseReference] = useState('');
  const [expenseError, setExpenseError] = useState('');
  const [globalPaymentOpen, setGlobalPaymentOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleSearchShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleSearchShortcut);
    return () => window.removeEventListener('keydown', handleSearchShortcut);
  }, []);
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
  const operationFilters = useMemo(
    () => ({
      campusId: campusFilter || undefined,
      classId: classFilter || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      month: (dateFrom || monthStart()).slice(0, 7),
      paymentMethod: methodFilter || undefined,
    }),
    [campusFilter, classFilter, dateFrom, dateTo, methodFilter],
  );
  const finance = useFinanceWorkspace(
    organizationId,
    Boolean(access.data && canRead),
    filters,
    operationFilters,
  );
  const feeStructures = finance.feeStructures.data?.items ?? [];
  const invoices = finance.invoices.data?.items ?? [];
  const allInvoices = finance.allInvoices.data?.items ?? [];
  const payments = finance.payments.data?.items ?? [];
  const expenses = finance.expenses.data?.items ?? [];
  const expenseBudgets = finance.expenseBudgets.data?.items ?? [];
  const concessions = finance.concessions.data?.items ?? [];
  const visibleInvoices = invoices.filter((invoice) => {
    const needle = searchTerm.trim().toLowerCase();
    return (
      !needle ||
      [
        invoice.studentName,
        invoice.invoiceNumber,
        invoice.feeStructureName,
        className(invoice.classId, classes),
        campusName(invoice.campusId, campuses),
      ].some((value) => value.toLowerCase().includes(needle))
    );
  });
  const visiblePayments = payments.filter((payment) => {
    const needle = searchTerm.trim().toLowerCase();
    return (
      !needle ||
      [
        payment.studentName,
        payment.receiptNumber,
        payment.invoiceNumber,
        payment.transactionReference ?? '',
        paymentMethodLabels[payment.paymentMethod],
      ].some((value) => value.toLowerCase().includes(needle))
    );
  });
  const searchedExpenses = expenses.filter((expense) => {
    const needle = searchTerm.trim().toLowerCase();
    return (
      !needle ||
      [
        expense.description,
        expense.category,
        expense.reference ?? '',
        paymentMethodLabels[expense.paymentMethod],
      ].some((value) => value.toLowerCase().includes(needle))
    );
  });
  const visibleExpenses = searchedExpenses.filter(
    (expense) =>
      !expenseCategoryFilter || expense.category === expenseCategoryFilter,
  );
  const visibleConcessions = concessions.filter((concession) => {
    const needle = searchTerm.trim().toLowerCase();
    return (
      !needle ||
      [
        concession.studentName,
        concession.concessionType,
        concession.reason ?? '',
      ].some((value) => value.toLowerCase().includes(needle))
    );
  });
  const allTransactions: FinanceTransactionRow[] = [
    ...visiblePayments.map((payment) => ({
      id: `payment-${payment.id}`,
      date: payment.paymentDate,
      description: payment.studentName,
      detail: payment.invoiceNumber,
      category: payment.invoiceNumber.toLowerCase().includes('admission')
        ? 'Admission fee'
        : 'Monthly fee',
      type: 'Fee',
      method: paymentMethodLabels[payment.paymentMethod],
      amount: payment.amountPaid,
      status: 'Paid',
      reference: payment.receiptNumber,
      kind: 'payment' as const,
      payment,
    })),
    ...searchedExpenses.map((expense) => ({
      id: `expense-${expense.id}`,
      date: expense.expenseDate,
      description: expense.description,
      detail: expense.reference ?? '',
      category:
        expenseCategories.find((item) => item.value === expense.category)
          ?.label ?? 'Other',
      type: 'Expense',
      method: paymentMethodLabels[expense.paymentMethod],
      amount: -expense.amount,
      status: 'Recorded',
      reference: expense.reference ?? '—',
      kind: 'expense' as const,
    })),
    ...visibleInvoices
      .filter((invoice) => invoice.totalAmount > invoice.paidAmount)
      .map((invoice) => ({
        id: `invoice-${invoice.id}`,
        date: invoice.issueDate,
        description: invoice.studentName,
        detail: `${invoice.invoiceNumber} · ${className(invoice.classId, classes)}`,
        category: /admission/i.test(invoice.feeStructureName)
          ? 'Admission fee'
          : /concession|sibling|discount/i.test(invoice.feeStructureName)
            ? 'Concession'
            : 'Monthly fee',
        type: /concession|sibling|discount/i.test(invoice.feeStructureName)
          ? 'Concession'
          : 'Fee',
        method: '—',
        amount: Math.max(0, invoice.totalAmount - invoice.paidAmount),
        status: statusLabels[invoice.status],
        reference: invoice.invoiceNumber,
        kind: 'invoice' as const,
        invoice,
      })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const filteredTransactions = allTransactions.filter(
    (row) =>
      !statusFilter ||
      (statusFilter === 'unpaid'
        ? row.status === 'Unpaid' || row.status === 'Pending'
        : row.status.toLowerCase() === statusFilter),
  );
  const ledgerEntries = [
    ...visiblePayments.map((payment) => ({
      id: `payment-${payment.id}`,
      date: payment.paymentDate,
      description: `Fee received — ${payment.studentName}`,
      reference: payment.receiptNumber,
      debit: payment.amountPaid,
      credit: 0,
      account: payment.paymentMethod === 'cash' ? 'Cash in Hand' : 'Bank',
    })),
    ...searchedExpenses.map((expense) => ({
      id: `expense-${expense.id}`,
      date: expense.expenseDate,
      description: expense.description,
      reference: expense.reference ?? 'Expense',
      debit: 0,
      credit: expense.amount,
      account: expense.paymentMethod === 'cash' ? 'Cash in Hand' : 'Bank',
    })),
  ]
    .filter((entry) => {
      if (ledgerAccountFilter === 'All Accounts') return true;
      if (ledgerAccountFilter === 'Fee Income') return entry.debit > 0;
      if (ledgerAccountFilter === 'Expense') return entry.credit > 0;
      return entry.account === ledgerAccountFilter;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  let runningBalance = 0;
  const ledgerRows = ledgerEntries
    .map((entry) => {
      runningBalance += entry.debit - entry.credit;
      return { ...entry, balance: runningBalance };
    })
    .reverse();
  const collectedTotal = payments.reduce(
    (sum, payment) => sum + payment.amountPaid,
    0,
  );
  const pendingTotal = invoices.reduce(
    (sum, invoice) =>
      sum + Math.max(0, invoice.totalAmount - invoice.paidAmount),
    0,
  );
  const overdueTotal = invoices
    .filter((invoice) => invoice.status === 'overdue')
    .reduce(
      (sum, invoice) =>
        sum + Math.max(0, invoice.totalAmount - invoice.paidAmount),
      0,
    );
  const expenseTotal = expenses.reduce(
    (sum, expense) => sum + expense.amount,
    0,
  );
  const netTotal = collectedTotal - expenseTotal;
  const expenseCategorySummary = expenseCategories.map((category) => {
    const total = expenses
      .filter((expense) => expense.category === category.value)
      .reduce((sum, expense) => sum + expense.amount, 0);
    const budget = expenseBudgets
      .filter((item) => item.category === category.value)
      .reduce((sum, item) => sum + item.budgetAmount, 0);
    return {
      ...category,
      total,
      budget,
      count: expenses.filter((expense) => expense.category === category.value)
        .length,
      percentage:
        budget > 0 ? Math.min(100, Math.round((total / budget) * 100)) : 0,
    };
  });
  const concessionSummary = [
    {
      type: 'sibling' as const,
      label: 'Sibling concession',
      detail: 'Support for multiple children in one family',
    },
    {
      type: 'staff_child' as const,
      label: 'Staff children',
      detail: 'Concessions for staff family members',
    },
    {
      type: 'scholarship' as const,
      label: 'Scholarships',
      detail: 'Merit and academic support',
    },
  ].map((item) => ({
    ...item,
    total: concessions.filter(
      (concession) =>
        concession.concessionType === item.type && concession.isActive,
    ).length,
  }));
  const saveStructure = useSaveFeeStructure(organizationId);
  const deleteStructure = useDeleteFeeStructure(organizationId);
  const generateInvoices = useGenerateInvoices(organizationId);
  const recordPayment = useRecordInvoicePayment(organizationId);
  const requestDeleteOtp = useRequestInvoiceDeleteOtp(organizationId);
  const deleteInvoiceMutation = useDeleteInvoice(organizationId);
  const createExpense = useCreateFinanceExpense(organizationId);
  const deleteExpense = useDeleteFinanceExpense(organizationId);
  const saveExpenseBudget = useSaveFinanceExpenseBudget(organizationId);
  const toast = useToast();

  const [deletingInvoice, setDeletingInvoice] = useState<StudentInvoice | null>(
    null,
  );
  const [deleteOtpChallenge, setDeleteOtpChallenge] =
    useState<InvoiceDeleteOtpChallenge | null>(null);
  const [deleteOtpInput, setDeleteOtpInput] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const [academicYearId, setAcademicYearId] = useState('');
  const [bulkClassId, setBulkClassId] = useState('');
  const [feeStructureId, setFeeStructureId] = useState('');
  const [ledgerStudent, setLedgerStudent] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [concessionStudent, setConcessionStudent] = useState<{
    id: string;
    name: string;
  } | null>(null);
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
  const [receiptPayment, setReceiptPayment] = useState<{
    receiptNumber: string;
    amountPaid: number;
    paymentMethod: PaymentMethod;
    paymentDate: string;
  } | null>(null);
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
      item.classId === bulkClassId && item.academicYearId === academicYearId,
  );

  function openInvoiceReceipt(invoice: StudentInvoice) {
    setReceiptPayment(null);
    setReceiptInvoice(invoice);
  }

  function openPayment(invoice: StudentInvoice) {
    setGlobalPaymentOpen(false);
    setPaymentInvoice(invoice);
    setPaymentAmount(amountText(invoice.totalAmount - invoice.paidAmount));
    setPaymentDate(today());
    setFormError('');
  }

  function openGlobalPayment() {
    const available = allInvoices.find(
      (invoice) =>
        invoice.totalAmount > invoice.paidAmount && invoice.status !== 'paid',
    );
    if (!available) {
      toast.showToast(
        'No outstanding invoices are available for payment.',
        'info',
      );
      return;
    }
    setPaymentInvoice(available);
    setPaymentAmount(amountText(available.totalAmount - available.paidAmount));
    setPaymentDate(today());
    setFormError('');
    setGlobalPaymentOpen(true);
  }

  async function submitExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setExpenseError('');
    const amount = Number(expenseAmount);
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      Math.round(amount * 100) !== amount * 100
    ) {
      setExpenseError(
        'Enter a valid expense amount with up to two decimal places.',
      );
      return;
    }
    try {
      await createExpense.mutateAsync({
        description: expenseDescription.trim(),
        category: expenseCategory,
        amount,
        paymentMethod: expenseMethod,
        expenseDate,
        ...(expenseCampusId ? { campusId: expenseCampusId } : {}),
        ...(expenseReference.trim()
          ? { reference: expenseReference.trim() }
          : {}),
      });
      setExpenseDialogOpen(false);
      setExpenseDescription('');
      setExpenseAmount('');
      setExpenseReference('');
      setExpenseDate(today());
      toast.showToast('Expense recorded successfully.');
    } catch (error) {
      setExpenseError(apiMessage(error));
    }
  }

  async function handleDeleteExpense(expense: FinanceExpense) {
    if (!window.confirm(`Delete expense “${expense.description}”?`)) return;
    try {
      await deleteExpense.mutateAsync(expense.id);
      toast.showToast('Expense deleted.');
    } catch (error) {
      toast.showToast(apiMessage(error), 'info');
    }
  }

  function openBudgetEditor(category: ExpenseCategory) {
    const month = (dateFrom || monthStart()).slice(0, 7);
    const selectedCampus =
      campusFilter || (campuses.length === 1 ? campuses[0].id : '');
    const existing = expenseBudgets.find(
      (budget) =>
        budget.category === category &&
        budget.month === month &&
        budget.campusId === (selectedCampus || undefined),
    );
    setBudgetCategory(category);
    setBudgetMonth(month);
    setBudgetCampusId(selectedCampus);
    setBudgetAmount(existing ? String(existing.budgetAmount) : '');
    setBudgetError('');
    setBudgetDialogOpen(true);
  }

  async function submitExpenseBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBudgetError('');
    const amount = Number(budgetAmount);
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      Math.round(amount * 100) !== amount * 100
    ) {
      setBudgetError(
        'Enter a valid budget amount with up to two decimal places.',
      );
      return;
    }
    try {
      await saveExpenseBudget.mutateAsync({
        category: budgetCategory,
        month: budgetMonth,
        budgetAmount: amount,
        ...(budgetCampusId ? { campusId: budgetCampusId } : {}),
      });
      setBudgetDialogOpen(false);
      toast.showToast('Expense budget saved.');
    } catch (error) {
      setBudgetError(apiMessage(error));
    }
  }

  function handleInvoiceReminder(invoice: StudentInvoice) {
    const phone = invoice.guardianPhone?.replace(/\\D/g, '') ?? '';
    if (!phone) {
      toast.showToast(
        'No guardian phone number is available for this invoice.',
        'info',
      );
      return;
    }
    const due = Math.max(0, invoice.totalAmount - invoice.paidAmount);
    const message = `Assalam-o-Alaikum. Fee reminder for ${invoice.studentName}: invoice ${invoice.invoiceNumber}, outstanding balance Rs ${due.toLocaleString('en-PK')}, due date ${shortDate(invoice.dueDate)}. Thank you.`;
    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
      '_blank',
      'noopener,noreferrer',
    );
  }

  async function handleSendOwnerOtp() {
    if (!deletingInvoice) return;
    setDeleteError('');
    try {
      const challenge = await requestDeleteOtp.mutateAsync(deletingInvoice.id);
      setDeleteOtpChallenge(challenge);
      toast.showToast('Security alert & OTP generated for Institute Owner.');
      if (challenge.whatsAppAlertUrl) {
        window.open(
          challenge.whatsAppAlertUrl,
          '_blank',
          'noopener,noreferrer',
        );
      }
    } catch (error) {
      setDeleteError(apiMessage(error));
    }
  }

  async function handleConfirmProtectedDelete(
    event: FormEvent<HTMLFormElement>,
  ) {
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
          'No active students are assigned to the selected class and academic year.';
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
      setGlobalPaymentOpen(false);
      setPaymentAmount('');
      setTransactionReference('');
      setReceiptInvoice(result.invoice);
      setReceiptPayment({
        receiptNumber: result.receipt.receiptNumber,
        amountPaid: result.receipt.amountPaid,
        paymentMethod: result.receipt.paymentMethod,
        paymentDate: result.receipt.paymentDate,
      });
      toast.showToast(
        `Payment recorded · receipt ${result.receipt.receiptNumber}.`,
      );

      if (result.notification?.whatsAppUrl) {
        window.open(
          result.notification.whatsAppUrl,
          '_blank',
          'noopener,noreferrer',
        );
      }
    } catch (error) {
      setFormError(apiMessage(error));
    }
  }

  if (access.isPending)
    return <LoadingState message="Checking finance access..." />;
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
    (finance.allInvoices.data ? null : finance.allInvoices.error) ??
    (finance.payments.data ? null : finance.payments.error) ??
    (finance.expenses.data ? null : finance.expenses.error) ??
    (finance.expenseBudgets.data ? null : finance.expenseBudgets.error) ??
    (finance.concessions.data ? null : finance.concessions.error) ??
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
          void finance.allInvoices.refetch();
          void finance.payments.refetch();
          void finance.expenses.refetch();
          void finance.expenseBudgets.refetch();
          void finance.concessions.refetch();
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
    (finance.allInvoices.isPending && !finance.allInvoices.data) ||
    (finance.payments.isPending && !finance.payments.data) ||
    (finance.expenses.isPending && !finance.expenses.data) ||
    (finance.expenseBudgets.isPending && !finance.expenseBudgets.data) ||
    (finance.concessions.isPending && !finance.concessions.data) ||
    academics.years.isPending ||
    academics.classes.isPending ||
    academics.campuses.isPending
  ) {
    return <LoadingState message="Loading finance workspace..." />;
  }

  return (
    <main className="finance-page reference-live-module">
      <div className="finance-top-toolbar">
        <label className="finance-global-search">
          <Search size={16} aria-hidden="true" />
          <input
            ref={searchInputRef}
            aria-label="Search finance transactions"
            placeholder="Search transactions, students, receipts..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          <kbd>⌘ K</kbd>
        </label>
        <div className="finance-date-range" aria-label="Finance date range">
          <label>
            <span className="visually-hidden">From date</span>
            <input
              type="date"
              max={dateTo || undefined}
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </label>
          <span aria-hidden="true">—</span>
          <label>
            <span className="visually-hidden">To date</span>
            <input
              type="date"
              min={dateFrom || undefined}
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </label>
        </div>
      </div>

      <header className="page-heading finance-page-heading reference-dashboard-heading">
        <div>
          <p className="eyebrow">Organization workspace</p>
          <h1>Finance</h1>
          <p className="page-description">
            Track fees, expenses and ledger activity across your institute.
          </p>
        </div>
        <div className="finance-header-actions">
          <Button
            disabled={!canWrite}
            onClick={() => {
              setExpenseError('');
              setExpenseCampusId(
                campusFilter || (campuses.length === 1 ? campuses[0].id : ''),
              );
              setExpenseDialogOpen(true);
            }}
            type="button"
            variant="quiet"
            className="finance-header-action-button"
          >
            <Plus size={15} aria-hidden="true" /> Add expense
          </Button>
          <Button
            className="finance-header-action-button"
            disabled={!canWrite}
            onClick={openGlobalPayment}
            type="button"
          >
            <Plus size={15} aria-hidden="true" /> Record payment
          </Button>
          <Link
            className="finance-manage-concessions finance-header-action-button"
            to={`${roleBase}/organizations/${encodeURIComponent(organizationId)}/concessions`}
          >
            Manage concessions
          </Link>
        </div>
      </header>

      <section
        className="reference-metrics-grid finance-overview-metrics"
        aria-label="Finance summary"
      >
        <article className="reference-metric-card">
          <div className="admin-metric-heading">
            <span className="reference-metric-icon">
              <WalletCards size={16} aria-hidden="true" />
            </span>
            <span className="reference-metric-label">Total collected</span>
            <span className="finance-metric-dot finance-dot-green" />
          </div>
          <strong>{currency(collectedTotal)}</strong>
          <small>{payments.length} recorded payments</small>
          <span className="finance-metric-track">
            <i
              style={{
                width:
                  collectedTotal + expenseTotal > 0
                    ? `${Math.min(100, (collectedTotal / (collectedTotal + expenseTotal)) * 100)}%`
                    : '0%',
              }}
            />
          </span>
        </article>
        <article className="reference-metric-card">
          <div className="admin-metric-heading">
            <span className="reference-metric-icon">
              <ReceiptText size={16} aria-hidden="true" />
            </span>
            <span className="reference-metric-label">Pending dues</span>
            <span className="finance-metric-dot finance-dot-amber" />
          </div>
          <strong>{currency(pendingTotal)}</strong>
          <small>
            {
              invoices.filter(
                (invoice) => invoice.totalAmount > invoice.paidAmount,
              ).length
            }{' '}
            invoices with outstanding balances
          </small>
          <span className="finance-metric-track">
            <i
              className="finance-track-amber"
              style={{ width: pendingTotal > 0 ? '54%' : '0%' }}
            />
          </span>
        </article>
        <article className="reference-metric-card">
          <div className="admin-metric-heading">
            <span className="reference-metric-icon">
              <ArrowUpRight size={16} aria-hidden="true" />
            </span>
            <span className="reference-metric-label">Overdue</span>
            <span className="finance-metric-dot finance-dot-red" />
          </div>
          <strong>{currency(overdueTotal)}</strong>
          <small>
            {invoices.filter((invoice) => invoice.status === 'overdue').length}{' '}
            invoices need follow-up
          </small>
          <span className="finance-metric-track">
            <i
              className="finance-track-red"
              style={{ width: overdueTotal > 0 ? '36%' : '0%' }}
            />
          </span>
        </article>
        <article className="reference-metric-card">
          <div className="admin-metric-heading">
            <span className="reference-metric-icon">
              <Banknote size={16} aria-hidden="true" />
            </span>
            <span className="reference-metric-label">Expenses</span>
          </div>
          <strong>{currency(expenseTotal)}</strong>
          <small>Net collection {currency(netTotal)}</small>
          <span className="finance-expense-breakdown">
            Across {expenses.length} recorded expenses
          </span>
        </article>
      </section>

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
          <option value="Create invoices">New invoice</option>
          <option value="Fee setup">Fee setup</option>
        </select>
      </label>
      <nav className="finance-tabs" aria-label="Finance sections">
        {tabs.map((item) => (
          <button
            aria-current={
              tab === item ||
              (tab === 'Create invoices' && item === 'Invoices') ||
              (tab === 'Fee setup' && item === 'Fee Collection')
                ? 'page'
                : undefined
            }
            className={`finance-tab${tab === item || (tab === 'Create invoices' && item === 'Invoices') || (tab === 'Fee setup' && item === 'Fee Collection') ? ' finance-tab-active' : ''}`}
            key={item}
            onClick={() => setTab(item)}
            type="button"
          >
            {item === 'Ledger (Laser)' ? 'Ledger (Laser)' : item}
            {item === 'All' && allTransactions.length > 0 && (
              <span className="finance-tab-count">
                {allTransactions.length}
              </span>
            )}
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

      {tab === 'All' && (
        <section
          className="finance-section finance-transactions-section"
          aria-label="All finance transactions"
        >
          <div className="finance-section-heading">
            <div>
              <h2>All transactions</h2>
              <p>
                Collections and expenses in one searchable financial register.
              </p>
            </div>
            <div className="finance-section-heading-actions">
              <span className="finance-result-count">
                {allTransactions.length} records
              </span>
              <Button
                disabled={!allTransactions.length}
                onClick={() => exportFinanceTransactions(allTransactions)}
                type="button"
                variant="quiet"
              >
                <Download size={14} aria-hidden="true" /> Export
              </Button>
            </div>
          </div>
          <div className="finance-reference-filters">
            <span className="finance-filter-label">FILTERS</span>
            <label>
              <span className="visually-hidden">Date range</span>
              <select
                className="finance-select"
                value={datePreset}
                onChange={(event) => {
                  const preset = event.target.value;
                  setDatePreset(preset);
                  const now = new Date();
                  if (preset === 'month') {
                    setDateFrom(monthStart());
                    setDateTo(monthEnd());
                  } else if (preset === 'lastMonth') {
                    const start = new Date(
                      now.getFullYear(),
                      now.getMonth() - 1,
                      1,
                    );
                    const end = new Date(now.getFullYear(), now.getMonth(), 0);
                    setDateFrom(start.toISOString().slice(0, 10));
                    setDateTo(end.toISOString().slice(0, 10));
                  } else if (preset === 'year') {
                    setDateFrom(`${now.getFullYear()}-01-01`);
                    setDateTo(`${now.getFullYear()}-12-31`);
                  } else {
                    setDateFrom('');
                    setDateTo('');
                  }
                }}
              >
                <option value="month">This month</option>
                <option value="lastMonth">Last month</option>
                <option value="year">This year</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <label>
              <span className="visually-hidden">Campus filter</span>
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
            </label>
            <label>
              <span className="visually-hidden">Class filter</span>
              <select
                className="finance-select"
                value={classFilter}
                onChange={(event) => setClassFilter(event.target.value)}
              >
                <option value="">All classes</option>
                {classes
                  .filter(
                    (item) => !campusFilter || item.campusId === campusFilter,
                  )
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              <span className="visually-hidden">Payment method filter</span>
              <select
                className="finance-select"
                value={methodFilter}
                onChange={(event) =>
                  setMethodFilter(event.target.value as PaymentMethod | '')
                }
              >
                <option value="">All methods</option>
                {Object.entries(paymentMethodLabels)
                  .filter(
                    ([value, label]) =>
                      /cash/i.test(value + ' ' + label) ||
                      /bank/i.test(value + ' ' + label) ||
                      /online|easypaisa|jazzcash|card|digital/i.test(
                        value + ' ' + label,
                      ),
                  )
                  .map(([value, label]) => (
                    <option key={value} value={value}>
                      {/online|easypaisa|jazzcash|card|digital/i.test(
                        value + ' ' + label,
                      )
                        ? 'Online'
                        : /bank/i.test(value + ' ' + label)
                          ? 'Bank'
                          : 'Cash'}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              <span className="visually-hidden">Status filter</span>
              <select
                className="finance-select"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as InvoiceStatus | '')
                }
              >
                <option value="">All status</option>
                <option value="paid">Paid</option>
                <option value="unpaid">Pending</option>
                <option value="overdue">Overdue</option>
                <option value="partial">Partial</option>
              </select>
            </label>
          </div>
          <div
            className="finance-selection-toolbar"
            role="toolbar"
            aria-label="Selected transaction actions"
          >
            <span>{selectedTransactionIds.length} selected</span>
            <Button
              disabled={!selectedTransactionIds.length || !canWrite}
              onClick={() => {
                const row = allTransactions.find(
                  (item) =>
                    selectedTransactionIds.includes(item.id) &&
                    item.kind === 'invoice' &&
                    item.invoice,
                );
                if (row?.invoice) openPayment(row.invoice);
                else
                  toast.showToast(
                    'Select an unpaid invoice to record payment.',
                    'info',
                  );
              }}
              type="button"
            >
              Mark paid
            </Button>
            <Button
              disabled={!selectedTransactionIds.length}
              onClick={() => {
                const rows = allTransactions.filter(
                  (item) =>
                    selectedTransactionIds.includes(item.id) &&
                    item.kind === 'invoice' &&
                    item.invoice,
                );
                if (!rows.length) {
                  toast.showToast(
                    'Select invoices with outstanding dues to send reminders.',
                    'info',
                  );
                  return;
                }
                rows.forEach((row) => handleInvoiceReminder(row.invoice!));
              }}
              type="button"
              variant="quiet"
            >
              Send reminder
            </Button>
          </div>
          <div className="finance-premium-table-wrap">
            <table className="finance-premium-table">
              <thead>
                <tr>
                  <th>
                    <input
                      aria-label="Select all transactions"
                      type="checkbox"
                      checked={
                        filteredTransactions.length > 0 &&
                        filteredTransactions.every((row) =>
                          selectedTransactionIds.includes(row.id),
                        )
                      }
                      onChange={(event) =>
                        setSelectedTransactionIds(
                          event.target.checked
                            ? filteredTransactions.map((row) => row.id)
                            : [],
                        )
                      }
                    />
                  </th>
                  <th>Date</th>
                  <th>Student</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th>Method</th>
                  <th className="is-number">Amount</th>
                  <th>Status</th>
                  <th>Receipt</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        aria-label={'Select ' + row.description}
                        type="checkbox"
                        checked={selectedTransactionIds.includes(row.id)}
                        onChange={(event) =>
                          setSelectedTransactionIds((current) =>
                            event.target.checked
                              ? [...current, row.id]
                              : current.filter((id) => id !== row.id),
                          )
                        }
                      />
                    </td>
                    <td>{shortDate(row.date)}</td>
                    <td>
                      <strong>{row.description}</strong>
                      {row.kind === 'payment' && row.payment ? (
                        <small>{className(row.payment.classId, classes)}</small>
                      ) : row.kind === 'invoice' && row.invoice ? (
                        <small>{className(row.invoice.classId, classes)}</small>
                      ) : null}
                    </td>
                    <td>{row.category}</td>
                    <td>
                      <span
                        className={
                          row.kind === 'payment'
                            ? 'finance-type-pill finance-type-income'
                            : row.kind === 'invoice'
                              ? 'finance-type-pill finance-type-invoice'
                              : 'finance-type-pill finance-type-expense'
                        }
                      >
                        {row.kind === 'expense' ? 'Expense' : row.type}
                      </span>
                    </td>
                    <td>{row.method}</td>
                    <td
                      className={
                        row.kind === 'expense'
                          ? 'is-number finance-negative-amount'
                          : row.kind === 'invoice'
                            ? 'is-number finance-due-amount'
                            : 'is-number finance-positive-amount'
                      }
                    >
                      {row.kind === 'expense'
                        ? '− '
                        : row.kind === 'payment'
                          ? '+ '
                          : ''}
                      {currency(Math.abs(row.amount))}
                    </td>
                    <td>
                      <span
                        className={
                          row.kind === 'payment'
                            ? 'finance-reference-status finance-status-paid'
                            : row.kind === 'expense'
                              ? 'finance-reference-status finance-status-recorded'
                              : row.status === 'Overdue'
                                ? 'finance-reference-status finance-status-overdue'
                                : row.status === 'Partial'
                                  ? 'finance-reference-status finance-status-partial'
                                  : 'finance-reference-status finance-status-pending'
                        }
                      >
                        <i />
                        {row.status}
                      </span>
                    </td>
                    <td className="finance-receipt-cell">
                      {row.kind === 'payment' && row.payment ? (
                        <Button
                          className="finance-receipt-button"
                          onClick={() => {
                            const invoice = allInvoices.find(
                              (item) => item.id === row.payment!.invoiceId,
                            );
                            if (invoice) {
                              setReceiptInvoice(invoice);
                              setReceiptPayment({
                                receiptNumber: row.payment!.receiptNumber,
                                amountPaid: row.payment!.amountPaid,
                                paymentMethod: row.payment!.paymentMethod,
                                paymentDate: row.payment!.paymentDate,
                              });
                            } else {
                              toast.showToast(
                                `Receipt ${row.payment!.receiptNumber} is recorded, but its invoice details are unavailable.`,
                                'info',
                              );
                            }
                          }}
                          type="button"
                          variant="quiet"
                        >
                          Receipt
                        </Button>
                      ) : (
                        <span className="finance-muted-action">?</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredTransactions.length && (
              <EmptyState
                title="No transactions found"
                description="Recorded payments and expenses will appear here. Try adjusting the date range or filters."
              />
            )}
          </div>
        </section>
      )}

      {tab === 'Fee Collection' && (
        <section className="finance-section" aria-label="Fee collection">
          <div className="finance-section-heading">
            <div>
              <h2>Fee collection</h2>
              <p>Review fee plans currently configured for your classes.</p>
            </div>
            <Button onClick={() => setTab('Fee setup')} type="button">
              <Plus size={14} aria-hidden="true" /> Fee setup
            </Button>
          </div>
          {feeStructures.length ? (
            <div className="finance-collection-grid">
              {feeStructures.map((structure) => {
                const total = structure.feeHeads
                  .filter((head) => !head.isOptional)
                  .reduce((sum, head) => sum + head.amount, 0);
                return (
                  <article
                    className="finance-collection-card"
                    key={structure.id}
                  >
                    <div className="finance-collection-card-top">
                      <span className="finance-collection-icon">
                        <WalletCards size={18} aria-hidden="true" />
                      </span>
                      <span className="finance-reference-status finance-status-recorded">
                        <i />
                        Configured
                      </span>
                    </div>
                    <h3>{structure.name}</h3>
                    <p>
                      {className(structure.classId, classes)} ·{' '}
                      {campusName(structure.campusId, campuses)}
                    </p>
                    <strong>{currency(total)}</strong>
                    <small>
                      {structure.feeHeads.length} fee heads ·{' '}
                      {yearName(structure.academicYearId, years)}
                    </small>
                    <div className="finance-collection-fee-heads">
                      {structure.feeHeads.map((head) => (
                        <span key={head.title}>
                          {head.title}
                          <b>
                            {currency(head.amount)}
                            {head.isOptional ? ' · Optional' : ''}
                          </b>
                        </span>
                      ))}
                    </div>
                    <Button
                      onClick={() => {
                        startEdit(structure);
                        setTab('Fee setup');
                      }}
                      type="button"
                      variant="quiet"
                    >
                      Edit fee structure
                    </Button>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No fee structures yet"
              description="Create a class fee structure to begin billing."
            />
          )}
        </section>
      )}

      {tab === 'Payments' && (
        <section className="finance-section" aria-label="Payment records">
          <div className="finance-section-heading">
            <div>
              <h2>Recent payments</h2>
              <p>
                Verified payment receipts recorded against student invoices.
              </p>
            </div>
            <span className="finance-result-count">
              {visiblePayments.length} payments
            </span>
          </div>
          <div className="finance-reference-filters">
            <span className="finance-filter-label">FILTERS</span>
            <label>
              <span className="visually-hidden">Campus filter</span>
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
            </label>
            <label>
              <span className="visually-hidden">Payment method filter</span>
              <select
                className="finance-select"
                value={methodFilter}
                onChange={(event) =>
                  setMethodFilter(event.target.value as PaymentMethod | '')
                }
              >
                <option value="">All methods</option>
                {Object.entries(paymentMethodLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="finance-premium-table-wrap">
            <table className="finance-premium-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Student</th>
                  <th>Invoice</th>
                  <th>Method</th>
                  <th>Receipt</th>
                  <th className="is-number">Amount</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {visiblePayments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{shortDate(payment.paymentDate)}</td>
                    <td>
                      <strong>{payment.studentName}</strong>
                      <small>
                        {className(payment.classId, classes)} ·{' '}
                        {campusName(payment.campusId, campuses)}
                      </small>
                    </td>
                    <td>{payment.invoiceNumber}</td>
                    <td>{paymentMethodLabels[payment.paymentMethod]}</td>
                    <td>{payment.receiptNumber}</td>
                    <td className="is-number finance-positive-amount">
                      {currency(payment.amountPaid)}
                    </td>
                    <td>
                      <Button
                        type="button"
                        variant="quiet"
                        onClick={() => {
                          const invoice = invoices.find(
                            (item) => item.id === payment.invoiceId,
                          );
                          if (invoice) {
                            setReceiptInvoice(invoice);
                            setReceiptPayment({
                              receiptNumber: payment.receiptNumber,
                              amountPaid: payment.amountPaid,
                              paymentMethod: payment.paymentMethod,
                              paymentDate: payment.paymentDate,
                            });
                          }
                        }}
                      >
                        View receipt
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visiblePayments.length && (
              <EmptyState
                title="No payments found"
                description="Payments recorded against invoices will appear here."
              />
            )}
          </div>
        </section>
      )}

      {tab === 'Expenses' && (
        <section className="finance-section" aria-label="Expense records">
          <div className="finance-section-heading">
            <div>
              <h2>Expenses</h2>
              <p>
                Track operating costs with date, category, method and supporting
                reference.
              </p>
            </div>
            <div className="finance-section-heading-actions">
              <span className="finance-result-count">
                {visibleExpenses.length} expenses
              </span>
              <Button
                disabled={!canWrite}
                onClick={() => {
                  setExpenseError('');
                  setExpenseCampusId(
                    campusFilter ||
                      (campuses.length === 1 ? campuses[0].id : ''),
                  );
                  setExpenseDialogOpen(true);
                }}
                type="button"
              >
                <Plus size={14} aria-hidden="true" /> Add expense
              </Button>
            </div>
          </div>
          <div className="finance-expense-category-heading">
            <div>
              <h3>Expense categories</h3>
              <p>Actual spending against your monthly category budgets.</p>
            </div>
            <Button
              disabled={!canWrite}
              onClick={() => openBudgetEditor('utilities')}
              type="button"
              variant="quiet"
            >
              <Plus size={13} aria-hidden="true" /> Set budget
            </Button>
          </div>
          <div
            className="finance-expense-category-grid"
            aria-label="Expense categories"
          >
            {expenseCategorySummary.map((category) => (
              <article
                className="finance-expense-category-card"
                key={category.value}
              >
                <div className="finance-expense-category-top">
                  <span>{category.label}</span>
                  <button
                    disabled={!canWrite}
                    onClick={() => openBudgetEditor(category.value)}
                    type="button"
                  >
                    {category.budget > 0 ? 'Edit budget' : '+ Set budget'}
                  </button>
                </div>
                <strong>{currency(category.total)}</strong>
                <div className="finance-expense-budget-row">
                  <small>Budget</small>
                  <b>
                    {category.budget > 0
                      ? currency(category.budget)
                      : 'Not set'}
                  </b>
                </div>
                <div className="finance-expense-budget-track">
                  <i
                    className={
                      category.percentage >= 100 ? 'is-over-budget' : ''
                    }
                    style={{ width: `${category.percentage}%` }}
                  />
                </div>
                <small>
                  {category.budget > 0
                    ? `${category.percentage}% of budget used · `
                    : ''}
                  {category.count} recorded{' '}
                  {category.count === 1 ? 'expense' : 'expenses'}
                </small>
              </article>
            ))}
          </div>
          <div className="finance-reference-filters">
            <span className="finance-filter-label">FILTERS</span>
            <label>
              <span className="visually-hidden">Expense category filter</span>
              <select
                className="finance-select"
                value={expenseCategoryFilter}
                onChange={(event) =>
                  setExpenseCategoryFilter(
                    event.target.value as ExpenseCategory | '',
                  )
                }
              >
                <option value="">All categories</option>
                {expenseCategories.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="visually-hidden">Campus filter</span>
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
            </label>
          </div>
          <div className="finance-premium-table-wrap">
            <table className="finance-premium-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Particulars</th>
                  <th>Category</th>
                  <th>Campus</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th className="is-number">Amount</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleExpenses.map((expense) => (
                  <tr key={expense.id}>
                    <td>{shortDate(expense.expenseDate)}</td>
                    <td>
                      <strong>{expense.description}</strong>
                    </td>
                    <td>
                      {expenseCategories.find(
                        (item) => item.value === expense.category,
                      )?.label ?? 'Other'}
                    </td>
                    <td>
                      {expense.campusId
                        ? campusName(expense.campusId, campuses)
                        : 'Organization-wide'}
                    </td>
                    <td>{paymentMethodLabels[expense.paymentMethod]}</td>
                    <td>{expense.reference || '—'}</td>
                    <td className="is-number finance-negative-amount">
                      {currency(expense.amount)}
                    </td>
                    <td>
                      <Button
                        disabled={!canWrite || deleteExpense.isPending}
                        onClick={() => void handleDeleteExpense(expense)}
                        type="button"
                        variant="quiet"
                      >
                        <Trash2 size={13} aria-hidden="true" /> Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visibleExpenses.length && (
              <EmptyState
                title="No expenses found"
                description="Use Add expense to record a real expense for this organization."
              />
            )}
          </div>
        </section>
      )}

      {tab === 'Ledger (Laser)' && (
        <section className="finance-section" aria-label="Financial ledger">
          <div className="finance-section-heading">
            <div>
              <h2>General ledger</h2>
              <p>
                Chronological cash movement from recorded fee payments and
                expenses.
              </p>
            </div>
            <div className="finance-section-heading-actions">
              <span className="finance-result-count">
                {ledgerRows.length} entries
              </span>
              <Button
                disabled={!ledgerRows.length}
                onClick={() => exportFinanceLedger(ledgerRows)}
                type="button"
                variant="quiet"
              >
                <Download size={14} aria-hidden="true" /> Export ledger
              </Button>
            </div>
          </div>
          <div className="finance-ledger-summary">
            <div>
              <span>Fee income</span>
              <strong>{currency(collectedTotal)}</strong>
            </div>
            <div>
              <span>Expenses</span>
              <strong>{currency(expenseTotal)}</strong>
            </div>
            <div>
              <span>Net cash movement</span>
              <strong>{currency(netTotal)}</strong>
            </div>
          </div>
          <div
            className="finance-ledger-account-filters"
            aria-label="Filter ledger account"
          >
            <span>Filter by account:</span>
            {(
              [
                'All Accounts',
                'Fee Income',
                'Expense',
                'Cash in Hand',
                'Bank',
              ] as const
            ).map((account) => (
              <button
                className={ledgerAccountFilter === account ? 'is-active' : ''}
                key={account}
                onClick={() => setLedgerAccountFilter(account)}
                type="button"
              >
                {account}
              </button>
            ))}
          </div>
          <div className="finance-premium-table-wrap">
            <table className="finance-premium-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Particulars</th>
                  <th>Voucher</th>
                  <th className="is-number">Debit / income</th>
                  <th className="is-number">Credit / expense</th>
                  <th className="is-number">Balance</th>
                </tr>
              </thead>
              <tbody>
                {ledgerRows.map((entry) => (
                  <tr key={entry.id}>
                    <td>{shortDate(entry.date)}</td>
                    <td>
                      <strong>{entry.description}</strong>
                    </td>
                    <td>{entry.reference}</td>
                    <td className="is-number finance-positive-amount">
                      {entry.debit ? currency(entry.debit) : '—'}
                    </td>
                    <td className="is-number finance-negative-amount">
                      {entry.credit ? currency(entry.credit) : '—'}
                    </td>
                    <td className="is-number">
                      <strong>{currency(entry.balance)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!ledgerRows.length && (
              <EmptyState
                title="Ledger is empty"
                description="Record a fee payment or expense to begin the general ledger."
              />
            )}
          </div>
        </section>
      )}

      {tab === 'Concessions' && (
        <section className="finance-section" aria-label="Fee concessions">
          <div className="finance-section-heading">
            <div>
              <h2>Fee concessions</h2>
              <p>
                Student discounts, scholarships and waivers currently stored for
                this organization.
              </p>
            </div>
            <Link
              className="finance-manage-concessions"
              to={`${roleBase}/organizations/${encodeURIComponent(organizationId)}/concessions`}
            >
              + Add concession
            </Link>
          </div>
          <div className="finance-concession-summary-grid">
            {concessionSummary.map((item) => (
              <article
                className="finance-concession-summary-card"
                key={item.type}
              >
                <span>{item.label}</span>
                <strong>{item.total}</strong>
                <small>{item.detail}</small>
              </article>
            ))}
          </div>
          <div className="finance-concession-cards">
            {visibleConcessions.map((concession) => (
              <article
                className="finance-concession-reference-card"
                key={concession.id}
              >
                <div className="finance-collection-card-top">
                  <span className="finance-collection-icon">
                    <BadgePercent size={17} aria-hidden="true" />
                  </span>
                  <span
                    className={
                      concession.isActive
                        ? 'finance-reference-status finance-status-paid'
                        : 'finance-reference-status finance-status-recorded'
                    }
                  >
                    <i />
                    {concession.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <h3>{concession.concessionType.replaceAll('_', ' ')}</h3>
                <p>{concession.studentName}</p>
                <strong>
                  {concession.discountType === 'percentage'
                    ? `${concession.discountValue}%`
                    : currency(concession.discountValue)}
                </strong>
                <small>
                  {concession.reason || 'No additional reason provided'}
                </small>
                <span className="finance-concession-date">
                  Updated {shortDate(concession.updatedAt)}
                </span>
              </article>
            ))}
          </div>
          {!visibleConcessions.length && (
            <EmptyState
              title="No concessions found"
              description="Create or manage a student concession to see it listed here."
            />
          )}
        </section>
      )}

      {tab === 'Invoices' && (
        <section className="finance-section" aria-label="Invoices and billing">
          <div className="finance-section-heading">
            <div>
              <h2>Invoices</h2>
              <p>
                Review student bills, outstanding balances, due dates and
                payment status.
              </p>
            </div>
            <div className="finance-section-heading-actions">
              <Button onClick={() => setTab('Create invoices')} type="button">
                <Plus size={14} aria-hidden="true" /> New invoice
              </Button>
              <Button
                disabled={!visibleInvoices.length}
                onClick={() =>
                  exportInvoiceResults(visibleInvoices, classes, campuses)
                }
                type="button"
                variant="quiet"
              >
                <Download size={14} aria-hidden="true" /> Export
              </Button>
              <span className="finance-result-count">
                {visibleInvoices.length} invoices
              </span>
            </div>
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
                    (item) => !campusFilter || item.campusId === campusFilter,
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
          </div>
          <details className="finance-advanced-filters">
            <summary>More filters</summary>
            <div className="finance-advanced-filter-grid">
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
          </details>
          {finance.invoices.isFetching && (
            <div className="finance-refresh-indicator" role="status">
              <span className="finance-refresh-spinner" aria-hidden="true" />
              Updating invoices…
            </div>
          )}
          <div className="finance-invoices-table">
            <DataTable
              caption="Student invoices"
              rows={visibleInvoices}
              rowKey={(row) => row.id}
              emptyTitle="No invoices match these filters"
              emptyDescription="Generate a billing cycle or adjust your filters."
              columns={[
                {
                  header: 'Student / invoice',
                  render: (row) => (
                    <div>
                      <strong>{row.studentName}</strong>
                      <span className="finance-cell-secondary">
                        {row.invoiceNumber}
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
                    const remaining = Math.max(
                      0,
                      row.totalAmount - row.paidAmount,
                    );
                    const hasDiscount = Boolean(
                      row.discountAmount && row.discountAmount > 0,
                    );
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
                              style={{
                                textDecoration: 'line-through',
                                opacity: 0.75,
                              }}
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
                          {remaining > 0
                            ? ` · Due ${amountText(remaining)}`
                            : ''}
                        </span>
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
                    <div className="finance-invoice-row-actions">
                      <Button
                        disabled={!canWrite || row.status === 'paid'}
                        onClick={() => openPayment(row)}
                      >
                        Record payment
                      </Button>
                      <Button
                        variant="quiet"
                        onClick={() => openInvoiceReceipt(row)}
                      >
                        Receipt
                      </Button>
                      <Button
                        variant="quiet"
                        onClick={() => openInvoiceReceipt(row)}
                        title="Open printable receipt / PDF view"
                      >
                        PDF
                      </Button>
                      <Button
                        disabled={!row.guardianPhone || row.status === 'paid'}
                        variant="quiet"
                        onClick={() => handleInvoiceReminder(row)}
                      >
                        Remind
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
                        </>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </div>
          <div className="finance-invoice-cards">
            {visibleInvoices.length ? (
              visibleInvoices.map((invoice) => (
                <article className="finance-invoice-card" key={invoice.id}>
                  <header className="finance-invoice-card-header">
                    <div>
                      <span className="finance-card-label">Student</span>
                      <h3>{invoice.studentName}</h3>
                      <p>{invoice.invoiceNumber}</p>
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
                  <div className="finance-invoice-card-actions">
                    <Button
                      className="finance-card-payment-button"
                      disabled={!canWrite || invoice.status === 'paid'}
                      onClick={() => openPayment(invoice)}
                    >
                      Record Payment
                    </Button>
                    <Button
                      variant="quiet"
                      onClick={() => openInvoiceReceipt(invoice)}
                    >
                      Receipt
                    </Button>
                    <Button
                      variant="quiet"
                      onClick={() => openInvoiceReceipt(invoice)}
                      title="Open printable receipt / PDF view"
                    >
                      PDF
                    </Button>
                    <Button
                      disabled={
                        !invoice.guardianPhone || invoice.status === 'paid'
                      }
                      variant="quiet"
                      onClick={() => handleInvoiceReminder(invoice)}
                    >
                      Remind
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

      {tab === 'Create invoices' && (
        <section className="finance-section finance-form-section">
          <div className="finance-section-heading">
            <div>
              <h2>Generate class invoices</h2>
              <p>
                Create one invoice for each active student assigned to the
                selected class and academic year.
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

      {tab === 'Fee setup' && (
        <div className="finance-structure-layout">
          <section className="finance-section finance-form-section">
            <div className="finance-section-heading">
              <div>
                <h2>
                  {editingFeeId ? 'Edit fee structure' : 'Create fee structure'}
                </h2>
                <p>
                  Define required and optional fee heads for a class and year.
                </p>
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
                    onChange={(event) =>
                      setStructureClassId(event.target.value)
                    }
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
                                      isOptional:
                                        event.target.value === 'optional',
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
                            current.filter(
                              (_, itemIndex) => itemIndex !== index,
                            ),
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
                  <article
                    className="finance-structure-item"
                    key={structure.id}
                  >
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
        open={budgetDialogOpen}
        title="Set expense budget"
        description="Budgets are saved by organization, campus, category and month."
        onOpenChange={(open) => {
          setBudgetDialogOpen(open);
          if (!open) setBudgetError('');
        }}
      >
        <form className="finance-dialog-form" onSubmit={submitExpenseBudget}>
          <div className="finance-form-grid">
            <FinanceField label="Expense category">
              <select
                className="finance-select"
                value={budgetCategory}
                onChange={(event) =>
                  setBudgetCategory(event.target.value as ExpenseCategory)
                }
              >
                {expenseCategories.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </FinanceField>
            <FinanceField label="Budget month">
              <input
                required
                type="month"
                value={budgetMonth}
                onChange={(event) => setBudgetMonth(event.target.value)}
              />
            </FinanceField>
            <FinanceField label="Budget amount (PKR)">
              <input
                min="0.01"
                required
                step="0.01"
                type="number"
                value={budgetAmount}
                onChange={(event) => setBudgetAmount(event.target.value)}
                placeholder="e.g. 50000"
              />
            </FinanceField>
            <FinanceField label="Campus">
              <select
                className="finance-select"
                value={budgetCampusId}
                onChange={(event) => setBudgetCampusId(event.target.value)}
              >
                {!access.data?.campusIds?.length && (
                  <option value="">Organization-wide</option>
                )}
                {campuses.map((campus) => (
                  <option key={campus.id} value={campus.id}>
                    {campus.name}
                  </option>
                ))}
              </select>
            </FinanceField>
          </div>
          {budgetError && (
            <p className="finance-form-error" role="alert">
              {budgetError}
            </p>
          )}
          <div className="finance-form-actions">
            <Button disabled={saveExpenseBudget.isPending} type="submit">
              {saveExpenseBudget.isPending ? 'Saving…' : 'Save budget'}
            </Button>
            <Button
              onClick={() => setBudgetDialogOpen(false)}
              type="button"
              variant="quiet"
            >
              Cancel
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={expenseDialogOpen}
        title="Add expense"
        description="Record a real organization expense. This entry will appear in the finance register and ledger."
        onOpenChange={(open) => {
          setExpenseDialogOpen(open);
          if (!open) setExpenseError('');
        }}
      >
        <form
          className="finance-dialog-form finance-expense-form"
          onSubmit={submitExpense}
        >
          <FinanceField label="Description">
            <input
              autoFocus
              maxLength={180}
              required
              value={expenseDescription}
              onChange={(event) => setExpenseDescription(event.target.value)}
              placeholder="e.g. Electricity bill — Main Campus"
            />
          </FinanceField>
          <div className="finance-form-grid">
            <FinanceField label="Category">
              <select
                className="finance-select"
                value={expenseCategory}
                onChange={(event) =>
                  setExpenseCategory(event.target.value as ExpenseCategory)
                }
              >
                {expenseCategories.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </FinanceField>
            <FinanceField label="Amount (PKR)">
              <input
                min="0.01"
                required
                step="0.01"
                type="number"
                value={expenseAmount}
                onChange={(event) => setExpenseAmount(event.target.value)}
                placeholder="0.00"
              />
            </FinanceField>
            <FinanceField label="Payment method">
              <select
                className="finance-select"
                value={expenseMethod}
                onChange={(event) =>
                  setExpenseMethod(event.target.value as PaymentMethod)
                }
              >
                {Object.entries(paymentMethodLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FinanceField>
            <FinanceField label="Expense date">
              <input
                max={today()}
                required
                type="date"
                value={expenseDate}
                onChange={(event) => setExpenseDate(event.target.value)}
              />
            </FinanceField>
            <FinanceField label="Campus">
              <select
                className="finance-select"
                value={expenseCampusId}
                onChange={(event) => setExpenseCampusId(event.target.value)}
              >
                {!access.data?.campusIds?.length && (
                  <option value="">Organization-wide</option>
                )}
                {campuses.map((campus) => (
                  <option key={campus.id} value={campus.id}>
                    {campus.name}
                  </option>
                ))}
              </select>
            </FinanceField>
            <FinanceField label="Reference (optional)">
              <input
                maxLength={160}
                value={expenseReference}
                onChange={(event) => setExpenseReference(event.target.value)}
                placeholder="Voucher or transaction ID"
              />
            </FinanceField>
          </div>
          {expenseError && (
            <p className="finance-form-error" role="alert">
              {expenseError}
            </p>
          )}
          <div className="finance-form-actions">
            <Button disabled={createExpense.isPending} type="submit">
              {createExpense.isPending ? 'Saving…' : 'Save expense'}
            </Button>
            <Button
              onClick={() => setExpenseDialogOpen(false)}
              type="button"
              variant="quiet"
            >
              Cancel
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog
        open={Boolean(paymentInvoice) || globalPaymentOpen}
        title={globalPaymentOpen ? 'Record payment' : 'Record invoice payment'}
        description={
          paymentInvoice
            ? `${paymentInvoice.invoiceNumber} · ${paymentInvoice.studentName} · remaining balance ${amountText(paymentInvoice.totalAmount - paymentInvoice.paidAmount)}`
            : undefined
        }
        onOpenChange={(open) => {
          if (!open) {
            setPaymentInvoice(null);
            setGlobalPaymentOpen(false);
          }
        }}
      >
        {paymentInvoice && (
          <form className="finance-dialog-form" onSubmit={submitPayment}>
            {globalPaymentOpen && (
              <FinanceField label="Invoice / student">
                <select
                  className="finance-select"
                  value={paymentInvoice.id}
                  onChange={(event) => {
                    const selected = allInvoices.find(
                      (invoice) => invoice.id === event.target.value,
                    );
                    if (selected) {
                      setPaymentInvoice(selected);
                      setPaymentAmount(
                        amountText(selected.totalAmount - selected.paidAmount),
                      );
                    }
                  }}
                >
                  {allInvoices
                    .filter(
                      (invoice) =>
                        invoice.totalAmount > invoice.paidAmount &&
                        invoice.status !== 'paid',
                    )
                    .map((invoice) => (
                      <option key={invoice.id} value={invoice.id}>
                        {invoice.studentName} · {invoice.invoiceNumber} · Due{' '}
                        {currency(invoice.totalAmount - invoice.paidAmount)}
                      </option>
                    ))}
                </select>
              </FinanceField>
            )}
            <FinanceField label="Amount paid">
              <input
                autoFocus
                min="0.01"
                max={amountText(
                  paymentInvoice.totalAmount - paymentInvoice.paidAmount,
                )}
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
                onClick={() => {
                  setPaymentInvoice(null);
                  setGlobalPaymentOpen(false);
                }}
                type="button"
                variant="quiet"
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
        title={receiptPayment ? 'Payment receipt' : 'Fee statement'}
        description={
          receiptInvoice
            ? receiptPayment
              ? `Receipt ${receiptPayment.receiptNumber} · ${receiptInvoice.studentName} · received Rs. ${amountText(receiptPayment.amountPaid)}`
              : `Fee statement for ${receiptInvoice.studentName} (${receiptInvoice.invoiceNumber})`
            : undefined
        }
        onOpenChange={(open) => {
          if (!open) {
            setReceiptInvoice(null);
            setReceiptPayment(null);
          }
        }}
      >
        {receiptInvoice && (
          <div className="finance-receipt-dialog">
            <div className="finance-receipt-card" id="printable-fee-receipt">
              <div className="finance-receipt-header">
                <h3>
                  InstituteOS{' '}
                  {receiptPayment ? 'Payment Receipt' : 'Fee Statement'}
                </h3>
                <span className="finance-receipt-tag">
                  {statusLabels[receiptInvoice.status]}
                </span>
              </div>
              <hr style={{ margin: '0.75rem 0', opacity: 0.2 }} />
              <div className="finance-receipt-meta">
                <div>
                  <strong>Invoice:</strong> {receiptInvoice.invoiceNumber}
                </div>
                {receiptPayment && (
                  <>
                    <div>
                      <strong>Receipt:</strong> {receiptPayment.receiptNumber}
                    </div>
                    <div>
                      <strong>Payment date:</strong>{' '}
                      {new Date(
                        receiptPayment.paymentDate,
                      ).toLocaleDateString()}
                    </div>
                    <div>
                      <strong>Method:</strong>{' '}
                      {receiptPayment.paymentMethod.replace('_', ' ')}
                    </div>
                  </>
                )}
                <div>
                  <strong>Student:</strong> {receiptInvoice.studentName}
                </div>
                <div>
                  <strong>Class:</strong>{' '}
                  {className(receiptInvoice.classId, classes)}
                </div>
                <div>
                  <strong>Cycle:</strong> {receiptInvoice.billingCycle}
                </div>
                <div>
                  <strong>Due Date:</strong>{' '}
                  {new Date(receiptInvoice.dueDate).toLocaleDateString()}
                </div>
              </div>
              <hr style={{ margin: '0.75rem 0', opacity: 0.2 }} />
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  marginTop: '0.5rem',
                }}
              >
                <tbody>
                  {receiptInvoice.discountAmount &&
                  receiptInvoice.discountAmount > 0 ? (
                    <>
                      <tr>
                        <td style={{ padding: '0.35rem 0', color: '#64748b' }}>
                          Base Fee:
                        </td>
                        <td style={{ textAlign: 'right', color: '#64748b' }}>
                          Rs.{' '}
                          {amountText(
                            receiptInvoice.currentAmount ??
                              receiptInvoice.totalAmount,
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '0.35rem 0', color: '#16a34a' }}>
                          Discount (
                          {receiptInvoice.discountReason || 'Concession'}):
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 'bold',
                            color: '#16a34a',
                          }}
                        >
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
                  {receiptPayment && (
                    <tr>
                      <td style={{ padding: '0.35rem 0', color: '#10b981' }}>
                        This payment:
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: 'bold',
                          color: '#10b981',
                        }}
                      >
                        Rs. {amountText(receiptPayment.amountPaid)}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td style={{ padding: '0.35rem 0', color: '#10b981' }}>
                      Total paid:
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        fontWeight: 'bold',
                        color: '#10b981',
                      }}
                    >
                      Rs. {amountText(receiptInvoice.paidAmount)}
                    </td>
                  </tr>
                  <tr style={{ borderTop: '1px dashed #cbd5e1' }}>
                    <td
                      style={{
                        padding: '0.5rem 0',
                        fontWeight: 'bold',
                        color: '#dc2626',
                      }}
                    >
                      Remaining Balance (Baqaya):
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        fontWeight: 'bold',
                        fontSize: '1.1rem',
                        color: '#dc2626',
                      }}
                    >
                      Rs.{' '}
                      {amountText(
                        receiptInvoice.totalAmount - receiptInvoice.paidAmount,
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div
                style={{
                  marginTop: '1.5rem',
                  fontSize: '0.8rem',
                  color: '#64748b',
                  textAlign: 'center',
                }}
              >
                Computer generated fee slip. Valid without manual signature.
              </div>
            </div>

            <div
              className="finance-form-actions"
              style={{ marginTop: '1.25rem' }}
            >
              <Button
                variant="primary"
                onClick={() =>
                  handlePrintReceipt(
                    receiptInvoice,
                    className(receiptInvoice.classId, classes),
                    receiptPayment ?? undefined,
                  )
                }
              >
                Print / Save as PDF
              </Button>
              <Button
                onClick={() => {
                  setReceiptInvoice(null);
                  setReceiptPayment(null);
                }}
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
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
          >
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
              <strong>Anti-Fraud Protection Active:</strong> Paid or partially
              paid invoices cannot be deleted by staff alone. An alert with the
              collected amount (
              <strong>Rs. {amountText(deletingInvoice.paidAmount)}</strong>)
              will be sent to the Institute Owner. The Owner should only share
              the OTP if this is a verified test or mistake entry.
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
                <Button onClick={() => setDeletingInvoice(null)} type="button">
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
