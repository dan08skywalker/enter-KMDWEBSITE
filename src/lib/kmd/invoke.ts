import { supabase } from "@/integrations/supabase/client";

export interface InvokeOutcome<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

/**
 * Calls a backend function and normalises its response. Server functions return
 * `{ error, message }` for expected failures, so the server's message is what the
 * member or administrator should see.
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
      console.error(`${name} invocation failed:`, error.message);
      return { ok: false, error: error.message || "The request could not be completed." };
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
