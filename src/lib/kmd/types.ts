/**
 * Domain types for the KMD Empire reward system.
 * These mirror the database tables so pages stay type-safe without editing the
 * generated integration types.
 */

export type AccountType = "member" | "retailer";
export type AccountStatus = "pending" | "active" | "inactive" | "suspended";
export type UserRole = "member" | "retailer" | "admin" | "super_admin";

export type OrderStatus =
  | "pending_payment"
  | "proof_submitted"
  | "under_review"
  | "confirmed"
  | "rejected"
  | "cancelled";

export type LedgerStatus = "pending" | "posted" | "reversed";
export type LedgerDirection = "CREDIT" | "DEBIT";

/** Lifecycle of a submitted payment proof (the payment approval state). */
export type PaymentProofStatus = "submitted" | "under_review" | "confirmed" | "rejected";

export type PointTransactionType =
  | "UNILEVEL_BONUS"
  | "REDEMPTION"
  | "SHOPPING_WALLET_CONVERSION"
  | "ADMIN_ADJUSTMENT"
  | "REVERSAL";

export type RedemptionType = "PAYOUT_GCASH" | "PAYOUT_BANK" | "SHOPPING_WALLET";
export type RedemptionStatus = "pending" | "approved" | "rejected" | "paid" | "cancelled";

export interface Profile {
  id: string;
  member_code: string;
  referral_code: string;
  username: string;
  first_name: string;
  last_name: string;
  full_name: string;
  mobile_number: string | null;
  /** Login email. Kept in step with the authentication account and used to sign in. */
  email: string;
  /** Optional contact address. Has no effect on signing in. */
  contact_email: string | null;
  sponsor_code: string | null;
  direct_sponsor_id: string | null;
  package_id: string | null;
  account_type: AccountType;
  account_status: AccountStatus;
  registration_date: string;
  activation_date: string | null;
  profile_photo_url: string | null;
  unilevel_points_balance: number;
  loyalty_credits_balance: number;
  shopping_wallet_balance: number;
  total_lifetime_earnings: number;
  is_test: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  product_code: string;
  name: string;
  sku: string;
  membership_code: string | null;
  category: string;
  product_type: "membership" | "bundle" | "reorder";
  selling_price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MembershipPackage {
  id: string;
  package_code: string;
  name: string;
  tier: "trial" | "classic" | "gold" | "platinum";
  product_id: string;
  is_active: boolean;
}

export interface RewardConfiguration {
  id: string;
  product_id: string;
  sku: string;
  level1_points: number;
  level2_points: number;
  level3_points: number;
  level4_points: number;
  level5_points: number;
  loyalty_credit: number;
  loyalty_beneficiary_level: number;
  is_active: boolean;
  updated_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  buyer_profile_id: string | null;
  buyer_member_code: string | null;
  customer_type: "member" | "guest";
  guest_name: string | null;
  guest_email: string | null;
  total_amount: number;
  subtotal: number;
  shipping_fee: number;
  /** false means a delivery fee is still to be confirmed, so the total is not final. */
  is_shipping_quoted: boolean;
  payment_method: string | null;
  status: OrderStatus;
  /** Fulfilment state and the courier booking recorded by the administrator. */
  fulfillment_status: "unfulfilled" | "preparing" | "shipped" | "delivered" | "cancelled";
  courier: string | null;
  tracking_number: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  qualification_source: string | null;
  rewards_processed: boolean;
  rewards_processed_at: string | null;
  notes: string | null;
  is_test: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  sku: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  /** Pricing category applied when this line was bought, or null for the published price. */
  pricing_category?: string | null;
  pricing_rule_version?: string | null;
  currency?: string | null;
}

export interface PaymentProof {
  id: string;
  order_id: string;
  member_id: string | null;
  member_code: string | null;
  method: "gcash" | "maya" | "maya_bank" | "bank_transfer" | "cash" | "other";
  reference_number: string | null;
  bank_name: string | null;
  account_name: string | null;
  amount: number;
  proof_path: string | null;
  status: PaymentProofStatus;
  submitted_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  guest_name: string | null;
  guest_email: string | null;
  is_test: boolean;
}

export interface PointLedgerRow {
  id: string;
  transaction_id: string;
  order_id: string | null;
  order_item_id: string | null;
  buyer_member_code: string | null;
  beneficiary_id: string;
  beneficiary_member_code: string;
  product_id: string | null;
  sku: string | null;
  product_name: string | null;
  quantity: number | null;
  unilevel_level: number | null;
  points_per_unit: number | null;
  total_points: number;
  reward_type: PointTransactionType;
  transaction_type: PointTransactionType;
  direction: LedgerDirection;
  status: LedgerStatus;
  trigger_event: string | null;
  created_at: string;
  posted_at: string | null;
  /** The administrator who posted this entry, when it was a manual action. */
  processed_by: string | null;
  /** Unilevel points balance immediately before and after this entry. */
  balance_before: number | null;
  balance_after: number | null;
  note: string | null;
  is_test: boolean;
}

export interface LoyaltyLedgerRow {
  id: string;
  transaction_id: string;
  order_id: string | null;
  buyer_member_code: string | null;
  beneficiary_id: string;
  beneficiary_member_code: string;
  sku: string | null;
  product_name: string | null;
  quantity: number | null;
  credit_amount: number;
  direction: LedgerDirection;
  status: LedgerStatus;
  trigger_event: string | null;
  created_at: string;
  note: string | null;
  /** Set only on administrator adjustments, where a before/after balance is meaningful. */
  balance_before: number | null;
  balance_after: number | null;
  is_test: boolean;
}

export interface WalletLedgerRow {
  id: string;
  transaction_id: string;
  member_id: string;
  direction: LedgerDirection;
  amount: number;
  status: LedgerStatus;
  trigger_event: string | null;
  created_at: string;
  note: string | null;
}

export type ConversionDirection = "POINTS_TO_WALLET" | "WALLET_TO_POINTS";

export interface WalletConversion {
  id: string;
  reference: string;
  member_id: string;
  member_code: string;
  direction: ConversionDirection;
  amount_deducted: number;
  amount_credited: number;
  rate: number;
  fee_percent: number;
  fee_amount: number;
  points_balance_before: number | null;
  points_balance_after: number | null;
  wallet_balance_before: number | null;
  wallet_balance_after: number | null;
  status: "posted" | "reversed";
  processed_by: string | null;
  is_test: boolean;
  created_at: string;
}

export type WalletPaymentStatus = "completed" | "partially_refunded" | "refunded";

/** One order settled from the member's Shopping Wallet. */
export interface WalletPayment {
  id: string;
  reference: string;
  member_id: string;
  member_code: string;
  order_id: string;
  order_number: string;
  amount: number;
  wallet_balance_before: number;
  wallet_balance_after: number;
  status: WalletPaymentStatus;
  refunded_amount: number;
  wallet_ledger_id: string | null;
  idempotency_key: string | null;
  processed_by: string | null;
  is_test: boolean;
  created_at: string;
  updated_at: string;
}

/** Money returned to the member's Shopping Wallet for a wallet payment. */
export interface WalletPaymentRefund {
  id: string;
  reference: string;
  payment_id: string;
  member_id: string;
  member_code: string;
  order_id: string;
  order_number: string;
  amount: number;
  reason: string | null;
  wallet_balance_before: number;
  wallet_balance_after: number;
  processed_by: string | null;
  is_test: boolean;
  created_at: string;
}

export interface Redemption {
  id: string;
  redemption_number: string;
  member_id: string;
  member_code: string;
  redemption_type: RedemptionType;
  points: number;
  peso_value: number;
  status: RedemptionStatus;
  gcash_number: string | null;
  gcash_account_name: string | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  other_bank_name: string | null;
  requested_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
  is_test: boolean;
}

export interface AuditLogRow {
  id: string;
  actor_member_code: string | null;
  actor_username: string | null;
  action: string;
  target_member_code: string | null;
  order_id: string | null;
  entity: string | null;
  entity_id: string | null;
  previous_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
}

export interface TestResultRow {
  id: string;
  run_id: string;
  test_key: string;
  test_name: string;
  expected: string | null;
  actual: string | null;
  verdict: "PASS" | "FAIL" | "BLOCKED";
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface SystemSetting {
  key: string;
  value: unknown;
  description: string | null;
  updated_at: string;
}

export interface SponsorshipRow {
  level: number;
  ancestor_id: string;
  created_at: string;
}

export interface DiagnosticCheck {
  key: string;
  label: string;
  passed: boolean;
  reasonText?: string;
  memberCode?: string;
  memberName?: string;
  expectedTotal?: number;
  issues?: unknown[];
}

export interface DiagnosticReport {
  found: boolean;
  identifier: string;
  message?: string;
  orderId?: string;
  orderNumber?: string;
  orderStatus?: string;
  buyerMemberCode?: string;
  rewardsProcessed?: boolean;
  rewardsProcessedAt?: string | null;
  expectedPoints?: number;
  ledgerRows?: number;
  loyaltyRows?: number;
  checks: DiagnosticCheck[];
}

export interface EngineRunResult {
  status: string;
  reason?: string;
  reasonText?: string;
  orderNumber?: string;
  totalPointsAwarded?: number;
  totalLoyaltyAwarded?: number;
  levels?: Array<{
    level: number;
    beneficiaryMemberCode: string;
    beneficiaryName?: string;
    sku: string;
    quantity: number;
    pointsPerUnit: number;
    totalPoints: number;
    transactionId: string;
  }>;
  loyaltyCredits?: Array<{
    level: number;
    beneficiaryMemberCode: string;
    amount: number;
    transactionId: string;
  }>;
  skipped?: Array<{ level: number; reason: string; reasonText: string; beneficiaryMemberCode?: string }>;
  orderStatus?: string;
}
