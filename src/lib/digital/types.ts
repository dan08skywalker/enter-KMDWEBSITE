/**
 * KMD Digital Solutions — shared types and labels.
 *
 * An addition to the existing KMD Empire project: the digital listing catalogue,
 * the client request form and the quotation record. Nothing here is read by the
 * shop, the checkout or the reward engine, which is what keeps these offerings
 * out of Unilevel earnings and loyalty credits.
 */

import { formatPeso } from "@/lib/kmd/format";

export type OfferingGroup = "learning_package" | "service";
export type FeeOption = "none" | "optional" | "recurring";
export type PaymentTermsMode = "product_default" | "project_50_50";
export type MaintenanceMode = "none" | "co_partner_5_percent" | "client_monthly_50000";
export type RequestStatus = "submitted" | "in_review" | "quoted" | "closed" | "cancelled";
export type QuotationStatus = "draft" | "issued" | "accepted" | "void";

export interface MaintenanceOption {
  key: Exclude<MaintenanceMode, "none">;
  label: string;
  detail: string;
}

export interface DigitalOffering {
  id: string;
  offeringKey: string;
  offeringGroup: OfferingGroup;
  label: string;
  name: string;
  summary: string | null;
  description: string | null;
  inclusions: string[];
  price: number;
  promoPrice: number | null;
  regularPrice: number | null;
  annualFee: number | null;
  annualFeeLabel: string | null;
  annualFeeOption: FeeOption;
  maintenanceOptions: MaintenanceOption[];
  paymentTermsMode: PaymentTermsMode;
  paymentTermsNote: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface RequestItem {
  offeringKey: string;
  label: string;
  name: string;
  group: OfferingGroup;
  price: number;
  promoPrice: number | null;
  regularPrice: number | null;
  annualFee: number | null;
  annualFeeLabel: string | null;
  annualFeeOption: FeeOption;
  paymentTermsMode: PaymentTermsMode;
  inclusions: string[];
}

export interface ClientRequest {
  id: string;
  requestNumber: string;
  requestType: OfferingGroup;
  clientName: string;
  phone: string;
  email: string;
  businessName: string | null;
  clientAddress: string | null;
  learningGoals: string | null;
  productsServices: string | null;
  requiredFeatures: string | null;
  preferredDomain: string | null;
  designReferences: string | null;
  contentSupplied: string | null;
  attachmentPaths: string[];
  preferredCompletion: string | null;
  hostingPreference: string | null;
  maintenancePreference: string | null;
  maintenanceChoice: Exclude<MaintenanceMode, "none"> | null;
  items: RequestItem[];
  estimatedTotal: number;
  status: RequestStatus;
  adminNotes: string | null;
  submittedAt: string;
}

export interface QuotationLine {
  description: string;
  qty: number;
  amount: number;
}

export interface QuotationFee {
  kind: "maintenance" | "domain" | "hosting" | "other";
  description: string;
  amount: number | null;
  percent: number | null;
  per: string | null;
  includedInTotal: boolean;
}

export interface Quotation {
  id: string;
  quotationNumber: string;
  requestId: string | null;
  quotationDate: string;
  validUntil: string | null;
  targetCompletion: string | null;
  clientName: string;
  clientAddress: string | null;
  contactNumber: string | null;
  email: string | null;
  businessName: string | null;
  items: QuotationLine[];
  additionalWork: QuotationLine[];
  servicesRequested: string[];
  projectRequirements: string | null;
  scope: string | null;
  deliverables: string | null;
  subtotal: number;
  discount: number;
  taxAmount: number;
  includedFeesTotal: number;
  totalContractPrice: number;
  optionalFees: QuotationFee[];
  separateFeesTotal: number;
  separateAnnualTotal: number;
  separateMonthlyTotal: number;
  maintenanceMode: MaintenanceMode;
  maintenanceNote: string | null;
  paymentTermsMode: PaymentTermsMode;
  paymentTermsNote: string | null;
  depositAmount: number | null;
  balanceAmount: number | null;
  terms: string | null;
  preparedBy: string;
  status: QuotationStatus;
  createdAt: string;
  updatedAt: string;
}

/* ----------------------------------------------------------------- labels -- */

export const OFFERING_GROUP_LABEL: Record<OfferingGroup, string> = {
  learning_package: "Digital Products & AI Learning Packages",
  service: "Digital Services for Clients",
};

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  submitted: "Submitted",
  in_review: "In review",
  quoted: "Quoted",
  closed: "Closed",
  cancelled: "Cancelled",
};

export const QUOTATION_STATUS_LABEL: Record<QuotationStatus, string> = {
  draft: "Draft",
  issued: "Issued",
  accepted: "Accepted",
  void: "Void",
};

export const MAINTENANCE_MODE_LABEL: Record<MaintenanceMode, string> = {
  none: "No maintenance arrangement",
  co_partner_5_percent: "Co-partner — 5% of the entry-pack amount per qualifying encoding",
  client_monthly_50000: "Client maintenance — ₱50,000 per month",
};

/** The two MLM dashboard arrangements. Exactly one may be chosen, never both. */
export const MLM_MAINTENANCE_OPTIONS: MaintenanceOption[] = [
  {
    key: "co_partner_5_percent",
    label: "Co-partner arrangement",
    detail: "5% of the entry-pack amount for every qualifying entry-pack encoding.",
  },
  {
    key: "client_monthly_50000",
    label: "Client maintenance",
    detail: "₱50,000 per month, billed to the client.",
  },
];

/** Recurring-fee wording. Only the offering decides which charge applies. */
export const FEE_KIND_LABEL: Record<QuotationFee["kind"], string> = {
  maintenance: "Maintenance",
  domain: "Domain",
  hosting: "Hosting",
  other: "Other recurring cost",
};

/** The services checklist printed on the quotation, as the template lists them. */
export const SERVICES_CHECKLIST: Array<{ label: string; offeringKeys: string[] }> = [
  { label: "Landing page", offeringKeys: ["SVC-LANDING"] },
  { label: "Basic website", offeringKeys: [] },
  { label: "E-commerce ready website", offeringKeys: ["SVC-ECOM-1-2", "SVC-ECOM-5", "SVC-ECOM-10"] },
  { label: "AI creatives", offeringKeys: ["LEARN-A"] },
  { label: "Visual creatives", offeringKeys: [] },
  { label: "Business operations system dashboard", offeringKeys: ["SVC-DASHBOARD"] },
  { label: "MLM dashboard", offeringKeys: ["SVC-MLM-DASHBOARD"] },
];

export const PAYMENT_TERMS_LABEL: Record<PaymentTermsMode, string> = {
  product_default: "Product payment terms",
  project_50_50: "50% on signing, 50% after completion",
};

/* ------------------------------------------------------------ presentation -- */

/** The shop category the digital catalogue card and its listings live under. */
export const DIGITAL_CATALOGUE_CATEGORY = "Digital Services";

/** The catalogue card that opens KMD Digital Solutions from the shop. */
export const DIGITAL_SOLUTIONS_CARD = {
  label: "KMD Digital Solutions",
  image: "/products/digital-services.png",
  blurb: "Digital AI learning packages and client services for your business.",
} as const;

/**
 * How a listing publishes its yearly charge, in the listing's own words:
 * "Optional hosting: ₱1,500.00/year" where the charge is optional, and
 * "Hosting: additional ₱1,500.00/year" where it is billed on top of the project
 * price. Only the label stored against the listing is ever shown, so hosting and
 * domain are never implied together when just one of them applies.
 */
export function offeringFeeText(
  offering: Pick<DigitalOffering, "annualFee" | "annualFeeLabel" | "annualFeeOption">,
): string | null {
  if (offering.annualFee === null || offering.annualFeeOption === "none" || !offering.annualFeeLabel) {
    return null;
  }
  const prefix = offering.annualFeeOption === "optional" ? "" : "additional ";
  return `${offering.annualFeeLabel}: ${prefix}${formatPeso(offering.annualFee)}/year`;
}

/* ------------------------------------------------------------------ mappers */

const text = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const num = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const textList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export function mapOffering(row: Record<string, unknown>): DigitalOffering {
  return {
    id: String(row.id),
    offeringKey: String(row.offering_key ?? ""),
    offeringGroup: (row.offering_group === "learning_package" ? "learning_package" : "service") as OfferingGroup,
    label: String(row.label ?? ""),
    name: String(row.name ?? ""),
    summary: text(row.summary),
    description: text(row.description),
    inclusions: textList(row.inclusions),
    price: num(row.price) ?? 0,
    promoPrice: num(row.promo_price),
    regularPrice: num(row.regular_price),
    annualFee: num(row.annual_fee),
    annualFeeLabel: text(row.annual_fee_label),
    annualFeeOption: (row.annual_fee_option === "optional" || row.annual_fee_option === "recurring"
      ? row.annual_fee_option
      : "none") as FeeOption,
    maintenanceOptions: Array.isArray(row.maintenance_options)
      ? (row.maintenance_options as MaintenanceOption[])
      : [],
    paymentTermsMode: (row.payment_terms_mode === "project_50_50"
      ? "project_50_50"
      : "product_default") as PaymentTermsMode,
    paymentTermsNote: text(row.payment_terms_note),
    sortOrder: num(row.sort_order) ?? 0,
    isActive: row.is_active !== false,
  };
}

function mapLine(value: unknown): QuotationLine {
  const row = (value ?? {}) as Record<string, unknown>;
  return {
    description: String(row.description ?? ""),
    qty: num(row.qty) ?? 1,
    amount: num(row.amount) ?? 0,
  };
}

function mapFee(value: unknown): QuotationFee {
  const row = (value ?? {}) as Record<string, unknown>;
  const kind = String(row.kind ?? "other");
  return {
    kind: (["maintenance", "domain", "hosting"].includes(kind) ? kind : "other") as QuotationFee["kind"],
    description: String(row.description ?? ""),
    amount: num(row.amount),
    percent: num(row.percent),
    per: text(row.per),
    includedInTotal: row.includedInTotal === true,
  };
}

export function mapQuotation(row: Record<string, unknown>): Quotation {
  return {
    id: String(row.id),
    quotationNumber: String(row.quotation_number ?? ""),
    requestId: text(row.request_id),
    quotationDate: String(row.quotation_date ?? ""),
    validUntil: text(row.valid_until),
    targetCompletion: text(row.target_completion),
    clientName: String(row.client_name ?? ""),
    clientAddress: text(row.client_address),
    contactNumber: text(row.contact_number),
    email: text(row.email),
    businessName: text(row.business_name),
    items: Array.isArray(row.items) ? row.items.map(mapLine) : [],
    additionalWork: Array.isArray(row.additional_work) ? row.additional_work.map(mapLine) : [],
    servicesRequested: textList(row.services_requested),
    projectRequirements: text(row.project_requirements),
    scope: text(row.scope),
    deliverables: text(row.deliverables),
    subtotal: num(row.subtotal) ?? 0,
    discount: num(row.discount) ?? 0,
    taxAmount: num(row.tax_amount) ?? 0,
    includedFeesTotal: num(row.included_fees_total) ?? 0,
    totalContractPrice: num(row.total_contract_price) ?? 0,
    optionalFees: Array.isArray(row.optional_fees) ? row.optional_fees.map(mapFee) : [],
    separateFeesTotal: num(row.separate_fees_total) ?? 0,
    separateAnnualTotal: num(row.separate_annual_total) ?? 0,
    separateMonthlyTotal: num(row.separate_monthly_total) ?? 0,
    maintenanceMode: (["co_partner_5_percent", "client_monthly_50000"].includes(String(row.maintenance_mode))
      ? row.maintenance_mode
      : "none") as MaintenanceMode,
    maintenanceNote: text(row.maintenance_note),
    paymentTermsMode: (row.payment_terms_mode === "project_50_50"
      ? "project_50_50"
      : "product_default") as PaymentTermsMode,
    paymentTermsNote: text(row.payment_terms_note),
    depositAmount: num(row.deposit_amount),
    balanceAmount: num(row.balance_amount),
    terms: text(row.terms),
    preparedBy: String(row.prepared_by ?? "Dan Taoc"),
    status: (["issued", "accepted", "void"].includes(String(row.status))
      ? row.status
      : "draft") as QuotationStatus,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export function mapRequest(row: Record<string, unknown>): ClientRequest {
  return {
    id: String(row.id),
    requestNumber: String(row.request_number ?? ""),
    requestType: (row.request_type === "learning_package" ? "learning_package" : "service") as OfferingGroup,
    clientName: String(row.client_name ?? ""),
    phone: String(row.phone ?? ""),
    email: String(row.email ?? ""),
    businessName: text(row.business_name),
    clientAddress: text(row.client_address),
    learningGoals: text(row.learning_goals),
    productsServices: text(row.products_services),
    requiredFeatures: text(row.required_features),
    preferredDomain: text(row.preferred_domain),
    designReferences: text(row.design_references),
    contentSupplied: text(row.content_supplied),
    attachmentPaths: textList(row.attachment_paths),
    preferredCompletion: text(row.preferred_completion),
    hostingPreference: text(row.hosting_preference),
    maintenancePreference: text(row.maintenance_preference),
    maintenanceChoice: (["co_partner_5_percent", "client_monthly_50000"].includes(String(row.maintenance_choice))
      ? row.maintenance_choice
      : null) as ClientRequest["maintenanceChoice"],
    items: Array.isArray(row.items) ? (row.items as RequestItem[]) : [],
    estimatedTotal: num(row.estimated_total) ?? 0,
    status: (["in_review", "quoted", "closed", "cancelled"].includes(String(row.status))
      ? row.status
      : "submitted") as RequestStatus,
    adminNotes: text(row.admin_notes),
    submittedAt: String(row.submitted_at ?? ""),
  };
}

/* ------------------------------------------------- existing shop listings -- */

/**
 * The shop catalogue entries that belong to KMD Digital Solutions.
 *
 * A digital service keeps its existing storefront record so nothing already
 * published breaks, and the request form is reached from that same listing. The
 * value is the offering key the form should open with.
 */
export const SHOP_DIGITAL_OFFERING_KEYS: Record<string, string> = {
  "KMD-DIGITAL-LP": "SVC-LANDING",
};

/** The request-form link for a shop listing, or null when it is not digital. */
export function requestHrefForSku(sku: string | null | undefined): string | null {
  if (!sku) return null;
  const offeringKey = SHOP_DIGITAL_OFFERING_KEYS[sku];
  if (!offeringKey) return null;
  return `/digital-solutions/request?item=${encodeURIComponent(offeringKey)}`;
}
