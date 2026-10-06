import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ConfirmActionDialogProps {
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  /** Ask for a reason and pass it to onConfirm (used for audited actions). */
  reasonRequired?: boolean;
  reasonLabel?: string;
  onConfirm: (reason?: string) => Promise<{ error?: string } | void>;
}

/**
 * Confirmation wrapper for actions that change money or membership state.
 * Audited actions can require a reason, which is stored on the audit row.
 */
export function ConfirmActionDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirm",
  destructive = false,
  reasonRequired = false,
  reasonLabel = "Reason",
  onConfirm,
}: ConfirmActionDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (reasonRequired && reason.trim().length === 0) {
      setError("A reason is required for this action.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await onConfirm(reason.trim() || undefined);
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      setReason("");
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {reasonRequired ? (
          <div className="space-y-2">
            <Label htmlFor="kmd-confirm-reason">{reasonLabel}</Label>
            <Textarea
              id="kmd-confirm-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Recorded on the audit log"
              rows={3}
            />
          </div>
        ) : null}

        {error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive">
            {error}
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button
            onClick={() => void handleConfirm()}
            disabled={busy}
            variant={destructive ? "destructive" : "default"}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
