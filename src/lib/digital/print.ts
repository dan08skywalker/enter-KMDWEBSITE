/**
 * Print output for a saved quotation.
 *
 * The document is written into a hidden iframe and printed from there, so the
 * printed page carries the quotation alone — no application chrome, no dialog
 * styling, and A4 margins that the browser honours.
 */

import { buildQuotationDocument, buildQuotationHeader, COMPANY_ADDRESS, COMPANY_NAME, DOCUMENT_TITLE, INTRO_TEXT, KMD_LOGO_URL } from "@/lib/digital/document";
import type { Quotation } from "@/lib/digital/types";

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** The printable document as standalone HTML, from the saved quotation only. */
export function quotationPrintHtml(quotation: Quotation): string {
  const document = buildQuotationDocument(quotation);
  const header = buildQuotationHeader(quotation);

  const included = document.fees.filter((fee) => fee.includedInTotal);
  const separate = document.fees.filter(
    (fee) => !fee.includedInTotal && !(fee.percent && fee.percent > 0) && !fee.description.toLowerCase().includes("co-partner"),
  );
  const percentage = document.fees.filter((fee) => fee.percent && fee.percent > 0);

  const fieldRows = document.fields
    .map(
      (field) =>
        `<div class="field"><span class="label">${escapeHtml(field.label)}:</span><span class="value">${escapeHtml(field.value)}</span></div>`,
    )
    .join("");

  const checklist = document.checklist
    .map((option) => `<li>${option.ticked ? "\u2612" : "\u2610"} ${escapeHtml(option.label)}</li>`)
    .join("");

  const requirementRows = document.requirementFields
    .map(
      (field) =>
        `<div class="field"><span class="label">${escapeHtml(field.label)}</span><span class="value">${escapeHtml(field.value)}</span></div>`,
    )
    .join("");

  const lineRows = [
    ...document.lines,
    ...document.additionalLines.map((line) => ({ ...line, description: `Additional agreed work — ${line.description}` })),
  ]
    .map(
      (line) =>
        `<tr><td>${escapeHtml(line.description)}</td><td class="center">${escapeHtml(line.qty)}</td><td class="right">${escapeHtml(line.amount)}</td></tr>`,
    )
    .join("");

  const summaryRow = (label: string, value: string, emphasis = false) =>
    `<tr class="${emphasis ? "emphasis" : ""}"><td class="right" colspan="2">${escapeHtml(label)}</td><td class="right">${escapeHtml(value)}</td></tr>`;

  const feeList = [
    ...included.map((fee) => `<li><strong>Included in the contract price — ${escapeHtml(fee.description)}:</strong> ${escapeHtml(fee.detail)}</li>`),
    ...separate.map((fee) => `<li><strong>Billed separately — ${escapeHtml(fee.description)}:</strong> ${escapeHtml(fee.detail)}</li>`),
    ...percentage.map(
      (fee) =>
        `<li><strong>${escapeHtml(fee.description)}:</strong> ${escapeHtml(fee.detail)}, shown separately and not part of the total contract price.</li>`,
    ),
  ].join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(quotation.quotationNumber)} — ${escapeHtml(DOCUMENT_TITLE)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1e2933; font-size: 11px; line-height: 1.5; margin: 0; }
  header { text-align: center; border-bottom: 1px solid #bfcbd6; padding-bottom: 10px; }
  header img { width: 84px; height: 84px; object-fit: contain; }
  h1 { font-size: 17px; margin: 8px 0 2px; letter-spacing: 0.02em; }
  .company { font-weight: bold; font-size: 12px; margin: 4px 0 0; letter-spacing: 0.04em; }
  .address { color: #5a6b7b; font-size: 10px; margin: 0; }
  .reference { color: #5a6b7b; font-size: 10px; margin: 6px 0 0; }
  .intro { color: #5a6b7b; margin: 12px 0 0; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #bfcbd6; padding-bottom: 3px; margin: 18px 0 8px; }
  .field { display: flex; gap: 8px; border-bottom: 1px dotted #9fb0bf; padding: 2px 0; }
  .field .label { font-weight: 600; white-space: nowrap; }
  .field .value { flex: 1; white-space: pre-wrap; }
  ul { margin: 6px 0 0; padding-left: 0; list-style: none; }
  ul.checklist { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 16px; }
  li { margin-bottom: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 11px; }
  th, td { border: 1px solid #bfcbd6; padding: 4px 6px; vertical-align: top; }
  th { background: #f1f5f8; text-align: left; }
  td.center, th.center { text-align: center; }
  td.right, th.right { text-align: right; }
  tr.emphasis td { background: #f1f5f8; font-weight: bold; }
  .note { color: #5a6b7b; font-size: 10px; margin: 6px 0 0; }
  .signature { margin-top: 16px; }
  .signature p { margin: 0 0 14px; }
  .line { display: inline-block; min-width: 220px; border-bottom: 1px dotted #9fb0bf; }
  tr { page-break-inside: avoid; }
</style>
</head>
<body>
  <header>
    <img src="${KMD_LOGO_URL}" alt="" />
    <p class="company">${escapeHtml(COMPANY_NAME)}</p>
    <p class="address">${escapeHtml(COMPANY_ADDRESS)}</p>
    <h1>${escapeHtml(DOCUMENT_TITLE)}</h1>
    <p class="reference">
      Quotation no. ${escapeHtml(header.quotationNumber)} &middot; Date: ${escapeHtml(header.dateText)}${
        header.validUntilText ? ` &middot; Valid until: ${escapeHtml(header.validUntilText)}` : ""
      }${header.targetCompletionText ? ` &middot; Target completion: ${escapeHtml(header.targetCompletionText)}` : ""}
    </p>
  </header>

  <p class="intro">${escapeHtml(INTRO_TEXT)}</p>

  <h2>Client details</h2>
  ${fieldRows}

  <h2>Services Requested</h2>
  <p class="note">Select all that apply.</p>
  <ul class="checklist">${checklist}</ul>
  <div class="field"><span class="label">&#9744; Other</span><span class="value">${escapeHtml(document.otherServices ?? "")}</span></div>

  <h2>Business and project requirements</h2>
  ${requirementRows}

  <h2>Pricing and Acceptance &mdash; Project quotation</h2>
  <table>
    <thead><tr><th>Service or deliverable</th><th class="center" style="width:56px">Qty</th><th class="right" style="width:110px">Amount PHP</th></tr></thead>
    <tbody>
      ${lineRows}
      ${summaryRow("Subtotal", document.subtotal)}
      ${summaryRow("Discount if applicable", document.discount)}
      ${summaryRow("Applicable taxes if any", document.tax)}
      ${quotation.includedFeesTotal > 0 ? summaryRow("Recurring charges included in the contract price", document.includedFeesTotal) : ""}
      ${summaryRow("TOTAL CONTRACT PRICE", document.total, true)}
    </tbody>
  </table>
  <p class="note">Recurring domain, hosting and maintenance charges are either included in the total contract price, as flagged below, or billed separately. They are never counted twice.</p>

  <h2>Optional maintenance and hosting</h2>
  ${feeList.length > 0 ? `<ul>${feeList}</ul>` : `<p class="note">No recurring charge is recorded on this quotation.</p>`}
  <p class="note">Billed separately: ${escapeHtml(document.separateFeesTotal)} &middot; per year: ${escapeHtml(document.separateAnnualTotal)} &middot; per month: ${escapeHtml(document.separateMonthlyTotal)}</p>
  ${document.maintenanceLines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
  <p class="note">Recurring fees are separate unless expressly included above. Record the selected provider, account ownership, and renewal arrangements before project handover.</p>

  <h2>Payment and project terms</h2>
  ${document.paymentLines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
  ${document.termsText ? `<p class="note">${escapeHtml(document.termsText)}</p>` : ""}

  <h2>Acceptance</h2>
  <p>By signing, both parties confirm the scope, total contract price, selected options, and payment terms recorded in this quotation.</p>
  <div class="signature">
    <p>Prepared by: <strong>${escapeHtml(document.preparedBy)}</strong> &nbsp;&nbsp; Signature <span class="line"></span></p>
    <p>Client name <span class="line"></span> &nbsp;&nbsp; Signature <span class="line"></span></p>
    <p>Date <span class="line"></span></p>
  </div>
</body>
</html>`;
}

/** Prints the quotation through a hidden iframe, which no popup blocker blocks. */
export function printQuotation(quotation: Quotation): void {
  const frame = globalThis.document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  globalThis.document.body.appendChild(frame);

  const frameDocument = frame.contentWindow?.document;
  if (!frameDocument) {
    console.error("Could not open a print frame for the quotation");
    frame.remove();
    return;
  }

  frameDocument.open();
  frameDocument.write(quotationPrintHtml(quotation));
  frameDocument.close();

  const run = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    globalThis.setTimeout(() => frame.remove(), 1000);
  };

  // Give the logo a moment to load so it appears on the printed page.
  if (frame.contentWindow) {
    frame.contentWindow.onload = run;
    globalThis.setTimeout(run, 1200);
  }
}
