/**
 * PDF output for a saved quotation.
 *
 * Rendered from the same document model as the Word file and the preview, so all
 * three agree. Long descriptions wrap and long quotations flow onto extra pages
 * instead of being cut off.
 */

import { jsPDF } from "jspdf";
import {
  buildQuotationDocument,
  buildQuotationHeader,
  COMPANY_ADDRESS,
  COMPANY_NAME,
  DOCUMENT_TITLE,
  INTRO_TEXT,
  KMD_LOGO_URL,
} from "@/lib/digital/document";
import type { Quotation } from "@/lib/digital/types";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

async function loadLogo(): Promise<Uint8Array | null> {
  try {
    const response = await fetch(KMD_LOGO_URL, { mode: "cors" });
    if (!response.ok) return null;
    return new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    console.error("Could not load the KMD logo for the PDF:", error);
    return null;
  }
}

export async function downloadQuotationPdf(quotation: Quotation): Promise<void> {
  const model = buildQuotationDocument(quotation);
  const header = buildQuotationHeader(quotation);
  const logo = await loadLogo();

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let cursor = MARGIN;
  let page = 1;

  const ensure = (needed: number) => {
    if (cursor + needed <= PAGE_HEIGHT - MARGIN) return;
    doc.addPage();
    page += 1;
    cursor = MARGIN;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`${quotation.quotationNumber} · page ${page}`, MARGIN, PAGE_HEIGHT - 24);
  };

  const write = (
    value: string,
    options: { size?: number; bold?: boolean; color?: [number, number, number]; gap?: number; align?: "left" | "center" | "right" } = {},
  ) => {
    const size = options.size ?? 10;
    doc.setFont("helvetica", options.bold ? "bold" : "normal");
    doc.setFontSize(size);
    const color = options.color ?? [30, 41, 51];
    doc.setTextColor(color[0], color[1], color[2]);

    const lines = doc.splitTextToSize(value.length > 0 ? value : " ", CONTENT_WIDTH) as string[];
    const lineHeight = size * 1.35;
    ensure(lines.length * lineHeight + (options.gap ?? 4));

    lines.forEach((line) => {
      const x = options.align === "center" ? PAGE_WIDTH / 2 : options.align === "right" ? PAGE_WIDTH - MARGIN : MARGIN;
      doc.text(line, x, cursor, { align: options.align ?? "left" });
      cursor += lineHeight;
    });
    cursor += options.gap ?? 4;
  };

  const heading = (value: string) => {
    cursor += 8;
    write(value, { size: 12, bold: true, gap: 4 });
  };

  const rule = (label: string, value: string) => {
    write(`${label}: ${value.length > 0 ? value : "_".repeat(58)}`, { size: 10, gap: 2 });
  };

  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  doc.setFontSize(8);
  doc.text(`${quotation.quotationNumber} · page ${page}`, MARGIN, PAGE_HEIGHT - 24);

  if (logo) {
    try {
      const size = 72;
      doc.addImage(logo, "PNG", PAGE_WIDTH / 2 - size / 2, cursor, size, size);
      cursor += size + 8;
    } catch (error) {
      console.error("Could not place the KMD logo in the PDF:", error);
    }
  }

  write(COMPANY_NAME, { size: 14, bold: true, align: "center", gap: 2 });
  write(COMPANY_ADDRESS, { size: 9, color: [110, 122, 134], align: "center", gap: 8 });
  write(DOCUMENT_TITLE, { size: 16, bold: true, align: "center", gap: 10 });

  const reference = [
    `Quotation no. ${header.quotationNumber}`,
    `Date: ${header.dateText}`,
    header.validUntilText ? `Valid until: ${header.validUntilText}` : null,
    header.targetCompletionText ? `Target completion: ${header.targetCompletionText}` : null,
  ]
    .filter((part): part is string => part !== null)
    .join("   ");

  write(reference, { size: 9, color: [110, 122, 134], gap: 10 });
  write(INTRO_TEXT, { size: 9.5, gap: 10 });

  heading("Client details");
  model.fields.forEach((field) => rule(field.label, field.value));

  heading("Services Requested");
  write("Select all that apply.", { size: 9, color: [110, 122, 134], gap: 2 });
  model.checklist.forEach((option) => write(`${option.ticked ? "☒" : "☐"} ${option.label}`, { size: 10, gap: 1 }));
  rule("☐ Other", model.otherServices ?? "");

  heading("Business and project requirements");
  model.requirementFields.forEach((field) => rule(field.label, field.value));

  heading("Pricing and Acceptance — Project quotation");

  const columnX = [MARGIN, MARGIN + CONTENT_WIDTH * 0.7, PAGE_WIDTH - MARGIN];
  const tableRow = (left: string, qty: string, amount: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 51);

    const wrapped = doc.splitTextToSize(left, columnX[1] - columnX[0] - 6) as string[];
    const rowHeight = Math.max(14, wrapped.length * 12);

    ensure(rowHeight + 2);
    doc.setDrawColor(200, 210, 218);
    doc.line(MARGIN, cursor - 9, PAGE_WIDTH - MARGIN, cursor - 9);

    wrapped.forEach((line, index) => doc.text(line, columnX[0], cursor + index * 12));
    doc.text(qty, columnX[1] + 6, cursor, { align: "left" });
    doc.text(amount, columnX[2], cursor, { align: "right" });

    cursor += rowHeight;
  };

  tableRow("Service or deliverable", "Qty", "Amount PHP", true);
  model.lines.forEach((line) => tableRow(line.description, line.qty, line.amount));
  model.additionalLines.forEach((line) => tableRow(`Additional agreed work — ${line.description}`, line.qty, line.amount));

  cursor += 4;
  const summary = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 11 : 9.5);
    doc.setTextColor(30, 41, 51);
    ensure(18);
    doc.text(label, MARGIN, cursor);
    doc.text(value, PAGE_WIDTH - MARGIN, cursor, { align: "right" });
    cursor += bold ? 20 : 15;
  };

  summary("Subtotal", model.subtotal);
  summary("Discount if applicable", model.discount);
  summary("Applicable taxes if any", model.tax);
  if (quotation.includedFeesTotal > 0) {
    summary("Recurring charges included in the contract price", model.includedFeesTotal);
  }
  summary("TOTAL CONTRACT PRICE", model.total, true);

  write(
    "Recurring domain, hosting and maintenance charges are either included in the total contract price, as flagged below, or billed separately. They are never counted twice.",
    { size: 8.5, color: [110, 122, 134], gap: 10 },
  );

  heading("Optional maintenance and hosting");

  const separate = model.fees.filter(
    (fee) => !fee.includedInTotal && !(fee.percent && fee.percent > 0) && !fee.description.toLowerCase().includes("co-partner"),
  );
  const included = model.fees.filter((fee) => fee.includedInTotal);
  const percentage = model.fees.filter((fee) => fee.percent && fee.percent > 0);

  included.forEach((fee) => write(`Included in the contract price — ${fee.description}: ${fee.detail}`, { size: 9.5, gap: 2 }));
  separate.forEach((fee) => write(`Billed separately — ${fee.description}: ${fee.detail}`, { size: 9.5, gap: 2 }));
  percentage.forEach((fee) => write(`${fee.description} — ${fee.detail}, shown separately and not part of the total contract price.`, { size: 9.5, gap: 2 }));

  if (included.length === 0 && separate.length === 0 && percentage.length === 0) {
    write("No recurring charge is recorded on this quotation.", { size: 9.5, color: [110, 122, 134] });
  }

  if (quotation.separateFeesTotal > 0) {
    write(
      `Billed separately: ${model.separateFeesTotal}   ·   per year: ${model.separateAnnualTotal}   ·   per month: ${model.separateMonthlyTotal}`,
      { size: 9, color: [110, 122, 134] },
    );
  }

  model.maintenanceLines.forEach((line) => write(line, { size: 9.5, gap: 2 }));

  write(
    "Recurring fees are separate unless expressly included above. Record the selected provider, account ownership, and renewal arrangements before project handover.",
    { size: 8.5, color: [110, 122, 134], gap: 10 },
  );

  heading("Payment and project terms");
  model.paymentLines.forEach((line) => write(line, { size: 9.5, gap: 4 }));

  if (model.termsText) write(model.termsText, { size: 9, color: [110, 122, 134], gap: 6 });

  heading("Acceptance");
  write("By signing, both parties confirm the scope, total contract price, selected options, and payment terms recorded in this quotation.", {
    size: 9.5,
    gap: 12,
  });
  write(`Prepared by: ${model.preparedBy}        Signature __________________________`, { size: 10, gap: 14 });
  write("Client name _______________________        Signature ________________________", { size: 10, gap: 14 });
  write("Date ______________________________", { size: 10 });

  doc.save(`KMD-Quotation-${quotation.quotationNumber}.pdf`);
}
