import { supabase } from "@/integrations/supabase/client";

export interface InvokeOutcome<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

/**
 * Extract the Response from a supabase-js FunctionsHttpError. Only that error
 * shape carries the server's response body.
 */
function errorResponse(error: unknown): Response | null {
  if (typeof error !== "object" || error === null) return null;
  const context = (error as { context?: unknown }).context;
  if (!context || typeof context !== "object") return null;
  return typeof (context as Response).json === "function" ? (context as Response) : null;
}

/**
 * Read the reason the server actually gave. A non-2xx response still carries a
 * JSON body with `{ error, message }`, so falling back to the generic
 * "Edge Function returned a non-2xx status code" hides the real cause.
 */
async function serverMessage(error: unknown): Promise<string | null> {
  const response = errorResponse(error);
  if (!response) return null;

  try {
    const payload: unknown = await response.json();
    if (payload && typeof payload === "object") {
      const record = payload as { message?: unknown; error?: unknown };
      if (typeof record.message === "string" && record.message.length > 0) return record.message;
      if (typeof record.error === "string" && record.error.length > 0) return record.error;
    }
  } catch {
    // The body was empty or not JSON; fall back to the transport message.
    return null;
  }
  return null;
}

/**
 * Calls a backend function and normalises its response. Server functions return
 * `{ error, message }` for expected failures, so the server's own message is what
 * the member or administrator should see.
 */
export async function invokeFunction<T>(
  name: string,
  body: Record<string, unknown>,
): Promise<InvokeOutcome<T>> {
  try {
    const { data, error } = await supabase.functions.invoke(name, {
      body,
      headers: { "Content-Type": "application/json" },
    });

    if (error) {
      const detailed = await serverMessage(error);
      console.error(`${name} invocation failed:`, detailed ?? error.message);
      return {
        ok: false,
        error: detailed ?? error.message ?? "The request could not be completed.",
      };
    }

    if (data && typeof data === "object" && "error" in data) {
      const payload = data as { error: string; message?: string };
      console.error(`${name} returned ${payload.error}:`, payload.message);
      return { ok: false, error: payload.message || payload.error };
    }

    return { ok: true, data: data as T };
  } catch (error) {
    console.error(`${name} threw:`, error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unexpected failure",
    };
  }
}
