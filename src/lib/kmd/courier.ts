/**
 * Courier tracking for member orders.
 *
 * J&T Express is linked as an external tracking page: the URL is fixed, no query
 * parameters are ever appended, no shipment status is fetched and no fulfillment
 * status is changed from here. The tracking number itself is always the value
 * already stored on the order by the fulfilment record.
 */

export const JNT_TRACKING_URL = "https://www.jtexpress.ph/track-and-trace";

export const JNT_LABEL = "J&T Express";

export const TRACKING_INSTRUCTION =
  "Copy your tracking number, then paste it into the J&T Express tracking page.";

export const TRACKING_UNAVAILABLE = "Tracking number not yet available";

export const DIGITAL_ORDER_NOTE = "Digital order";

/**
 * True only for a courier this dashboard can honestly label J&T Express.
 *
 * Anything else (LBC, 2GO, Ninja Van, or no courier recorded at all) is left
 * unlabelled rather than presented as a J&T shipment.
 */
export function isJntCourier(courier?: string | null): boolean {
  if (!courier) return false;
  const normalized = courier.toLowerCase().replace(/[^a-z&]/g, "");
  return normalized.includes("j&t") || normalized.includes("jnt") || normalized.includes("jtexpress");
}

/** The courier exactly as the fulfilment record stores it. */
export function courierLabel(courier?: string | null): string {
  const value = (courier ?? "").trim();
  return value.length > 0 ? value : "Courier not specified";
}

/** Fulfillment state shown alongside the tracking number. */
export function fulfillmentLabel(status?: string | null): string {
  const value = (status ?? "").trim();
  if (!value) return "Not yet fulfilled";
  return value.replace(/_/g, " ");
}

/** True when every line on the order is a digital product, so nothing ships. */
export function isDigitalOnlyOrder(
  items: Array<{ product_id: string | null }>,
  digitalProductIds: Set<string>,
): boolean {
  if (items.length === 0) return false;
  return items.every((item) => item.product_id !== null && digitalProductIds.has(item.product_id));
}
