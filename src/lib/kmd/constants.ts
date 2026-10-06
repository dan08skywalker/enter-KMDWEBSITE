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
