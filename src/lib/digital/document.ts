/**
 * The quotation document model.
 *
 * The preview, the Word download, the PDF and the printed copy are all rendered
 * from this one model, and the model is built only from the saved quotation row.
 * That is what guarantees the four outputs agree with each other and with the
 * record the administrator approved.
 */

import { formatPeso } from "@/lib/kmd/format";
import {
  SERVICES_CHECKLIST,
  type Quotation,
  type QuotationFee,
} from "@/lib/digital/types";

export const KMD_LOGO_URL =
  "https://cdn.enter.pro/visual_resources/100617780/eadf183afe7f40ee8b1303e459f216e7/2452f3f9.png";

export const COMPANY_NAME = "KMD DIGITAL SOLUTIONS";
export const COMPANY_ADDRESS = "Tiguma, Pagadian City";
export const DOCUMENT_TITLE = "DIGITAL SERVICES QUOTATION";
export const INTRO_TEXT =
  "Good day! Thank you for considering KMD Digital Solutions. Please review the proposed services, project requirements, and quotation below. Complete the blank fields and confirm the final scope and fees before signing.";

export interface DocumentField {
  label: string;
  value: string;
}

export interface DocumentLine {
  description: string;
  qty: string;
  amount: string;
}

export interface DocumentFee {
  kind: string;
  description: string;
  detail: string;
  amount: string;
  /** Set when the charge is an agreed percentage rather than a fixed amount. */
  percent: number | null;
  includedInTotal: boolean;
}

export interface QuotationDocument {
  clientName: string;
  fields: DocumentField[];
  checklist: Array<{ label: string; ticked: boolean }>;
  otherServices: string | null;
  requirementFields: DocumentField[];
  lines: DocumentLine[];
  additionalLines: DocumentLine[];
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  fees: DocumentFee[];
  includedFeesTotal: string;
  separateFeesTotal: string;
  separateAnnualTotal: string;
  separateMonthlyTotal: string;
  maintenanceLines: string[];
  paymentLines: string[];
  scopeText: string | null;
  deliverablesText: string | null;
  termsText: string | null;
  preparedBy: string;
}

function longDate(value: string | null): string {
  if (!value) return "";
  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (!year || !month || !day) return value;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-PH", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const valueOrBlank = (value: string | null): string => (value && value.trim().length > 0 ? value : "");

function feeDetail(fee: QuotationFee): string {
  if (fee.percent && fee.percent > 0) {
    return `${fee.percent}% ${fee.per ? `per ${fee.per.replace(/_/g, " ")}` : ""}`.trim();
  }
  if (fee.amount === null) return fee.per ? `per ${fee.per}` : "";
  return `${formatPeso(fee.amount)} ${fee.per ? `per ${fee.per}` : ""}`.trim();
}

function paymentLines(quotation: Quotation): string[] {
  const lines: string[] = [];

  if (quotation.paymentTermsMode === "project_50_50" && quotation.depositAmount !== null) {
    lines.push(
      `50% of the total contract price is payable upon signing the agreement: ${formatPeso(quotation.depositAmount)}. ` +
        `The remaining 50% is payable immediately after completion of the agreed website, dashboard, or system: ${formatPeso(quotation.balanceAmount ?? 0)}.`,
    );
    lines.push(
      "Completion means the agreed deliverables are ready and the included revisions are complete. Confirm the scope and completion criteria before signing. The schedule depends on timely receipt of the deposit, content, access, and client approvals.",
    );
  } else if (quotation.paymentTermsNote) {
    lines.push(quotation.paymentTermsNote);
  } else {
    // Training and ebook purchases do not carry the project 50/50 terms, and no
    // term is invented here: the administrator records the applicable one.
    lines.push(
      "Payment terms for this training or digital product purchase are confirmed by the administrator before payment.",
    );
  }

  lines.push(
    "Additional features or work outside the agreed scope require a separate written quotation and approval. " +
      "Optional maintenance covers only the services specified above. Third-party fees must be disclosed and approved before purchase.",
  );

  return lines;
}

export function buildQuotationDocument(quotation: Quotation): QuotationDocument {
  const selectedKeys = quotation.servicesRequested;
  const checklist = SERVICES_CHECKLIST.map((option) => ({
    label: option.label,
    ticked: option.offeringKeys.some((key) => selectedKeys.includes(key)),
  }));

  const mappedKeys = SERVICES_CHECKLIST.flatMap((option) => option.offeringKeys);
  const unmapped = quotation.servicesRequested.filter((key) => !mappedKeys.includes(key));
  const otherServices = unmapped.length > 0 ? unmapped.join(", ") : null;

  const lines = quotation.items.map((line) => ({
    description: line.description,
    qty: String(line.qty),
    amount: formatPeso(line.amount),
  }));

  const additionalLines = quotation.additionalWork.map((line) => ({
    description: line.description,
    qty: String(line.qty),
    amount: formatPeso(line.amount),
  }));

  const fees = quotation.optionalFees.map((fee) => ({
    kind: fee.kind,
    description: fee.description,
    detail: feeDetail(fee),
    amount:
      fee.percent && fee.percent > 0
        ? `${fee.percent}%`
        : fee.amount === null
          ? ""
          : formatPeso(fee.amount),
    percent: fee.percent,
    includedInTotal: fee.includedInTotal,
  }));

  const maintenanceLines: string[] = [];
  if (quotation.maintenanceMode === "co_partner_5_percent") {
    maintenanceLines.push(
      "Maintenance: Co-partner arrangement — 5% of the entry-pack amount for every qualifying entry-pack encoding. Shown separately from the project price and the annual fee.",
    );
    if (quotation.maintenanceNote) {
      maintenanceLines.push(`Agreed basis and qualifying encodings: ${quotation.maintenanceNote}`);
    }
  } else if (quotation.maintenanceMode === "client_monthly_50000") {
    maintenanceLines.push(
      "Maintenance: Client maintenance — ₱50,000 per month, billed to the client and shown separately from the project price and the annual fee.",
    );
    if (quotation.maintenanceNote) maintenanceLines.push(`Agreed basis: ${quotation.maintenanceNote}`);
  }

  return {
    clientName: quotation.clientName,
    fields: [
      { label: "Client or authorized requester", value: quotation.clientName },
      { label: "Client address", value: valueOrBlank(quotation.clientAddress) },
      { label: "Contact number", value: valueOrBlank(quotation.contactNumber) },
      { label: "Email", value: valueOrBlank(quotation.email) },
    ],
    checklist,
    otherServices,
    requirementFields: [
      { label: "Business name", value: valueOrBlank(quotation.businessName) },
      { label: "Services requested", value: selectedKeys.join(", ") },
      { label: "Project requirements", value: valueOrBlank(quotation.projectRequirements) },
      { label: "Agreed scope", value: valueOrBlank(quotation.scope) },
      { label: "Deliverables", value: valueOrBlank(quotation.deliverables) },
    ],
    lines,
    additionalLines,
    subtotal: formatPeso(quotation.subtotal),
    discount: formatPeso(quotation.discount),
    tax: formatPeso(quotation.taxAmount),
    total: formatPeso(quotation.totalContractPrice),
    fees,
    includedFeesTotal: formatPeso(quotation.includedFeesTotal),
    separateFeesTotal: formatPeso(quotation.separateFeesTotal),
    separateAnnualTotal: formatPeso(quotation.separateAnnualTotal),
    separateMonthlyTotal: formatPeso(quotation.separateMonthlyTotal),
    maintenanceLines,
    paymentLines: paymentLines(quotation),
    scopeText: quotation.scope,
    deliverablesText: quotation.deliverables,
    termsText: quotation.terms,
    preparedBy: quotation.preparedBy,
  };
}

export interface QuotationHeader {
  quotationNumber: string;
  dateText: string;
  validUntilText: string;
  targetCompletionText: string;
}

export function buildQuotationHeader(quotation: Quotation): QuotationHeader {
  return {
    quotationNumber: quotation.quotationNumber,
    dateText: longDate(quotation.quotationDate),
    validUntilText: longDate(quotation.validUntil),
    targetCompletionText: longDate(quotation.targetCompletion),
  };
}
