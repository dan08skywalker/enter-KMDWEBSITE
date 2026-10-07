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
    const outcome = await invokeFunction<ExportResult>("admin-actions", {
      action: "export_data",
      dataset,
      filters,
    });
    setBusy(false);

    if (!outcome.ok || !outcome.data) {
      toast.error(outcome.error ?? "The export could not be built");
      return;
    }

    const result = outcome.data;
    if (result.status === "FAILED" || !result.columns || !result.rows) {
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
