import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { invokeFunction } from "@/lib/kmd/invoke";
import { buildCsv, downloadCsv } from "@/lib/site/csv";

interface ExportResult {
  status?: string;
  columns?: string[];
  rows?: unknown[][];
  rowCount?: number;
  generatedAt?: string;
  reasonText?: string;
}

/**
 * Downloads every row matching the current filters.
 *
 * The backend builds the dataset and records a DATA_EXPORTED audit entry on the
 * same call, so an export always leaves a trace even if the download itself
 * never lands.
 */
export function ExportButton({
  dataset,
  filters = {},
  label = "Export CSV",
  disabled = false,
}: {
  dataset: string;
  filters?: Record<string, unknown>;
  label?: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    const outcome = await invokeFunction<{ result?: ExportResult }>("admin-actions", {
      action: "export_data",
      dataset,
      filters,
    });
    setBusy(false);

    // Every administrator action is answered as { ok, result }, so the export payload
    // lives under `result`. Reading it flat found nothing and reported a failure even
    // when the backend had built the file correctly.
    const result = outcome.data?.result;

    if (!outcome.ok || !result) {
      // Logged so a failure can be diagnosed from the console without guessing.
      console.error("Export failed:", { dataset, filters, error: outcome.error, response: outcome.data });
      toast.error(outcome.error ?? "The export could not be built");
      return;
    }

    if (result.status === "FAILED" || !result.columns || !result.rows) {
      console.error("Export refused by the backend:", { dataset, filters, result });
      toast.error(result.reasonText ?? "The export could not be built");
      return;
    }

    if (result.rows.length === 0) {
      toast.info("Nothing matches those filters, so there is nothing to export");
      return;
    }

    const stamp = (result.generatedAt ?? new Date().toISOString()).replace(/[: ]/g, "-");
    downloadCsv(`kmd-${dataset}-${stamp}.csv`, buildCsv(result.columns, result.rows));
    toast.success(`${result.rowCount} row${result.rowCount === 1 ? "" : "s"} exported`);
  };

  return (
    <Button type="button" variant="outline" size="sm" disabled={busy || disabled} onClick={() => void run()}>
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      {label}
    </Button>
  );
}
