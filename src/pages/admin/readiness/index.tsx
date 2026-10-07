import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Info, ListChecks, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/kmd/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ReadinessItem {
  key: string;
  label: string;
  status: "ok" | "todo" | "critical";
  detail: string;
  actionPath: string;
  actionLabel: string;
}

const TONE: Record<ReadinessItem["status"], string> = {
  ok: "border-success/30 bg-success/8",
  todo: "border-warning/35 bg-warning/10",
  critical: "border-destructive/35 bg-destructive/10",
};

const LABEL: Record<ReadinessItem["status"], string> = {
  ok: "Ready",
  todo: "To do",
  critical: "Blocking",
};

/**
 * What only the owner can complete before launch: fees, prices, stock,
 * verification. Every row is computed from live data, so nothing here can go
 * stale or be ticked off optimistically.
 */
export default function AdminReadiness() {
  const [items, setItems] = useState<ReadinessItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("kmd_readiness_report");
    if (error) {
      console.error("Could not load the readiness report:", error.message);
      setItems([]);
    } else {
      setItems((data ?? []) as unknown as ReadinessItem[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const blocking = items.filter((item) => item.status === "critical").length;
  const todo = items.filter((item) => item.status === "todo").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Launch readiness"
        description="The setup only you can complete. Each item is read from live data — it clears itself the moment the underlying value is set."
        actions={
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="kmd-panel p-4">
          <p className="kmd-label">Blocking</p>
          <p className="kmd-figure mt-2">{blocking}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            A customer-facing flow cannot complete until this is set.
          </p>
        </div>
        <div className="kmd-panel p-4">
          <p className="kmd-label">To do</p>
          <p className="kmd-figure mt-2">{todo}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Improves the experience but does not stop an order.
          </p>
        </div>
        <div className="kmd-panel p-4">
          <p className="kmd-label">Ready</p>
          <p className="kmd-figure mt-2">{items.filter((item) => item.status === "ok").length}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Nothing to do here.</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.key} className={cn("rounded-xl border p-4", TONE[item.status])}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 gap-3">
                  <span className="mt-0.5 shrink-0">
                    {item.status === "ok" ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : item.status === "todo" ? (
                      <Info className="h-4 w-4 text-warning" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {item.label}
                      <span className="ml-2 rounded-full border border-current/25 px-2 py-0.5 text-[10px] uppercase tracking-wider">
                        {LABEL[item.status]}
                      </span>
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
                  </div>
                </div>

                <Button asChild variant="outline" size="sm">
                  <Link to={item.actionPath}>{item.actionLabel}</Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!loading && items.length === 0 ? (
        <p className="kmd-panel p-6 text-sm text-muted-foreground">
          <ListChecks className="mr-2 inline h-4 w-4" />
          The readiness report could not be loaded. Refresh the page or check the audit logs.
        </p>
      ) : null}
    </div>
  );
}
