/** Shared constants for the KMD Empire app. */

/** Payout banks offered on the redemption form. */
export const BANKS = [
  "BDO",
  "BPI",
  "UnionBank",
  "MariBank",
  "GoTyme Bank",
  "EastWest Bank",
  "PNB",
  "Metrobank",
  "Other Bank",
] as const;

export const OTHER_BANK = "Other Bank";

export const UNILEVEL_LEVELS = [1, 2, 3, 4, 5] as const;

export const MEMBER_ID_FORMAT = "KMD-0000-0000-0000-0000";

export const DEFAULT_POINT_RATE = 1;

/** Redemption quick amounts, kept as a convenience only - the limit is the balance. */
export const QUICK_POINT_AMOUNTS = [500, 1000, 1500, 5000] as const;

export const PASSWORD_HINT = "At least 6 characters, letters and numbers only";

export const TEST_ACCOUNT_PASSWORD = "KmdTest2026";

/**
 * Loyalty card cover artwork, one per tier.
 *
 * Classic uses the silver cover, Gold the gold cover and Platinum the black
 * cover, matching the artwork supplied for each tier. Each cover carries the
 * brand mark in the top-right corner and embossed leaves along the bottom-right,
 * so card text is kept to the left half. Trial has no cover and falls back to the
 * designed gradient.
 */
export const LOYALTY_CARD_ART: Partial<Record<"classic" | "gold" | "platinum", string>> = {
  classic: "/cards/classic.webp",
  gold: "/cards/gold.webp",
  platinum: "/cards/platinum.webp",
};

/**
 * Card proportions.
 *
 * The supplied covers are 1583x993 (1.594:1), but the card face has to hold an
 * 18px title, the cardholder name and the details underneath. On a narrow screen
 * the same 18px type needs more lines, so the frame is taller there - otherwise
 * the last detail is cut off. The cover is anchored to its right edge, which
 * means the crop comes out of the empty left background; the brand mark and the
 * embossed leaves stay fully visible at every width.
 */
export const LOYALTY_CARD_ASPECT = "aspect-[1.15/1] sm:aspect-[1.3/1]";
