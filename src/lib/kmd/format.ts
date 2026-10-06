/**
 * Display formatting for KMD Empire.
 * 1 Unilevel point = PHP 1 (the rate itself lives in system_settings).
 */

const numberFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const moneyFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function toNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Points, with thousands separators and no trailing zeros. */
export function formatPoints(value: unknown): string {
  return numberFormatter.format(toNumber(value));
}

/** Peso amount using the configured 1 point = PHP 1 rate unless told otherwise. */
export function formatPeso(value: unknown, rate = 1): string {
  return `\u20B1${moneyFormatter.format(toNumber(value) * rate)}`;
}

export function formatSignedPoints(value: unknown, direction?: string): string {
  const amount = toNumber(value);
  const sign = direction === "DEBIT" ? "-" : "+";
  return `${sign}${numberFormatter.format(amount)}`;
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

export function formatDate(value?: string | null): string {
  if (!value) return "\u2014";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "\u2014";
  return date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "\u2014";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "\u2014";
  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelative(value?: string | null): string {
  if (!value) return "\u2014";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "\u2014";
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return formatDate(value);
}

export function initials(first?: string | null, last?: string | null): string {
  const a = (first ?? "").trim().charAt(0);
  const b = (last ?? "").trim().charAt(0);
  return `${a}${b}`.toUpperCase() || "?";
}

export function shortMemberCode(code?: string | null): string {
  if (!code) return "\u2014";
  const parts = code.split("-");
  if (parts.length < 5) return code;
  return `${parts[0]}-${parts[1]}-${parts[2]}-${parts[3]}-${parts[4]}`;
}

/** Masked display used where only part of an identifier should be visible. */
export function maskMiddle(value?: string | null, keep = 4): string {
  if (!value) return "\u2014";
  if (value.length <= keep * 2) return value;
  return `${value.slice(0, keep)}${"\u2022".repeat(Math.max(3, value.length - keep * 2))}${value.slice(-keep)}`;
}
