import { useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { LogOut, Menu, Shield, ShoppingBag, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/kmd/status-badge";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { NotificationBell } from "@/components/layout/notification-bell";
import { LanguageSwitcher } from "@/components/language-switcher";
import { accountStatus } from "@/lib/kmd/labels";
import { initials } from "@/lib/kmd/format";
import { ADMIN_NAV, MEMBER_NAV, type NavSection } from "@/components/layout/nav-items";

interface AppShellProps {
  children: ReactNode;
  variant: "member" | "admin";
}

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="kmd-brand-mark">KMD</span>
      <span className="flex flex-col leading-none">
        <span className="text-sm font-bold tracking-tight text-sidebar-accent-foreground">
          KMD EMPIRE
        </span>
        <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-sidebar-foreground/60">
          Retailers &amp; Members
        </span>
      </span>
    </Link>
  );
}

function NavList({
  sections,
  onNavigate,
}: {
  sections: NavSection[];
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4 kmd-scroll">
      {sections.map((section) => (
        <div key={section.title} className="flex flex-col gap-1">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/45">
            {section.title}
          </p>
          {section.items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}

function AccountPanel({ variant }: { variant: "member" | "admin" }) {
  const { profile, isAdmin, signOut } = useAuth();
  const status = accountStatus(profile?.account_status);

  return (
    <div className="border-t border-sidebar-border px-3 py-3">
      <div className="flex items-center gap-3 rounded-lg px-2 py-2">
        <Avatar className="h-9 w-9 border border-sidebar-border">
          <AvatarFallback className="bg-sidebar-accent text-[11px] font-bold text-sidebar-accent-foreground">
            {initials(profile?.first_name, profile?.last_name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-sidebar-accent-foreground">
            {profile?.full_name ?? "Signed in"}
          </p>
          <p className="truncate text-[10px] text-sidebar-foreground/60">
            {profile?.member_code ?? ""}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 px-2 pb-2">
        <StatusBadge label={status.label} tone={status.tone} />
        {variant === "admin" ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-primary">
            <Shield className="h-3 w-3" />
            Administrator
          </span>
        ) : null}
      </div>
      {variant === "member" && isAdmin ? (
        <Button asChild variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground">
          <Link to="/admin">
            <Shield className="h-4 w-4" />
            Admin console
          </Link>
        </Button>
      ) : null}
      {variant === "admin" ? (
        <Button asChild variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground">
          <Link to="/app">
            <UserRound className="h-4 w-4" />
            Member dashboard
          </Link>
        </Button>
      ) : null}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void signOut()}
        className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
      >
        <LogOut className="h-4 w-4" />
        Logout
      </Button>
    </div>
  );
}

/** Persistent sidebar shell shared by the member and administrator areas. */
export function AppShell({ children, variant }: AppShellProps) {
  const sections = variant === "admin" ? ADMIN_NAV : MEMBER_NAV;
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex h-full w-full bg-background">
      <aside className="hidden w-[264px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-16 items-center px-5">
          <Brand />
        </div>
        <NavList sections={sections} />
        <AccountPanel variant={variant} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b bg-card/80 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3 lg:hidden">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Open navigation">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] border-sidebar-border bg-sidebar p-0">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <div className="flex h-16 items-center px-5">
                  <Brand />
                </div>
                <div className="flex h-[calc(100%-4rem)] flex-col">
                  <NavList sections={sections} onNavigate={() => setOpen(false)} />
                  <AccountPanel variant={variant} />
                </div>
              </SheetContent>
            </Sheet>
            <span className="truncate text-sm font-semibold">
              {variant === "admin" ? "Admin Console" : "Member Dashboard"}
            </span>
          </div>

          <div className="hidden min-w-0 lg:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {variant === "admin" ? "Administrator Console" : "KMD Empire"}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <div className="hidden sm:block">
              <LanguageSwitcher className="h-9 min-w-[118px] text-xs" />
            </div>
            <NotificationBell />
            <ThemeToggle />
            <Button asChild variant="ghost" size="sm" className="ml-1">
              <Link to="/shop">
                <ShoppingBag className="h-4 w-4" />
                <span className="hidden sm:inline">Shop</span>
              </Link>
            </Button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto kmd-scroll">
          <div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
