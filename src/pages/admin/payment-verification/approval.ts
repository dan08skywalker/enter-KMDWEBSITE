import { paymentStatus, type Tone } from "@/lib/kmd/labels";
import type { Order, OrderItem, PaymentProof, Profile } from "@/lib/kmd/types";

export type ApprovalBucket = "pending" | "approved" | "rejected";

/**
 * One submitted payment, assembled from the order it pays for, its line items,
 * the proof the buyer uploaded and the buyer's own record. `proof` is null only
 * when an order reached an approval state without a stored proof row.
 */
export interface ApprovalRow {
  order: Order;
  items: OrderItem[];
  proof: PaymentProof | null;
  buyer: Profile | null;
  /** True when the order contains a membership package, so approving it activates the buyer. */
  isMembership: boolean;
  /** Human label of the purchased membership package, when there is one. */
  membershipLabel: string | null;
}

/**
 * The approval status of a payment.
 *
 * The order is the source of truth: a proof can be left at `under_review` while
 * the order itself has already been approved or rejected.
 */
export function approvalBucket(row: ApprovalRow): ApprovalBucket {
  if (row.order.status === "confirmed") return "approved";
  if (row.order.status === "rejected" || row.proof?.status === "rejected") return "rejected";
  return "pending";
}

/** Badge text for the approval status. */
export function approvalDescriptor(row: ApprovalRow): { label: string; tone: Tone } {
  const bucket = approvalBucket(row);
  if (bucket === "approved") return paymentStatus("confirmed");
  if (bucket === "rejected") return paymentStatus("rejected");
  return paymentStatus(row.proof?.status ?? "submitted");
}

export function approvalState(proof: PaymentProof | null): { label: string; tone: Tone } {
  return proof ? paymentStatus(proof.status) : { label: "No proof", tone: "neutral" };
}

/**
 * Everything a search box is allowed to match on: member name, member ID,
 * username, order number and payment reference number.
 */
export function searchHaystack(row: ApprovalRow): string {
  return [
    row.order.order_number,
    row.order.buyer_member_code,
    row.buyer?.first_name,
    row.buyer?.last_name,
    row.buyer?.full_name,
    row.buyer?.username,
    row.buyer?.email,
    row.buyer?.mobile_number,
    row.proof?.reference_number,
    row.proof?.bank_name,
    row.proof?.account_name,
    row.proof?.guest_name,
    row.proof?.guest_email,
    ...row.items.map((item) => item.sku),
    ...row.items.map((item) => item.product_name),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Buyer label that works for members and for guest purchases. */
export function buyerLabel(row: ApprovalRow): string {
  if (row.buyer) {
    return `${row.buyer.first_name} ${row.buyer.last_name}`.trim() || row.buyer.username;
  }
  return row.proof?.guest_name ?? row.order.guest_name ?? "Guest buyer";
}
