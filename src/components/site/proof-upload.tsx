import { useRef, useState } from "react";
import { FileText, Image as ImageIcon, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export interface ProofFile {
  file: File;
  previewUrl: string | null;
}

/** Validates and previews a proof-of-payment file before it is uploaded. */
export function useProofFile() {
  const [proof, setProof] = useState<ProofFile | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (file: File | null) => {
    if (!file) return { ok: false, error: "No file chosen." };
    if (!ACCEPTED.includes(file.type)) {
      return { ok: false, error: "Attach a JPG, PNG, WebP image or a PDF." };
    }
    if (file.size > MAX_BYTES) {
      return { ok: false, error: "That file is larger than 8 MB. Please attach a smaller one." };
    }
    setProof({
      file,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
    });
    return { ok: true };
  };

  const clear = () => {
    setProof((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
    if (inputRef.current) inputRef.current.value = "";
  };

  return { proof, pick, clear, inputRef };
}

/**
 * Uploads the proof into the private proof bucket.
 *
 * The object path is namespaced by order number so staff can always tell which
 * order a file belongs to, and the bucket has no public read access.
 */
export async function uploadProof(orderNumber: string, file: File): Promise<string | null> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
  const path = `${orderNumber}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;

  const { error } = await supabase.storage
    .from("payment-proofs")
    .upload(path, file, { cacheControl: "3600", upsert: false });

  if (error) {
    console.error("Proof upload failed:", error.message);
    return null;
  }
  return path;
}

export function ProofPicker({
  proofState,
}: {
  proofState: ReturnType<typeof useProofFile>;
}) {
  const { proof, pick, clear, inputRef } = proofState;
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="sr-only"
        id="proof-file"
        onChange={(event) => {
          const result = pick(event.target.files?.[0] ?? null);
          setError(result.ok ? null : (result.error ?? null));
        }}
      />

      {proof ? (
        <div className="flex items-center gap-3 rounded-lg border bg-secondary/50 p-3">
          {proof.previewUrl ? (
            <img
              src={proof.previewUrl}
              alt="Your proof of payment"
              className="h-14 w-14 rounded-md border object-cover"
            />
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-md border bg-background">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </span>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{proof.file.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {(proof.file.size / 1024).toFixed(0)} KB · ready to attach
            </p>
          </div>

          <Button type="button" variant="ghost" size="sm" onClick={clear}>
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </Button>
        </div>
      ) : (
        <label
          htmlFor="proof-file"
          className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center transition-colors hover:border-primary/40 hover:bg-secondary/40"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-primary">
            <Upload className="h-5 w-5" />
          </span>
          <span className="text-xs font-semibold">Attach your proof of payment</span>
          <span className="text-[11px] text-muted-foreground">
            A screenshot or photo of the receipt, or a PDF. Up to 8 MB.
          </span>
        </label>
      )}

      {error ? <p className="mt-2 text-[11px] text-destructive">{error}</p> : null}

      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <ImageIcon className="h-3 w-3" />
        Your receipt is stored privately and is only visible to the team that verifies payments.
      </p>
    </div>
  );
}
