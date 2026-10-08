import {
  Activity,
  ArrowRightLeft,
  BadgeCheck,
  BadgePercent,
  BarChart3,
  BookOpenCheck,
  Boxes,
  Coins,
  CreditCard,
  FileClock,
  Gift,
  GraduationCap,
  HandCoins,
  LayoutDashboard,
  Layers,
  LifeBuoy,
  Link2,
  ListChecks,
  ListTree,
  Newspaper,
  Package,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  end?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/** Member and retailer sidebar (section 34 of the brief). */
export const MEMBER_NAV: NavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", path: "/app", icon: LayoutDashboard, end: true },
      { label: "My Profile", path: "/app/profile", icon: Users },
      { label: "My Loyalty Card", path: "/app/loyalty-cards", icon: CreditCard },
    ],
  },
  {
    title: "Compensation",
    items: [
      { label: "Unilevel Earnings", path: "/app/unilevel-earnings", icon: BarChart3 },
      { label: "Loyalty Credits", path: "/app/loyalty-credits", icon: Sparkles },
      { label: "Point Transactions", path: "/app/point-transactions", icon: Receipt },
      { label: "Shopping Wallet", path: "/app/shopping-wallet", icon: ShoppingBag },
      { label: "Redeem Points", path: "/app/redeem", icon: Gift },
    ],
  },
  {
    title: "Network",
    items: [
      { label: "My Team", path: "/app/team", icon: Users },
      { label: "Genealogy", path: "/app/genealogy", icon: ListTree },
      { label: "Referral Link", path: "/app/referral", icon: Link2 },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "Orders", path: "/app/orders", icon: Package },
      { label: "Support", path: "/app/support", icon: LifeBuoy },
      { label: "Settings", path: "/app/settings", icon: Settings },
    ],
  },
];

/** Administrator sidebar (section 24 of the brief). */
export const ADMIN_NAV: NavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", path: "/admin", icon: LayoutDashboard, end: true },
      { label: "Launch Readiness", path: "/admin/readiness", icon: ListChecks },
      { label: "Reward Diagnostics", path: "/admin/diagnostics", icon: Activity },
      { label: "Verification Report", path: "/admin/verification-report", icon: BookOpenCheck },
    ],
  },
  {
    title: "Network",
    items: [
      { label: "Members", path: "/admin/members", icon: Users },
      { label: "Retailers", path: "/admin/retailers", icon: BadgePercent },
      { label: "Genealogy", path: "/admin/genealogy", icon: ListTree },
    ],
  },
  {
    title: "Commerce",
    items: [
      { label: "Orders", path: "/admin/orders", icon: Package },
      { label: "Payment Approvals", path: "/admin/payment-verification", icon: BadgeCheck },
      { label: "Catalogue", path: "/admin/products", icon: ShoppingBag },
      { label: "Inventory", path: "/admin/inventory", icon: Boxes },
      { label: "Delivery & Shipping", path: "/admin/delivery-zones", icon: Truck },
      { label: "Payment Accounts", path: "/admin/payment-accounts", icon: CreditCard },
      { label: "Bundles", path: "/admin/bundles", icon: Layers },
      { label: "Membership Packages", path: "/admin/packages", icon: GraduationCap },
    ],
  },
  {
    title: "Rewards",
    items: [
      { label: "Reward Configuration", path: "/admin/reward-configuration", icon: Coins },
      { label: "Unilevel Points", path: "/admin/point-transactions", icon: Receipt },
      { label: "Loyalty Credits", path: "/admin/loyalty-transactions", icon: HandCoins },
      { label: "Wallet Conversions", path: "/admin/wallet-conversions", icon: ArrowRightLeft },
      { label: "Wallet Payments", path: "/admin/wallet-payments", icon: Wallet },
      { label: "Redemptions", path: "/admin/redemptions", icon: Gift },
    ],
  },
  {
    title: "Support & content",
    items: [
      { label: "Support Tickets", path: "/admin/support", icon: LifeBuoy },
      { label: "Announcements & Blog", path: "/admin/content", icon: Newspaper },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Audit Logs", path: "/admin/audit-logs", icon: FileClock },
      { label: "Settings", path: "/admin/settings", icon: Settings },
    ],
  },
];

export const ADMIN_BADGE = ShieldCheck;
export const WALLET_ICON = Wallet;

