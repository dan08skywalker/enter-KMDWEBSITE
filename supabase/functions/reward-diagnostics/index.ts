// KMD EMPIRE · reward-diagnostics
//
// Returns the full reward-engine checklist for one order, with the specific
// reason each step did not pass. Read-only: it never triggers a payout.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Enter Cloud connection is missing ${name}`);
  return value;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const svc = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return json({ error: "UNAUTHENTICATED", message: "You must be signed in" }, 401);
    }

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: authData, error: authError } = await svc.auth.getUser(token);
    if (authError || !authData?.user) {
      return json({ error: "UNAUTHENTICATED", message: "Your session is not valid" }, 401);
    }

    const { data: isAdmin } = await svc.rpc("kmd_is_admin", { p_user_id: authData.user.id });
    if (isAdmin !== true) {
      console.warn("reward-diagnostics denied for non-administrator", authData.user.id);
      return json({ error: "FORBIDDEN", message: "Administrator access is required" }, 403);
    }

    const body = await req.json().catch(() => null);
    const identifier = String(body?.orderIdentifier ?? "").trim();
    if (!identifier) {
      return json({ error: "VALIDATION", message: "Enter an order or purchase ID" });
    }

    const { data, error } = await svc.rpc("kmd_diagnose_order", { p_identifier: identifier });
    if (error) {
      console.error("reward-diagnostics query failed:", error.message);
      return json({ error: "DIAGNOSTICS_FAILED", message: error.message.replace(/^[A-Z_]+:\s*/, "") }, 400);
    }

    const failed = Array.isArray(data?.checks)
      ? data.checks.filter((check: { passed?: boolean }) => check.passed !== true).length
      : 0;
    console.log(`reward-diagnostics ${identifier}: found=${data?.found} failedChecks=${failed}`);

    return json({ ok: true, report: data });
  } catch (error) {
    console.error("reward-diagnostics unexpected failure:", String(error));
    return json({ error: "UNEXPECTED", message: "Unexpected failure" }, 500);
  }
});
