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

/**
 * Compensated Unilevel levels, 1 to 10.
 *
 * Every screen that lists or filters levels reads this constant, so extending the
 * plan here extends the matrix columns, the filters and the member breakdowns
 * together. The database mirrors it through the `max_unilevel_levels` setting and
 * the per-level columns on `reward_configurations`.
 */
export const UNILEVEL_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/**
 * Levels a Loyalty Credit may be assigned to. Loyalty is a separate reward type
 * with its own ledger and its own rule, so it keeps its original range and is not
 * widened by the Unilevel extension.
 */
export const LOYALTY_BENEFICIARY_LEVELS = [1, 2, 3, 4, 5] as const;

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

/** Aspect ratio of the supplied covers (1583x993), which the card art follows. */
export const LOYALTY_CARD_ASPECT = "aspect-[1.594/1]";
