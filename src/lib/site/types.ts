/** Shared types for the public KMD Empire storefront. */

export interface StoreProduct {
  id: string;
  slug: string | null;
  sku: string;
  productCode: string;
  name: string;
  brand: string | null;
  category: string;
  productType: "retail" | "reorder" | "digital" | string;
  eyebrow: string | null;
  description: string | null;
  disclaimer: string | null;
  imageUrl: string | null;
  gallery: string[] | null;
  regularPrice: number | null;
  promoPrice: number | null;
  effectivePrice: number;
  isDigital: boolean;
  tracksInventory: boolean;
  /** null means "not stock-tracked" (unlimited or digital). */
  availableQuantity: number | null;
  inStock: boolean;
  lowStock: boolean;
}

export interface StorePackage {
  id: string;
  code: string;
  name: string;
  tier: "trial" | "classic" | "gold" | "platinum" | string;
  productName: string;
  sku: string;
  regularPrice: number | null;
  promoPrice: number | null;
  effectivePrice: number;
  description: string | null;
}

export interface DeliveryZone {
  id: string;
  name: string;
  coverage: string | null;
  shippingFee: number;
  freeShippingThreshold: number | null;
  estimatedDaysMin: number | null;
  estimatedDaysMax: number | null;
  /** false means the owner has not supplied this area's fee yet. */
  isConfigured: boolean;
}

export interface PaymentAccount {
  id: string;
  method: "gcash" | "maya" | "maya_bank" | "bank_transfer" | "cash" | "other";
  label: string | null;
  bankName: string | null;
  accountName: string | null;
  accountNumber: string | null;
  qrImageUrl: string | null;
}

export type SiteSettings = Record<string, unknown>;

export interface StoreCatalog {
  products: StoreProduct[];
  packages: StorePackage[];
  deliveryZones: DeliveryZone[];
  paymentAccounts: PaymentAccount[];
  settings: SiteSettings;
}

export interface CartLine {
  sku: string;
  name: string;
  unitPrice: number;
  quantity: number;
  imageUrl: string | null;
  isDigital: boolean;
}

export interface QuoteResult {
  status: "OK" | "FAILED";
  reason?: string;
  reasonText?: string;
  sku?: string;
  available?: number;
  lines?: Array<{
    sku: string;
    name: string;
    productId: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    isDigital: boolean;
    imageUrl: string | null;
  }>;
  subtotal?: number;
  shippingFee?: number;
  shippingQuoted?: boolean;
  requiresShipping?: boolean;
  total?: number;
  zoneName?: string | null;
}

export interface TrackedOrder {
  found: boolean;
  reasonText?: string;
  orderNumber?: string;
  status?: string;
  fulfillmentStatus?: string;
  paymentMethod?: string | null;
  subtotal?: number;
  shippingFee?: number;
  isShippingQuoted?: boolean;
  totalAmount?: number;
  courier?: string | null;
  trackingNumber?: string | null;
  customerName?: string | null;
  createdAt?: string;
  items?: Array<{
    sku: string;
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  awaitingPaymentVerification?: boolean;
}

export interface PlacedOrder {
  status: string;
  orderId?: string;
  orderNumber?: string;
  accessToken?: string;
  subtotal?: number;
  shippingFee?: number;
  shippingQuoted?: boolean;
  totalAmount?: number;
  customerType?: string;
  reasonText?: string;
}
