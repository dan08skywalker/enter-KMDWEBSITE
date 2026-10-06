import type { ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { RequireAdmin, RequireSession } from "@/components/layout/route-guard";
import { AppShell } from "@/components/layout/app-shell";

import Landing from "./pages/landing";
import Login from "./pages/login";
import Register from "./pages/register";
import ForgotPassword from "./pages/forgot-password";
import NotFound from "./pages/NotFound";

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
import MemberSettings from "./pages/member/settings";

import AdminDashboard from "./pages/admin/dashboard";
import AdminDiagnostics from "./pages/admin/diagnostics";
import AdminVerificationReport from "./pages/admin/verification-report";
import AdminMembers from "./pages/admin/members";
import AdminRetailers from "./pages/admin/retailers";
import AdminGenealogy from "./pages/admin/genealogy";
import AdminOrders from "./pages/admin/orders";
import AdminOrderDetail from "./pages/admin/orders/detail";
import AdminPaymentVerification from "./pages/admin/payment-verification";
import AdminProducts from "./pages/admin/products";
import AdminPackages from "./pages/admin/packages";
import AdminRewardConfiguration from "./pages/admin/reward-configuration";
import AdminPointTransactions from "./pages/admin/point-transactions";
import AdminLoyaltyTransactions from "./pages/admin/loyalty-transactions";
import AdminRedemptions from "./pages/admin/redemptions";
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
  { path: "/", name: "landing", element: <Landing /> },
  { path: "/login", name: "login", element: <Login /> },
  { path: "/register", name: "register", element: <Register /> },
  { path: "/forgot-password", name: "forgot-password", element: <ForgotPassword /> },

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
      { path: "members", name: "admin-members", element: <AdminMembers /> },
      { path: "retailers", name: "admin-retailers", element: <AdminRetailers /> },
      { path: "genealogy", name: "admin-genealogy", element: <AdminGenealogy /> },
      { path: "orders", name: "admin-orders", element: <AdminOrders /> },
      { path: "orders/:orderId", name: "admin-order-detail", element: <AdminOrderDetail /> },
      { path: "payment-verification", name: "admin-payment-verification", element: <AdminPaymentVerification /> },
      { path: "products", name: "admin-products", element: <AdminProducts /> },
      { path: "packages", name: "admin-packages", element: <AdminPackages /> },
      { path: "reward-configuration", name: "admin-reward-configuration", element: <AdminRewardConfiguration /> },
      { path: "point-transactions", name: "admin-point-transactions", element: <AdminPointTransactions /> },
      { path: "loyalty-transactions", name: "admin-loyalty-transactions", element: <AdminLoyaltyTransactions /> },
      { path: "redemptions", name: "admin-redemptions", element: <AdminRedemptions /> },
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
