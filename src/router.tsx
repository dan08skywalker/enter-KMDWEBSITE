import type { ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { RequireAdmin, RequireSession } from "@/components/layout/route-guard";
import { AppShell } from "@/components/layout/app-shell";

/* ---------------- public site ---------------- */
import HomePage from "./pages/site/home";
import AboutPage from "./pages/site/about";
import ProductsPage from "./pages/site/products";
import ShopPage from "./pages/site/shop";
import ProductDetailPage from "./pages/site/product";
import PackagesPage from "./pages/site/packages";
import ReferralProgramPage from "./pages/site/referral-program";
import TestimonialsPage from "./pages/site/testimonials";
import FaqsPage from "./pages/site/faqs";
import KnowledgePage from "./pages/site/knowledge";
import {
  AnnouncementArticlePage,
  AnnouncementsListPage,
  BlogArticlePage,
  BlogListPage,
} from "./pages/site/content";
import ContactPage from "./pages/site/contact";
import { PrivacyPolicyPage, RefundPolicyPage, TermsPage } from "./pages/site/policies";
import CartPage from "./pages/site/cart";
import CheckoutPage from "./pages/site/checkout";
import OrderConfirmationPage from "./pages/site/order";
import TrackOrderPage from "./pages/site/track";

/* ---------------- account ---------------- */
import Login from "./pages/login";
import Register from "./pages/register";
import ForgotPassword from "./pages/forgot-password";
import ResetPassword from "./pages/reset-password";
import NotFound from "./pages/NotFound";

/* ---------------- member ---------------- */
import MemberDashboard from "./pages/member/dashboard";
import MemberProfile from "./pages/member/profile";
import MemberLoyaltyCards from "./pages/member/loyalty-cards";
import MemberUnilevelEarnings from "./pages/member/unilevel-earnings";
import MemberLoyaltyCredits from "./pages/member/loyalty-credits";
import MemberPointTransactions from "./pages/member/point-transactions";
import MemberShoppingWallet from "./pages/member/shopping-wallet";
import MemberRedeem from "./pages/member/redeem";
import MemberTeam from "./pages/member/team";
import MemberGenealogy from "./pages/member/genealogy";
import MemberReferral from "./pages/member/referral";
import MemberOrders from "./pages/member/orders";
import MemberOrderDetail from "./pages/member/orders/detail";
import MemberSupport from "./pages/member/support";
import MemberSettings from "./pages/member/settings";

/* ---------------- admin ---------------- */
import AdminDashboard from "./pages/admin/dashboard";
import AdminDiagnostics from "./pages/admin/diagnostics";
import AdminVerificationReport from "./pages/admin/verification-report";
import AdminReadiness from "./pages/admin/readiness";
import AdminMembers from "./pages/admin/members";
import AdminRetailers from "./pages/admin/retailers";
import AdminGenealogy from "./pages/admin/genealogy";
import AdminOrders from "./pages/admin/orders";
import AdminOrderDetail from "./pages/admin/orders/detail";
import AdminPaymentApprovals from "./pages/admin/payment-verification";
import AdminProducts from "./pages/admin/products";
import AdminInventory from "./pages/admin/inventory";
import AdminDeliveryZones from "./pages/admin/delivery-zones";
import AdminPaymentAccounts from "./pages/admin/payment-accounts";
import AdminBundles from "./pages/admin/bundles";
import AdminPackages from "./pages/admin/packages";
import AdminRewardConfiguration from "./pages/admin/reward-configuration";
import AdminPointTransactions from "./pages/admin/point-transactions";
import AdminLoyaltyTransactions from "./pages/admin/loyalty-transactions";
import AdminLoyaltyAdjustments from "./pages/admin/loyalty-adjustments";
import AdminWalletConversions from "./pages/admin/wallet-conversions";
import AdminWalletPayments from "./pages/admin/wallet-payments";
import AdminMemberPricing from "./pages/admin/member-pricing";
import AdminLevel1Caps from "./pages/admin/level1-caps";
import AdminRedemptions from "./pages/admin/redemptions";
import AdminSupport from "./pages/admin/support";
import AdminContent from "./pages/admin/content";
import AdminAuditLogs from "./pages/admin/audit-logs";
import AdminSettings from "./pages/admin/settings";

function MemberArea() {
  return (
    <RequireSession>
      <AppShell variant="member">
        <Outlet />
      </AppShell>
    </RequireSession>
  );
}

function AdminArea() {
  return (
    <RequireAdmin>
      <AppShell variant="admin">
        <Outlet />
      </AppShell>
    </RequireAdmin>
  );
}

export const routers: Array<{
  path: string;
  name: string;
  element: ReactNode;
  children?: Array<{ path: string; name: string; element: ReactNode }>;
}> = [
  /* ---------------- public storefront ---------------- */
  { path: "/", name: "home", element: <HomePage /> },
  { path: "/about", name: "about", element: <AboutPage /> },
  { path: "/products", name: "products", element: <ProductsPage /> },
  { path: "/shop", name: "shop", element: <ShopPage /> },
  { path: "/shop/:slug", name: "shop-product", element: <ProductDetailPage /> },
  { path: "/packages", name: "packages", element: <PackagesPage /> },
  { path: "/referral-program", name: "referral-program", element: <ReferralProgramPage /> },
  { path: "/testimonials", name: "testimonials", element: <TestimonialsPage /> },
  { path: "/faqs", name: "faqs", element: <FaqsPage /> },
  { path: "/knowledge", name: "knowledge", element: <KnowledgePage /> },
  { path: "/blog", name: "blog", element: <BlogListPage /> },
  { path: "/blog/:slug", name: "blog-article", element: <BlogArticlePage /> },
  { path: "/announcements", name: "announcements", element: <AnnouncementsListPage /> },
  { path: "/announcements/:slug", name: "announcement", element: <AnnouncementArticlePage /> },
  { path: "/contact", name: "contact", element: <ContactPage /> },
  { path: "/privacy-policy", name: "privacy-policy", element: <PrivacyPolicyPage /> },
  { path: "/terms", name: "terms", element: <TermsPage /> },
  { path: "/refund-policy", name: "refund-policy", element: <RefundPolicyPage /> },
  { path: "/cart", name: "cart", element: <CartPage /> },
  { path: "/checkout", name: "checkout", element: <CheckoutPage /> },
  { path: "/order/:orderNumber", name: "order-confirmation", element: <OrderConfirmationPage /> },
  { path: "/track", name: "track-order", element: <TrackOrderPage /> },

  /* ---------------- account ---------------- */
  { path: "/login", name: "login", element: <Login /> },
  { path: "/register", name: "register", element: <Register /> },
  { path: "/forgot-password", name: "forgot-password", element: <ForgotPassword /> },
  { path: "/reset-password", name: "reset-password", element: <ResetPassword /> },

  {
    path: "/app",
    name: "app",
    element: <MemberArea />,
    children: [
      { path: "", name: "app-dashboard", element: <MemberDashboard /> },
      { path: "profile", name: "app-profile", element: <MemberProfile /> },
      { path: "loyalty-cards", name: "app-loyalty-cards", element: <MemberLoyaltyCards /> },
      { path: "unilevel-earnings", name: "app-unilevel-earnings", element: <MemberUnilevelEarnings /> },
      { path: "loyalty-credits", name: "app-loyalty-credits", element: <MemberLoyaltyCredits /> },
      { path: "point-transactions", name: "app-point-transactions", element: <MemberPointTransactions /> },
      { path: "shopping-wallet", name: "app-shopping-wallet", element: <MemberShoppingWallet /> },
      { path: "redeem", name: "app-redeem", element: <MemberRedeem /> },
      { path: "team", name: "app-team", element: <MemberTeam /> },
      { path: "genealogy", name: "app-genealogy", element: <MemberGenealogy /> },
      { path: "referral", name: "app-referral", element: <MemberReferral /> },
      { path: "orders", name: "app-orders", element: <MemberOrders /> },
      { path: "orders/:orderId", name: "app-order-detail", element: <MemberOrderDetail /> },
      { path: "support", name: "app-support", element: <MemberSupport /> },
      { path: "settings", name: "app-settings", element: <MemberSettings /> },
    ],
  },

  {
    path: "/admin",
    name: "admin",
    element: <AdminArea />,
    children: [
      { path: "", name: "admin-dashboard", element: <AdminDashboard /> },
      { path: "diagnostics", name: "admin-diagnostics", element: <AdminDiagnostics /> },
      { path: "verification-report", name: "admin-verification-report", element: <AdminVerificationReport /> },
      { path: "readiness", name: "admin-readiness", element: <AdminReadiness /> },
      { path: "members", name: "admin-members", element: <AdminMembers /> },
      { path: "retailers", name: "admin-retailers", element: <AdminRetailers /> },
      { path: "genealogy", name: "admin-genealogy", element: <AdminGenealogy /> },
      { path: "orders", name: "admin-orders", element: <AdminOrders /> },
      { path: "orders/:orderId", name: "admin-order-detail", element: <AdminOrderDetail /> },
      { path: "payment-verification", name: "admin-payment-approvals", element: <AdminPaymentApprovals /> },
      { path: "products", name: "admin-products", element: <AdminProducts /> },
      { path: "inventory", name: "admin-inventory", element: <AdminInventory /> },
      { path: "delivery-zones", name: "admin-delivery-zones", element: <AdminDeliveryZones /> },
      { path: "payment-accounts", name: "admin-payment-accounts", element: <AdminPaymentAccounts /> },
      { path: "bundles", name: "admin-bundles", element: <AdminBundles /> },
      { path: "packages", name: "admin-packages", element: <AdminPackages /> },
      { path: "reward-configuration", name: "admin-reward-configuration", element: <AdminRewardConfiguration /> },
      { path: "point-transactions", name: "admin-point-transactions", element: <AdminPointTransactions /> },
      { path: "loyalty-transactions", name: "admin-loyalty-transactions", element: <AdminLoyaltyTransactions /> },
      { path: "loyalty-adjustments", name: "admin-loyalty-adjustments", element: <AdminLoyaltyAdjustments /> },
      { path: "member-pricing", name: "admin-member-pricing", element: <AdminMemberPricing /> },
      { path: "level1-caps", name: "admin-level1-caps", element: <AdminLevel1Caps /> },
      { path: "wallet-conversions", name: "admin-wallet-conversions", element: <AdminWalletConversions /> },
      { path: "wallet-payments", name: "admin-wallet-payments", element: <AdminWalletPayments /> },
      { path: "redemptions", name: "admin-redemptions", element: <AdminRedemptions /> },
      { path: "support", name: "admin-support", element: <AdminSupport /> },
      { path: "content", name: "admin-content", element: <AdminContent /> },
      { path: "audit-logs", name: "admin-audit-logs", element: <AdminAuditLogs /> },
      { path: "settings", name: "admin-settings", element: <AdminSettings /> },
    ],
  },

  /* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */
  { path: "*", name: "404", element: <NotFound /> },
];

declare global {
  interface Window {
    __routers__: typeof routers;
  }
}

window.__routers__ = routers;
