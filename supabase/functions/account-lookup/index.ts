// KMD EMPIRE · account-lookup
//
// The single public entry point for the registration and sign-in screens:
//   check_username  - is the username still free
//   sponsor_preview - resolve a referral code / sponsor ID for the lock-in banner
//   resolve_login   - username -> the account email used by the auth backend
//
// All database reads happen through security-definer functions that are not
// reachable from the browser, so member rows and emails are never exposed through
// a directly callable table or RPC.

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

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string) {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("Enter Cloud connection is not configured for this function");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json({ error: "VALIDATION", message: "An action is required" });
    }

    const action = String(body.action ?? "");
    const clientKey =
      req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? "unknown";

    if (rateLimited(`${action}:${clientKey}`)) {
      console.warn("account-lookup rate limited", action, clientKey);
      return json({ error: "RATE_LIMITED", message: "Too many attempts. Please wait a moment." }, 429);
    }

    const svc = serviceClient();

    if (action === "check_username") {
      const username = String(body.username ?? "").trim();
      if (!/^[A-Za-z0-9._-]{3,32}$/.test(username)) {
        return json({ ok: true, available: false, reason: "INVALID_FORMAT" });
      }
      const { data, error } = await svc.rpc("kmd_username_available", { p_username: username });
      if (error) {
        console.error("account-lookup check_username failed:", error.message);
        return json({ error: "LOOKUP_FAILED", message: "Could not check the username" }, 500);
      }
      return json({ ok: true, available: data === true });
    }

    if (action === "sponsor_preview") {
      const code = String(body.code ?? "").trim();
      if (!code) {
        return json({ ok: true, found: false });
      }
      const { data, error } = await svc.rpc("kmd_sponsor_preview", { p_code: code });
      if (error) {
        console.error("account-lookup sponsor_preview failed:", error.message);
        return json({ error: "LOOKUP_FAILED", message: "Could not verify the sponsor ID" }, 500);
      }
      return json({ ok: true, ...(data ?? { found: false }) });
    }

    if (action === "resolve_login") {
      const username = String(body.username ?? "").trim();
      if (!username) {
        return json({ error: "VALIDATION", message: "Username is required" });
      }
      const { data, error } = await svc.rpc("kmd_resolve_login", { p_username: username });
      if (error) {
        console.error("account-lookup resolve_login failed:", error.message);
        return json({ error: "LOOKUP_FAILED", message: "Could not resolve that username" }, 500);
      }
      if (!data || data.found !== true) {
        console.log("account-lookup resolve_login miss:", username);
        return json({ ok: true, found: false });
      }
      console.log("account-lookup resolve_login hit:", username);
      return json({ ok: true, found: true, email: data.email, accountStatus: data.accountStatus });
    }

    return json({ error: "UNKNOWN_ACTION", message: `Unsupported action: ${action || "(none)"}` }, 400);
  } catch (error) {
    console.error("account-lookup unexpected failure:", String(error));
    return json({ error: "LOOKUP_FAILED", message: "Unexpected lookup failure" }, 500);
  }
});
