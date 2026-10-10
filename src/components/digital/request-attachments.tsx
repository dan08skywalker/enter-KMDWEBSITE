import { useRef, useState } from "react";
import { FileText, Paperclip, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const MAX_FILES = 3;
const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "application/pdf", "application/zip"];

export interface RequestAttachment {
  file: File;
}

/**
 * Optional content, logo and photo attachments for a client request.
 *
 * Files go into a private bucket: only an administrator can read them back, and
 * the request itself stores just the object paths.
 */
export function useRequestAttachments() {
  const [attachments, setAttachments] = useState<RequestAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pathsRef = useRef<string[]>([]);

  const add = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next: RequestAttachment[] = [...attachments];
    let message: string | null = null;

    Array.from(files).forEach((file) => {
      if (next.length >= MAX_FILES) {
        message = `You can attach up to ${MAX_FILES} files.`;
        return;
      }
      if (!ACCEPTED.includes(file.type)) {
        message = "Attach a JPG, PNG, WebP, PDF or ZIP file.";
        return;
      }
      if (file.size > MAX_BYTES) {
        message = "Each file must be 8 MB or smaller.";
        return;
      }
      next.push({ file });
    });

    setAttachments(next);
    setError(message);
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = (index: number) => {
    setAttachments((current) => current.filter((_, position) => position !== index));
    setError(null);
  };

  /** Uploads everything chosen and returns the stored paths. */
  const upload = async (): Promise<string[]> => {
    if (attachments.length === 0) return [];

    const stored: string[] = [];
    for (const attachment of attachments) {
      const safeName = attachment.file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
      const path = `requests/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("client-request-files")
        .upload(path, attachment.file, { cacheControl: "3600", upsert: false });

      if (uploadError) {
        console.error("Request attachment upload failed:", uploadError.message);
        return [];
      }
      stored.push(path);
    }

    pathsRef.current = stored;
    return stored;
  };

  return { attachments, add, remove, upload, error, pathsRef, inputRef };
}

export function RequestAttachmentPicker({
  state,
}: {
  state: ReturnType<typeof useRequestAttachments>;
}) {
  const { attachments, add, remove, error, inputRef } = state;

  return (
    <div>
      <input
        ref={inputRef}
        id="request-files"
        type="file"
        multiple
        accept={ACCEPTED.join(",")}
        className="sr-only"
        onChange={(event) => add(event.target.files)}
      />

      {attachments.length > 0 ? (
        <ul className="space-y-2">
          {attachments.map((attachment, index) => (
            <li
              key={`${attachment.file.name}-${index}`}
              className="flex items-center gap-3 rounded-lg border bg-secondary/40 p-3"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-md border bg-background">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold">{attachment.file.name}</span>
                <span className="text-[11px] text-muted-foreground">
                  {(attachment.file.size / 1024).toFixed(0)} KB
                </span>
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {attachments.length < MAX_FILES ? (
        <label
          htmlFor="request-files"
          className="mt-2 flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed p-5 text-center transition-colors hover:border-primary/40 hover:bg-secondary/40"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-primary">
            <Upload className="h-4 w-4" />
          </span>
          <span className="text-xs font-semibold">Attach your logo, photos or content</span>
          <span className="text-[11px] text-muted-foreground">
            Optional. Up to {MAX_FILES} files, 8 MB each: JPG, PNG, WebP, PDF or ZIP.
          </span>
        </label>
      ) : null}

      {error ? <p className="mt-2 text-[11px] text-destructive">{error}</p> : null}

      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Paperclip className="h-3 w-3" />
        Files are stored privately and are only visible to the team preparing your quotation.
      </p>
    </div>
  );
}
