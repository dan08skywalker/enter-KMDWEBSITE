/**
 * Word output for a saved quotation.
 *
 * The file is a real, editable .docx built with the same structure as the
 * supplied KMD Digital Solutions template: the KMD logo lock-up and address at
 * the top, the quotation reference block, the client details, the services
 * checklist, the project requirements, the pricing table, the recurring fees,
 * the payment terms and the acceptance block.
 *
 * Every value comes from the saved quotation, so the Word file cannot disagree
 * with the preview, the PDF or the printed copy.
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { buildQuotationDocument, buildQuotationHeader, COMPANY_ADDRESS, COMPANY_NAME, DOCUMENT_TITLE, INTRO_TEXT, KMD_LOGO_URL } from "@/lib/digital/document";
import type { Quotation } from "@/lib/digital/types";

type Alignment = (typeof AlignmentType)[keyof typeof AlignmentType];

const FONT = "Arial";
const MUTED = "5A6B7B";
const LINE_COLOR = "BFCBD6";
const HEADER_FILL = "F1F5F8";

async function loadLogo(): Promise<Uint8Array | null> {
  try {
    const response = await fetch(KMD_LOGO_URL, { mode: "cors" });
    if (!response.ok) return null;
    return new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    // A missing logo must never stop the quotation being delivered.
    console.error("Could not load the KMD logo for the Word document:", error);
    return null;
  }
}

function paragraph(text: string, options: { bold?: boolean; size?: number; color?: string; align?: Alignment; spaceAfter?: number } = {}) {
  return new Paragraph({
    alignment: options.align,
    spacing: { after: options.spaceAfter ?? 120 },
    children: [
      new TextRun({
        text,
        bold: options.bold,
        size: options.size ?? 20,
        color: options.color,
        font: FONT,
      }),
    ],
  });
}

function ruledLine(label: string, value: string) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [
      new TextRun({ text: `${label}: `, size: 20, font: FONT }),
      new TextRun({ text: value.length > 0 ? value : "_".repeat(70), size: 20, font: FONT }),
    ],
  });
}

function cell(text: string, options: { bold?: boolean; fill?: string; width?: number; align?: Alignment } = {}) {
  return new TableCell({
    width: options.width ? { size: options.width, type: WidthType.PERCENTAGE } : undefined,
    shading: options.fill ? { type: ShadingType.CLEAR, color: "auto", fill: options.fill } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [
      new Paragraph({
        alignment: options.align,
        children: [new TextRun({ text, bold: options.bold, size: 19, font: FONT })],
      }),
    ],
  });
}

const tableBorders = {
  top: { style: BorderStyle.SINGLE, size: 4, color: LINE_COLOR },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE_COLOR },
  left: { style: BorderStyle.SINGLE, size: 4, color: LINE_COLOR },
  right: { style: BorderStyle.SINGLE, size: 4, color: LINE_COLOR },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: LINE_COLOR },
  insideVertical: { style: BorderStyle.SINGLE, size: 4, color: LINE_COLOR },
};

function pricingTable(quotation: Quotation, document: ReturnType<typeof buildQuotationDocument>) {
  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        cell("Service or deliverable", { bold: true, fill: HEADER_FILL, width: 62 }),
        cell("Qty", { bold: true, fill: HEADER_FILL, width: 10, align: AlignmentType.CENTER }),
        cell("Amount PHP", { bold: true, fill: HEADER_FILL, width: 28, align: AlignmentType.RIGHT }),
      ],
    }),
  ];

  document.lines.forEach((line) => {
    rows.push(
      new TableRow({
        children: [
          cell(line.description, { width: 62 }),
          cell(line.qty, { width: 10, align: AlignmentType.CENTER }),
          cell(line.amount, { width: 28, align: AlignmentType.RIGHT }),
        ],
      }),
    );
  });

  document.additionalLines.forEach((line) => {
    rows.push(
      new TableRow({
        children: [
          cell(`Additional agreed work — ${line.description}`, { width: 62 }),
          cell(line.qty, { width: 10, align: AlignmentType.CENTER }),
          cell(line.amount, { width: 28, align: AlignmentType.RIGHT }),
        ],
      }),
    );
  });

  const summaryRow = (label: string, value: string, bold = false) =>
    new TableRow({
      children: [
        new TableCell({
          columnSpan: 2,
          shading: bold ? { type: ShadingType.CLEAR, color: "auto", fill: HEADER_FILL } : undefined,
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          children: [new Paragraph({ children: [new TextRun({ text: label, bold, size: 19, font: FONT })] })],
        }),
        new TableCell({
          shading: bold ? { type: ShadingType.CLEAR, color: "auto", fill: HEADER_FILL } : undefined,
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: value, bold, size: 19, font: FONT })],
            }),
          ],
        }),
      ],
    });

  rows.push(summaryRow("Subtotal", document.subtotal));
  rows.push(summaryRow("Discount if applicable", document.discount));
  rows.push(summaryRow("Applicable taxes if any", document.tax));
  if (quotation.includedFeesTotal > 0) {
    rows.push(summaryRow("Recurring charges included in the contract price", document.includedFeesTotal));
  }
  rows.push(summaryRow("TOTAL CONTRACT PRICE", document.total, true));

  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: tableBorders, rows });
}

export async function downloadQuotationDocx(quotation: Quotation): Promise<void> {
  const document = buildQuotationDocument(quotation);
  const header = buildQuotationHeader(quotation);
  const logo = await loadLogo();

  const children: Array<Paragraph | Table> = [];

  if (logo) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [new ImageRun({ type: "png", data: logo, transformation: { width: 96, height: 96 } })],
      }),
    );
  }

  children.push(
    paragraph(COMPANY_NAME, { bold: true, size: 26, align: AlignmentType.CENTER, spaceAfter: 40 }),
    paragraph(COMPANY_ADDRESS, { size: 18, color: MUTED, align: AlignmentType.CENTER, spaceAfter: 160 }),
    paragraph(DOCUMENT_TITLE, { bold: true, size: 30, align: AlignmentType.CENTER, spaceAfter: 120 }),
  );

  const referenceParts = [`Quotation no. ${header.quotationNumber}`, `Date: ${header.dateText}`];
  if (header.validUntilText) referenceParts.push(`Valid until: ${header.validUntilText}`);
  if (header.targetCompletionText) referenceParts.push(`Target completion: ${header.targetCompletionText}`);

  children.push(
    paragraph(referenceParts.join("   "), { size: 18, color: MUTED, spaceAfter: 160 }),
    paragraph(INTRO_TEXT, { size: 19, spaceAfter: 240 }),
    paragraph("Client details", { bold: true, size: 22, spaceAfter: 80 }),
  );

  document.fields.forEach((field) => children.push(ruledLine(field.label, field.value)));

  children.push(
    new Paragraph({ spacing: { before: 200, after: 80 }, children: [new TextRun({ text: "Services Requested", bold: true, size: 22, font: FONT })] }),
    paragraph("Select all that apply.", { size: 18, color: MUTED, spaceAfter: 80 }),
  );

  const ticked = document.checklist.map((option) => `${option.ticked ? "☒" : "☐"} ${option.label}`);
  for (let index = 0; index < ticked.length; index += 4) {
    children.push(paragraph(ticked.slice(index, index + 4).join("    "), { size: 19, spaceAfter: 60 }));
  }
  children.push(ruledLine("☐ Other", document.otherServices ?? ""));

  children.push(
    new Paragraph({ spacing: { before: 200, after: 80 }, children: [new TextRun({ text: "Business and project requirements", bold: true, size: 22, font: FONT })] }),
  );
  document.requirementFields.forEach((field) => children.push(ruledLine(field.label, field.value)));

  children.push(
    new Paragraph({ spacing: { before: 240, after: 120 }, children: [new TextRun({ text: "Pricing and Acceptance — Project quotation", bold: true, size: 22, font: FONT })] }),
    pricingTable(quotation, document),
    paragraph(
      "Recurring domain, hosting and maintenance charges are either included in the total contract price, as flagged above, or billed separately. They are never counted twice.",
      { size: 17, color: MUTED, spaceAfter: 240 },
    ),
  );

  const separate = document.fees.filter((fee) => !fee.includedInTotal && !fee.description.toLowerCase().includes("co-partner") && !(fee.percent && fee.percent > 0));
  const included = document.fees.filter((fee) => fee.includedInTotal);

  children.push(
    new Paragraph({ spacing: { before: 120, after: 80 }, children: [new TextRun({ text: "Optional maintenance and hosting", bold: true, size: 22, font: FONT })] }),
  );

  if (included.length > 0) {
    included.forEach((fee) => children.push(paragraph(`Included in the contract price — ${fee.description}: ${fee.detail}`, { size: 19 })));
  }
  if (separate.length > 0) {
    separate.forEach((fee) => children.push(paragraph(`Billed separately — ${fee.description}: ${fee.detail}`, { size: 19 })));
  }
  if (included.length === 0 && separate.length === 0) {
    children.push(paragraph("No recurring charge is recorded on this quotation.", { size: 19, color: MUTED }));
  }

  document.maintenanceLines.forEach((line) => children.push(paragraph(line, { size: 19 })));

  const recurringSummary = [
    `Billed separately: ${document.separateFeesTotal}`,
    document.separateAnnualTotal !== document.separateFeesTotal ? `of which per year: ${document.separateAnnualTotal}` : null,
    document.separateMonthlyTotal !== "₱0.00" ? `of which per month: ${document.separateMonthlyTotal}` : null,
  ]
    .filter((part): part is string => part !== null)
    .join("   ·   ");

  children.push(
    paragraph(recurringSummary, { size: 18, color: MUTED, spaceAfter: 80 }),
    paragraph(
      "Recurring fees are separate unless expressly included above. Record the selected provider, account ownership, and renewal arrangements before project handover.",
      { size: 17, color: MUTED, spaceAfter: 240 },
    ),
    new Paragraph({ spacing: { before: 120, after: 80 }, children: [new TextRun({ text: "Payment and project terms", bold: true, size: 22, font: FONT })] }),
  );

  document.paymentLines.forEach((line) => children.push(paragraph(line, { size: 19 })));

  if (document.termsText) {
    children.push(paragraph(document.termsText, { size: 18, color: MUTED }));
  }

  children.push(
    new Paragraph({ spacing: { before: 240, after: 80 }, children: [new TextRun({ text: "Acceptance", bold: true, size: 22, font: FONT })] }),
    paragraph(
      "By signing, both parties confirm the scope, total contract price, selected options, and payment terms recorded in this quotation.",
      { size: 19, spaceAfter: 240 },
    ),
    new Paragraph({
      spacing: { after: 240 },
      children: [
        new TextRun({ text: `Prepared by: ${document.preparedBy}`, size: 20, font: FONT }),
        new TextRun({ text: "        Signature __________________________", size: 20, font: FONT }),
      ],
    }),
    new Paragraph({
      spacing: { after: 240 },
      children: [
        new TextRun({ text: "Client name _______________________", size: 20, font: FONT }),
        new TextRun({ text: "        Signature ________________________", size: 20, font: FONT }),
      ],
    }),
    paragraph("Date ______________________________", { size: 20 }),
  );

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: FONT, size: 20 } },
      },
    },
    sections: [
      {
        properties: {
          page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const anchor = globalThis.document.createElement("a");
  anchor.href = url;
  anchor.download = `KMD-Quotation-${quotation.quotationNumber}.docx`;
  anchor.click();
  URL.revokeObjectURL(url);
}
