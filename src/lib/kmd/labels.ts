/**
 * Status and type labels plus their visual tone, so badges stay consistent
 * everywhere instead of being decided per page.
 */

export type Tone = "neutral" | "gold" | "success" | "warning" | "danger" | "info" | "platinum";

interface Descriptor {
  label: string;
  tone: Tone;
}

const ORDER_STATUS: Record<string, Descriptor> = {
  pending_payment: { label: "Pending Payment", tone: "neutral" },
  proof_submitted: { label: "Proof Submitted", tone: "info" },
  under_review: { label: "Under Review", tone: "warning" },
  confirmed: { label: "Confirmed", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

const ACCOUNT_STATUS: Record<string, Descriptor> = {
  pending: { label: "Pending Activation", tone: "warning" },
  active: { label: "Active", tone: "success" },
  inactive: { label: "Inactive", tone: "neutral" },
  suspended: { label: "Suspended", tone: "danger" },
};

const REDEMPTION_STATUS: Record<string, Descriptor> = {
  pending: { label: "Pending", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  paid: { label: "Paid", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

const LEDGER_STATUS: Record<string, Descriptor> = {
  pending: { label: "Held", tone: "warning" },
  posted: { label: "Posted", tone: "success" },
  reversed: { label: "Reversed", tone: "danger" },
};

const TRANSACTION_TYPE: Record<string, Descriptor> = {
  UNILEVEL_BONUS: { label: "Unilevel Bonus", tone: "gold" },
  REDEMPTION: { label: "Redemption", tone: "info" },
  SHOPPING_WALLET_CONVERSION: { label: "Wallet Conversion", tone: "platinum" },
  ADMIN_ADJUSTMENT: { label: "Admin Adjustment", tone: "warning" },
  REVERSAL: { label: "Reversal", tone: "danger" },
};

const REDEMPTION_TYPE: Record<string, Descriptor> = {
  PAYOUT_GCASH: { label: "GCash Payout", tone: "info" },
  PAYOUT_BANK: { label: "Bank Transfer", tone: "platinum" },
  SHOPPING_WALLET: { label: "Shopping Wallet", tone: "gold" },
};

const AUDIT_ACTION: Record<string, Descriptor> = {
  PAYMENT_CONFIRMATION: { label: "Payment Confirmed", tone: "success" },
  PAYMENT_REJECTION: { label: "Payment Rejected", tone: "danger" },
  ORDER_STATUS_CHANGE: { label: "Order Status Changed", tone: "info" },
  MEMBERSHIP_ACTIVATION: { label: "Membership Activated", tone: "success" },
  SPONSOR_CHANGE: { label: "Sponsor Changed", tone: "warning" },
  REWARD_GENERATION: { label: "Reward Generated", tone: "gold" },
  REWARD_REVERSAL: { label: "Reward Reversed", tone: "danger" },
  POINT_ADJUSTMENT: { label: "Point Adjustment", tone: "warning" },
  REDEMPTION_REQUEST: { label: "Redemption Requested", tone: "info" },
  REDEMPTION_APPROVAL: { label: "Redemption Approved", tone: "success" },
  REDEMPTION_REJECTION: { label: "Redemption Rejected", tone: "danger" },
  REDEMPTION_PAID: { label: "Redemption Paid", tone: "success" },
  REWARD_CONFIGURATION_CHANGE: { label: "Reward Config Changed", tone: "warning" },
  SETTINGS_CHANGE: { label: "Settings Changed", tone: "neutral" },
  ACCOUNT_TYPE_CHANGE: { label: "Account Type Changed", tone: "info" },
  ROLE_GRANTED: { label: "Role Granted", tone: "gold" },
  POINT_TO_WALLET_CONVERSION: { label: "Points to Wallet", tone: "platinum" },
  WALLET_PAYMENT: { label: "Paid from Wallet", tone: "gold" },
  WALLET_REFUND: { label: "Wallet Refund", tone: "info" },
};

const PAYMENT_METHOD: Record<string, Descriptor> = {
  gcash: { label: "GCash", tone: "info" },
  maya: { label: "Maya", tone: "info" },
  maya_bank: { label: "Maya Bank Transfer", tone: "platinum" },
  bank_transfer: { label: "Bank Transfer", tone: "platinum" },
  cash: { label: "Cash", tone: "neutral" },
  other: { label: "Other", tone: "neutral" },
  shopping_wallet: { label: "Shopping Wallet", tone: "gold" },
};

/** Lifecycle of a payment taken from the Shopping Wallet. */
const WALLET_PAYMENT_STATUS: Record<string, Descriptor> = {
  completed: { label: "Paid", tone: "success" },
  partially_refunded: { label: "Partly refunded", tone: "warning" },
  refunded: { label: "Refunded", tone: "neutral" },
};

/** Lifecycle state of a submitted payment proof. */
const PAYMENT_STATUS: Record<string, Descriptor> = {
  submitted: { label: "Pending", tone: "warning" },
  under_review: { label: "Pending", tone: "warning" },
  confirmed: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
};

const PACKAGE_TIER: Record<string, Descriptor> = {
  trial: { label: "Trial", tone: "neutral" },
  classic: { label: "Classic", tone: "info" },
  gold: { label: "Gold", tone: "gold" },
  platinum: { label: "Platinum", tone: "platinum" },
  vip: { label: "VIP Signature", tone: "gold" },
};

function pick(map: Record<string, Descriptor>, key?: string | null): Descriptor {
  if (!key) return { label: "\u2014", tone: "neutral" };
  return map[key] ?? { label: key.replace(/_/g, " "), tone: "neutral" };
}

export const orderStatus = (key?: string | null) => pick(ORDER_STATUS, key);
export const accountStatus = (key?: string | null) => pick(ACCOUNT_STATUS, key);
export const redemptionStatus = (key?: string | null) => pick(REDEMPTION_STATUS, key);
export const ledgerStatus = (key?: string | null) => pick(LEDGER_STATUS, key);
export const transactionType = (key?: string | null) => pick(TRANSACTION_TYPE, key);
export const redemptionType = (key?: string | null) => pick(REDEMPTION_TYPE, key);
export const auditAction = (key?: string | null) => pick(AUDIT_ACTION, key);
export const paymentMethod = (key?: string | null) => pick(PAYMENT_METHOD, key);
export const paymentStatus = (key?: string | null) => pick(PAYMENT_STATUS, key);
export const walletPaymentStatus = (key?: string | null) => pick(WALLET_PAYMENT_STATUS, key);
export const packageTier = (key?: string | null) => pick(PACKAGE_TIER, key);

export function levelLabel(level?: number | null): string {
  if (!level) return "\u2014";
  return `Level ${level}`;
}

/**
 * Status pill tones.
 *
 * `accent` is used rather than `gold` for the text colour: raw gold on a light
 * surface fails WCAG AA, and `--accent` is defined as a deep bronze in light
 * mode and bright gold in dark mode precisely so pills stay readable in both.
 */
export const toneClasses: Record<Tone, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  gold: "border-accent/35 bg-gold/12 text-accent",
  success: "border-success/30 bg-success/12 text-[hsl(var(--success))]",
  warning: "border-warning/30 bg-warning/12 text-[hsl(var(--warning))]",
  danger: "border-destructive/30 bg-destructive/12 text-destructive",
  info: "border-primary/25 bg-primary/10 text-primary",
  platinum: "border-platinum/40 bg-platinum/15 text-[hsl(var(--platinum))]",
};
