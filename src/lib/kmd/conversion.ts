import type { ConversionDirection } from "@/lib/kmd/types";

/**
 * Conversion maths, mirrored from `kmd_convert_balance`.
 *
 * The preview here is indicative only — the database returns the authoritative
 * amounts and those are what gets shown once a conversion succeeds. Both sides
 * round to two decimals so a member never sees a preview that disagrees with the
 * receipt by more than a cent.
 */
const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export interface DirectionMeta {
  direction: ConversionDirection;
  /** Short label for history rows. */
  label: string;
  /** "from" and "to" as the member sees them. */
  fromLabel: string;
  toLabel: string;
}

export const CONVERSION_DIRECTIONS: Record<ConversionDirection, DirectionMeta> = {
  POINTS_TO_WALLET: {
    direction: "POINTS_TO_WALLET",
    label: "Points → Wallet",
    fromLabel: "Available Unilevel Points",
    toLabel: "Shopping Wallet Balance",
  },
  WALLET_TO_POINTS: {
    direction: "WALLET_TO_POINTS",
    label: "Wallet → Points",
    fromLabel: "Shopping Wallet Balance",
    toLabel: "Available Unilevel Points",
  },
};

export interface ConversionMath {
  /** Amount retained by the configured fee. */
  fee: number;
  /** Amount actually converted after the fee. */
  net: number;
  /** Amount the member receives. */
  credited: number;
}

export function computeConversion(
  amount: number,
  direction: ConversionDirection,
  rate: number,
  feePercent: number,
): ConversionMath {
  const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const safeRate = Number.isFinite(rate) && rate > 0 ? rate : 0;
  const safeFee = Number.isFinite(feePercent) && feePercent > 0 ? feePercent : 0;

  const fee = round2((safeAmount * safeFee) / 100);
  const net = round2(safeAmount - fee);

  if (net <= 0 || safeRate <= 0) {
    return { fee, net, credited: 0 };
  }

  const credited =
    direction === "POINTS_TO_WALLET" ? round2(net * safeRate) : round2(net / safeRate);

  return { fee, net, credited };
}

/** Human-readable rate, e.g. "1 point = 1 wallet unit". */
export function describeRate(rate: number): string {
  const formatted = Number.isFinite(rate) ? rate.toLocaleString("en-PH", { maximumFractionDigits: 6 }) : "0";
  return `1 point = ${formatted} wallet`;
}
