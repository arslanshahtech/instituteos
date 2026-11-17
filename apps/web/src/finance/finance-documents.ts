import type { PaymentMethod, StudentInvoice, FeeHead } from './finance-api.js';

type ReceiptPayment = {
  receiptNumber: string;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  transactionReference?: string;
};

const methodLabel: Record<PaymentMethod, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  card: 'Card',
  online: 'Online',
};

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });
}

function money(value: number): string {
  return `Rs. ${Number(value || 0).toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dateText(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-PK', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
}

function openPrintWindow(title: string, body: string, styles: string): void {
  const mobilePrint =
    window.matchMedia('(max-width: 768px)').matches ||
    window.matchMedia('(pointer: coarse)').matches ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (mobilePrint) {
    const preview = window.open('', '_blank');
    if (!preview) {
      window.alert('Please allow pop-ups to open the print preview.');
      return;
    }

    preview.document.open();
    preview.document.write(`<!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
          <meta name="color-scheme" content="light">
          <title>${escapeHtml(title)}</title>
          <style>
            ${styles}
            html, body { min-height:100%; }
            body { padding:16px; padding-top:78px; }
            .mobile-print-toolbar {
              position:fixed; z-index:10; top:0; left:0; right:0;
              display:flex; align-items:center; justify-content:space-between;
              gap:12px; padding:12px 14px; background:#172033; color:#fff;
              box-shadow:0 2px 12px rgba(0,0,0,.16);
              font:13px Arial, Helvetica, sans-serif;
            }
            .mobile-print-toolbar button {
              min-height:40px; border:0; border-radius:7px;
              padding:0 14px; background:#fff; color:#172033;
              font-size:13px; font-weight:700; cursor:pointer;
            }
            .mobile-print-toolbar span { font-size:11px; line-height:1.35; }
            @media print {
              body { padding:0 !important; }
              .mobile-print-toolbar { display:none !important; }
            }
          </style>
        </head>
        <body>
          <div class="mobile-print-toolbar">
            <span>Preview ready. Choose a printer or Save as PDF in print options.</span>
            <button id="mobile-print-action" type="button">Print / Save as PDF</button>
          </div>
          ${body}
        </body>
      </html>`);
    preview.document.close();
    preview.document
      .getElementById('mobile-print-action')
      ?.addEventListener('click', () => {
        preview.focus();
        preview.print();
      });
    return;
  }

  const frame = document.createElement('iframe');
  frame.setAttribute('title', title);
  Object.assign(frame.style, {
    position: 'fixed',
    width: '1px',
    height: '1px',
    right: '0',
    bottom: '0',
    border: '0',
    opacity: '0',
    pointerEvents: 'none',
  });
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title><style>${styles}</style></head><body>${body}</body></html>`,
  );
  doc.close();
  const cleanup = () => window.setTimeout(() => frame.remove(), 1200);
  frame.contentWindow?.addEventListener('afterprint', cleanup, { once: true });
  window.setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    cleanup();
  }, 350);
}

const sharedPrintStyles = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #172033; font-family: Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { size: A4 portrait; margin: 12mm; }
  .document { width: 100%; color: #172033; }
  .brand { font-size: 17px; font-weight: 700; letter-spacing: .02em; }
  .muted { color: #687386; }
  .eyebrow { font-size: 9px; letter-spacing: .16em; font-weight: 700; color: #667085; text-transform: uppercase; }
  .rule { border: 0; border-top: 1px solid #dce1e8; margin: 14px 0; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 9px 22px; }
  .field-label { display: block; color: #748094; font-size: 9px; letter-spacing: .07em; text-transform: uppercase; margin-bottom: 3px; }
  .field-value { font-size: 12px; font-weight: 600; overflow-wrap: anywhere; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { text-align: left; color: #697586; font-size: 9px; letter-spacing: .08em; text-transform: uppercase; padding: 7px 0; border-bottom: 1px solid #dce1e8; }
  td { padding: 7px 0; border-bottom: 1px solid #edf0f4; }
  .right { text-align: right; }
  .total-line { font-weight: 700; border-top: 1px solid #cbd3df; }
  .footer { color: #7a8494; font-size: 9px; text-align: center; margin-top: 20px; }
`;

export function printMinimalPaymentReceipt(
  invoice: StudentInvoice,
  classLabel: string,
  campusLabel: string,
  organizationName: string,
  payment: ReceiptPayment,
): void {
  const balance = Math.max(0, invoice.totalAmount - invoice.paidAmount);
  const body = `
    <main class="document receipt">
      <header class="receipt-head">
        <div><div class="brand">${escapeHtml(organizationName || 'InstituteOS')}</div><div class="muted small">Official fee collection receipt</div></div>
        <div class="eyebrow">Payment receipt</div>
      </header>
      <div class="receipt-number"><div><span class="field-label">Receipt number</span><strong>${escapeHtml(payment.receiptNumber)}</strong></div><div class="right"><span class="field-label">Payment date</span><strong>${escapeHtml(dateText(payment.paymentDate))}</strong></div></div>
      <hr class="rule">
      <div class="grid">
        <div><span class="field-label">Student</span><div class="field-value">${escapeHtml(invoice.studentName)}</div></div>
        <div><span class="field-label">Class / Section</span><div class="field-value">${escapeHtml(classLabel)}</div></div>
        <div><span class="field-label">Campus</span><div class="field-value">${escapeHtml(campusLabel)}</div></div>
        <div><span class="field-label">Challan / Invoice ref.</span><div class="field-value">${escapeHtml(invoice.invoiceNumber)}</div></div>
        <div><span class="field-label">Fee period</span><div class="field-value">${escapeHtml(invoice.billingCycle)}</div></div>
        <div><span class="field-label">Payment method</span><div class="field-value">${escapeHtml(methodLabel[payment.paymentMethod])}</div></div>
        ${payment.transactionReference ? `<div><span class="field-label">Transaction reference</span><div class="field-value">${escapeHtml(payment.transactionReference)}</div></div>` : ''}
      </div>
      <section class="received"><span class="field-label">Received this payment</span><strong>${money(payment.amountPaid)}</strong></section>
      <table class="summary">
        <tbody>
          <tr><td>Invoice / net fee</td><td class="right">${money(invoice.totalAmount)}</td></tr>
          <tr><td>Total paid to date</td><td class="right">${money(invoice.paidAmount)}</td></tr>
          <tr class="balance"><td>Current outstanding balance</td><td class="right">${money(balance)}</td></tr>
        </tbody>
      </table>
      <div class="signatures"><span>Received by</span><span>Authorized signature</span></div>
      <footer class="footer">Computer-generated receipt · Please retain for your records</footer>
    </main>`;
  const styles =
    sharedPrintStyles +
    `
    @page { size: A4 portrait; margin: 18mm; }
    .receipt { max-width: 174mm; margin: 0 auto; padding-top: 7mm; }
    .receipt-head { display:flex; align-items:flex-start; justify-content:space-between; border-top:3px solid #26364f; padding-top:12px; }
    .small { font-size:10px; margin-top:4px; }
    .receipt-number { display:flex; justify-content:space-between; align-items:end; margin-top:28px; padding:15px 0; border-top:1px solid #dce1e8; border-bottom:1px solid #dce1e8; }
    .receipt-number strong { font-size:16px; letter-spacing:.03em; }
    .receipt-number .right { text-align:right; }
    .received { margin:26px 0 20px; padding:18px 20px; background:#f5f7fa; border-left:3px solid #526985; }
    .received strong { display:block; font-size:29px; letter-spacing:-.04em; margin-top:5px; color:#1d2c42; }
    .summary { margin-top:16px; }
    .summary td { padding:10px 0; }
    .balance td { border-top:1px solid #cbd3df; font-weight:700; font-size:13px; color:#1d2c42; }
    .signatures { display:flex; justify-content:space-between; margin-top:62px; font-size:10px; color:#657084; }
    .signatures span { width:38%; border-top:1px solid #aeb7c4; padding-top:7px; }
    @media screen { body { padding:22px; } .receipt { max-width:760px; min-height:920px; padding:42px; border:1px solid #e1e5eb; box-shadow:0 18px 48px rgba(25,38,58,.12); border-radius:3px; } }
  `;
  openPrintWindow('Payment receipt ' + payment.receiptNumber, body, styles);
}

export function printFeeChallanBatch(
  records: {
    invoice: StudentInvoice;
    classLabel: string;
    campusLabel: string;
    feeHeads: FeeHead[];
  }[],
  organizationName: string,
  copies: 'single' | 'three',
): void {
  if (!records.length) return;
  const copyNames =
    copies === 'three'
      ? ['BANK COPY', 'INSTITUTE COPY', 'STUDENT COPY']
      : ['STUDENT COPY'];
  const body = records
    .map(({ invoice, classLabel, campusLabel, feeHeads }) => {
      const due = Math.max(0, invoice.totalAmount - invoice.paidAmount);
      const rows = (
        feeHeads.length
          ? feeHeads
          : [
              {
                title: invoice.feeStructureName,
                amount: invoice.currentAmount ?? invoice.totalAmount,
                isOptional: false,
              },
            ]
      )
        .map(
          (head) =>
            `<tr><td>${escapeHtml(head.title)}</td><td class="right">${money(head.amount)}</td></tr>`,
        )
        .join('');
      const copiesMarkup = copyNames
        .map(
          (copy, index) => `
      <section class="batch-copy ${index ? 'with-cut' : ''}">
        <header class="copy-head">
          <div><div class="brand">${escapeHtml(organizationName || 'InstituteOS')}</div><div class="eyebrow">Fee challan</div></div>
          <strong class="copy-label">${copy}</strong>
        </header>
        <div class="challan-meta"><span>Challan No. <b>${escapeHtml(invoice.invoiceNumber)}</b></span><span>Issue date <b>${escapeHtml(dateText(invoice.issueDate))}</b></span></div>
        <div class="grid">
          <div><span class="field-label">Student</span><div class="field-value">${escapeHtml(invoice.studentName)}</div></div>
          <div><span class="field-label">Class / Section</span><div class="field-value">${escapeHtml(classLabel)}</div></div>
          <div><span class="field-label">Campus</span><div class="field-value">${escapeHtml(campusLabel)}</div></div>
          <div><span class="field-label">Billing period</span><div class="field-value">${escapeHtml(invoice.billingCycle)}</div></div>
        </div>
        <table class="fee-table"><thead><tr><th>Fee description</th><th class="right">Amount</th></tr></thead><tbody>
          ${rows}
          ${invoice.discountAmount ? `<tr><td>Concession / discount</td><td class="right">− ${money(invoice.discountAmount)}</td></tr>` : ''}
          ${invoice.arrearsAmount ? `<tr><td>Previous arrears</td><td class="right">${money(invoice.arrearsAmount)}</td></tr>` : ''}
          <tr class="total-line"><td>Net fee</td><td class="right">${money(invoice.totalAmount)}</td></tr>
        </tbody></table>
        <div class="challan-bottom"><div><span class="field-label">${due === 0 ? 'Payment status' : 'Outstanding amount'}</span><strong>${due === 0 ? 'PAID — RECORD COPY' : money(due)}</strong><small>Due date: ${escapeHtml(dateText(invoice.dueDate))}</small></div>
          <div class="deposit-area">${copy === 'BANK COPY' ? 'Bank stamp / teller initials' : copy === 'INSTITUTE COPY' ? 'Received by / date' : 'Depositor signature'}<span></span></div>
        </div>
        <div class="payment-note">Deposit using the institute's officially shared payment instructions. Contact the institute if you need account details.</div>
      </section>`,
        )
        .join('');
      return `<main class="challan-sheet ${copies === 'three' ? 'three-copies' : 'single-copy'}">${copiesMarkup}</main>`;
    })
    .join('');
  const styles =
    sharedPrintStyles +
    `
    @page { size:A4 landscape; margin:7mm; }
    .challan-sheet { display:grid; grid-template-columns:1fr; gap:3mm; height:196mm; page-break-after:always; break-after:page; }
    .challan-sheet.three-copies { grid-template-columns:repeat(3,minmax(0,1fr)); }
    .challan-sheet:last-child { page-break-after:auto; break-after:auto; }
    .batch-copy { box-sizing:border-box; min-width:0; height:196mm; overflow:hidden; padding:3mm; }
    .batch-copy.with-cut { border-left:1px dashed #aab3c0; }
    .copy-head { display:flex; flex-direction:column; align-items:flex-start; gap:7px; border-bottom:1px solid #dce1e8; padding-bottom:8px; margin-bottom:10px; }
    .copy-head .brand { font-size:12px; }
    .copy-label { border:1px solid #9aa5b5; border-radius:3px; padding:4px 7px; font-size:8px; letter-spacing:.08em; }
    .eyebrow { margin-top:2px; font-size:7px; }
    .challan-meta { display:flex; flex-direction:column; gap:5px; font-size:8px; margin-bottom:12px; }
    .challan-meta b { margin-left:3px; }
    .grid { grid-template-columns:1fr; gap:9px; padding:9px 0; border-top:1px solid #edf0f4; border-bottom:1px solid #edf0f4; }
    .field-label { font-size:7px; margin-bottom:3px; }
    .field-value { font-size:9px; line-height:1.35; }
    .fee-table { margin-top:12px; font-size:8px; }
    .fee-table th { padding:6px 0; font-size:7px; }
    .fee-table td { padding:7px 0; }
    .challan-bottom { display:flex; flex-direction:column; align-items:stretch; gap:14px; margin-top:15px; padding-top:10px; border-top:1px solid #dce1e8; }
    .challan-bottom strong { display:block; font-size:15px; margin-top:4px; overflow-wrap:anywhere; }
    .challan-bottom small { display:block; font-size:8px; margin-top:5px; }
    .deposit-area { width:100%; color:#748094; font-size:8px; }
    .deposit-area span { display:block; height:24px; border-bottom:1px solid #aeb7c4; }
    .payment-note { font-size:7px; line-height:1.4; color:#748094; margin-top:12px; }

    @page compactChallan { size:A5 portrait; margin:7mm; }
    .challan-sheet.single-copy { page:compactChallan; display:block; width:100%; max-width:134mm; height:196mm; margin:0 auto; padding:0; }
    .challan-sheet.single-copy .challan-copy,
    .challan-sheet.single-copy .batch-copy { height:196mm; padding:5mm; border:1px solid #dce1e8; border-top:3px solid #26364f; border-radius:2mm; }
    .challan-sheet.single-copy .challan-copy.with-cut,
    .challan-sheet.single-copy .batch-copy.with-cut { border-left:1px solid #dce1e8; }
    .challan-sheet.single-copy .copy-head { flex-direction:row; justify-content:space-between; align-items:center; gap:8px; padding-bottom:5mm; margin-bottom:5mm; }
    .challan-sheet.single-copy .copy-head .brand { font-size:15px; }
    .challan-sheet.single-copy .eyebrow { font-size:8px; }
    .challan-sheet.single-copy .copy-label { padding:5px 8px; font-size:8px; background:#f5f7fa; }
    .challan-sheet.single-copy .challan-meta { flex-direction:row; justify-content:space-between; gap:8px; flex-wrap:wrap; font-size:8px; margin-bottom:6mm; }
    .challan-sheet.single-copy .grid { grid-template-columns:1fr 1fr; gap:5mm 8mm; padding:4mm 0; }
    .challan-sheet.single-copy .field-label { font-size:7px; }
    .challan-sheet.single-copy .field-value { font-size:9px; }
    .challan-sheet.single-copy .fee-table { margin-top:6mm; font-size:9px; }
    .challan-sheet.single-copy .fee-table th { padding:3mm 0; font-size:7px; }
    .challan-sheet.single-copy .fee-table td { padding:3mm 0; }
    .challan-sheet.single-copy .challan-bottom { flex-direction:row; justify-content:space-between; align-items:flex-end; gap:5mm; margin-top:7mm; padding:5mm 0 0; }
    .challan-sheet.single-copy .challan-bottom strong { font-size:17px; }
    .challan-sheet.single-copy .challan-bottom small { font-size:8px; }
    .challan-sheet.single-copy .deposit-area { width:42%; font-size:8px; }
    .challan-sheet.single-copy .deposit-area span { height:12mm; }
    .challan-sheet.single-copy .payment-note { margin-top:7mm; padding-top:3mm; border-top:1px solid #edf0f4; font-size:7px; }
  `;
  openPrintWindow(`Fee challans (${records.length})`, body, styles);
}

export function printFeeChallan(
  invoice: StudentInvoice,
  classLabel: string,
  campusLabel: string,
  organizationName: string,
  feeHeads: FeeHead[],
  copies: 'single' | 'three',
): void {
  const due = Math.max(0, invoice.totalAmount - invoice.paidAmount);
  const copyNames =
    copies === 'three'
      ? ['BANK COPY', 'INSTITUTE COPY', 'STUDENT COPY']
      : ['STUDENT COPY'];
  const rows = (
    feeHeads.length
      ? feeHeads
      : [
          {
            title: invoice.feeStructureName,
            amount: invoice.currentAmount ?? invoice.totalAmount,
            isOptional: false,
          },
        ]
  )
    .map(
      (head) =>
        `<tr><td>${escapeHtml(head.title)}</td><td class="right">${money(head.amount)}</td></tr>`,
    )
    .join('');
  const copyMarkup = copyNames
    .map(
      (copy, index) => `
    <section class="challan-copy ${index ? 'with-cut' : ''}">
      <header class="copy-head"><div><div class="brand">${escapeHtml(organizationName || 'InstituteOS')}</div><div class="eyebrow">Fee challan</div></div><strong class="copy-label">${copy}</strong></header>
      <div class="challan-meta"><span>Challan No. <b>${escapeHtml(invoice.invoiceNumber)}</b></span><span>Issue date <b>${escapeHtml(dateText(invoice.issueDate))}</b></span></div>
      <div class="grid">
        <div><span class="field-label">Student</span><div class="field-value">${escapeHtml(invoice.studentName)}</div></div>
        <div><span class="field-label">Class / Section</span><div class="field-value">${escapeHtml(classLabel)}</div></div>
        <div><span class="field-label">Campus</span><div class="field-value">${escapeHtml(campusLabel)}</div></div>
        <div><span class="field-label">Billing period</span><div class="field-value">${escapeHtml(invoice.billingCycle)}</div></div>
      </div>
      <table class="fee-table"><thead><tr><th>Fee description</th><th class="right">Amount</th></tr></thead><tbody>${rows}
        ${invoice.discountAmount ? `<tr><td>Concession / discount</td><td class="right">− ${money(invoice.discountAmount)}</td></tr>` : ''}
        ${invoice.arrearsAmount ? `<tr><td>Previous arrears</td><td class="right">${money(invoice.arrearsAmount)}</td></tr>` : ''}
        <tr class="total-line"><td>Net fee</td><td class="right">${money(invoice.totalAmount)}</td></tr>
      </tbody></table>
      <div class="challan-bottom"><div><span class="field-label">${due === 0 ? 'Payment status' : 'Outstanding amount'}</span><strong>${due === 0 ? 'PAID — RECORD COPY' : money(due)}</strong><small>Due date: ${escapeHtml(dateText(invoice.dueDate))}</small></div>
        <div class="deposit-area">${copy === 'BANK COPY' ? 'Bank stamp / teller initials' : copy === 'INSTITUTE COPY' ? 'Received by / date' : 'Depositor signature'}<span></span></div>
      </div>
      <div class="payment-note">Deposit using the institute's officially shared payment instructions. Contact the institute if you need account details.</div>
    </section>`,
    )
    .join('');
  const styles =
    sharedPrintStyles +
    `
    @page { size:A4 landscape; margin:7mm; }
    body { padding:0; }
    .challan-sheet { display:grid; grid-template-columns:1fr; gap:3mm; height:196mm; page-break-after:always; break-after:page; }
    .challan-sheet.three-copies { grid-template-columns:repeat(3,minmax(0,1fr)); }
    .challan-sheet:last-child { page-break-after:auto; break-after:auto; }
    .challan-copy { box-sizing:border-box; min-width:0; height:196mm; overflow:hidden; padding:3mm; position:relative; }
    .challan-copy.with-cut { border-left:1px dashed #aab3c0; }
    .copy-head { display:flex; flex-direction:column; align-items:flex-start; gap:7px; border-bottom:1px solid #dce1e8; padding-bottom:8px; margin-bottom:10px; }
    .copy-head .brand { font-size:12px; }
    .copy-label { border:1px solid #9aa5b5; border-radius:3px; padding:4px 7px; font-size:8px; letter-spacing:.08em; }
    .eyebrow { margin-top:2px; font-size:7px; }
    .challan-meta { display:flex; flex-direction:column; gap:5px; font-size:8px; margin-bottom:12px; }
    .challan-meta b { margin-left:3px; }
    .grid { grid-template-columns:1fr; gap:9px; padding:9px 0; border-top:1px solid #edf0f4; border-bottom:1px solid #edf0f4; }
    .field-label { font-size:7px; margin-bottom:3px; }
    .field-value { font-size:9px; line-height:1.35; }
    .fee-table { margin-top:12px; font-size:8px; }
    .fee-table th { padding:6px 0; font-size:7px; }
    .fee-table td { padding:7px 0; }
    .challan-bottom { display:flex; flex-direction:column; align-items:stretch; gap:14px; margin-top:15px; padding-top:10px; border-top:1px solid #dce1e8; }
    .challan-bottom strong { display:block; font-size:15px; margin-top:4px; overflow-wrap:anywhere; }
    .challan-bottom small { display:block; font-size:8px; margin-top:5px; }
    .deposit-area { width:100%; color:#748094; font-size:8px; }
    .deposit-area span { display:block; height:24px; border-bottom:1px solid #aeb7c4; }
    .payment-note { font-size:7px; line-height:1.4; color:#748094; margin-top:12px; }

    @page compactChallan { size:A5 portrait; margin:7mm; }
    .challan-sheet.single-copy { page:compactChallan; display:block; width:100%; max-width:134mm; height:196mm; margin:0 auto; padding:0; }
    .challan-sheet.single-copy .challan-copy,
    .challan-sheet.single-copy .batch-copy { height:196mm; padding:5mm; border:1px solid #dce1e8; border-top:3px solid #26364f; border-radius:2mm; }
    .challan-sheet.single-copy .challan-copy.with-cut,
    .challan-sheet.single-copy .batch-copy.with-cut { border-left:1px solid #dce1e8; }
    .challan-sheet.single-copy .copy-head { flex-direction:row; justify-content:space-between; align-items:center; gap:8px; padding-bottom:5mm; margin-bottom:5mm; }
    .challan-sheet.single-copy .copy-head .brand { font-size:15px; }
    .challan-sheet.single-copy .eyebrow { font-size:8px; }
    .challan-sheet.single-copy .copy-label { padding:5px 8px; font-size:8px; background:#f5f7fa; }
    .challan-sheet.single-copy .challan-meta { flex-direction:row; justify-content:space-between; gap:8px; flex-wrap:wrap; font-size:8px; margin-bottom:6mm; }
    .challan-sheet.single-copy .grid { grid-template-columns:1fr 1fr; gap:5mm 8mm; padding:4mm 0; }
    .challan-sheet.single-copy .field-label { font-size:7px; }
    .challan-sheet.single-copy .field-value { font-size:9px; }
    .challan-sheet.single-copy .fee-table { margin-top:6mm; font-size:9px; }
    .challan-sheet.single-copy .fee-table th { padding:3mm 0; font-size:7px; }
    .challan-sheet.single-copy .fee-table td { padding:3mm 0; }
    .challan-sheet.single-copy .challan-bottom { flex-direction:row; justify-content:space-between; align-items:flex-end; gap:5mm; margin-top:7mm; padding:5mm 0 0; }
    .challan-sheet.single-copy .challan-bottom strong { font-size:17px; }
    .challan-sheet.single-copy .challan-bottom small { font-size:8px; }
    .challan-sheet.single-copy .deposit-area { width:42%; font-size:8px; }
    .challan-sheet.single-copy .deposit-area span { height:12mm; }
    .challan-sheet.single-copy .payment-note { margin-top:7mm; padding-top:3mm; border-top:1px solid #edf0f4; font-size:7px; }
  `;
  openPrintWindow(
    'Fee challan ' + invoice.invoiceNumber,
    `<main class="challan-sheet ${copies === 'three' ? 'three-copies' : 'single-copy'}">${copyMarkup}</main>`,
    styles,
  );
}
