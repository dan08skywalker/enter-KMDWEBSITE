import { CheckCircle2, CircleAlert, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DiagnosticCheck } from "@/lib/kmd/types";

interface DiagnosticsChecklistProps {
  checks: DiagnosticCheck[];
  className?: string;
}

const LEVEL_PREFIX = "sponsor_level";

/**
 * The reward-engine checklist. Every row shows the concrete reason it did not
 * pass - never a generic "something went wrong".
 */
export function DiagnosticsChecklist({ checks, className }: DiagnosticsChecklistProps) {
  const levels = checks.filter((c) => c.key.startsWith(LEVEL_PREFIX));
  const others = checks.filter((c) => !c.key.startsWith(LEVEL_PREFIX));

  const renderRow = (check: DiagnosticCheck) => {
    const Icon = check.passed ? CheckCircle2 : XCircle;
    return (
      <div
        key={check.key}
        className={cn(
          "flex items-start gap-3 rounded-lg border px-3 py-2.5",
          check.passed ? "border-border bg-card" : "border-destructive/30 bg-destructive/5",
        )}
      >
        <Icon
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0",
            check.passed ? "text-[hsl(var(--success))]" : "text-destructive",
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-medium">{check.label}</span>
            {check.memberCode ? (
              <span className="font-mono text-[11px] text-muted-foreground">{check.memberCode}</span>
            ) : null}
            {typeof check.expectedTotal === "number" ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                expected {check.expectedTotal} pts
              </span>
            ) : null}
          </div>
          {check.reasonText ? (
            <p
              className={cn(
                "mt-0.5 text-xs",
                check.passed ? "text-muted-foreground" : "font-medium text-destructive",
              )}
            >
              {check.reasonText}
            </p>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-2">{others.map(renderRow)}</div>

      <div className="rounded-xl border bg-muted/30 p-3">
        <p className="kmd-label mb-2 flex items-center gap-1.5">
          <CircleAlert className="h-3.5 w-3.5" />
          Sponsor genealogy trace (Level 1-5)
        </p>
        <div className="space-y-2">{levels.map(renderRow)}</div>
      </div>
    </div>
  );
}
