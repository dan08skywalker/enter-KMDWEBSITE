// KMD EMPIRE · admin-actions
//
// The administrative control surface. The caller's administrator role is checked
// here with a database lookup - never trusted from the request - and every action
// writes an audit row inside the database function that performs the change.
//
// Payment confirmation is the trigger that runs the reward engine, and it is
// idempotent: confirming twice can never pay a level twice.

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

function serviceClient() {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const svc = serviceClient();
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return json({ error: "UNAUTHENTICATED", message: "You must be signed in" }, 401);
    }

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: authData, error: authError } = await svc.auth.getUser(token);
    if (authError || !authData?.user) {
      return json({ error: "UNAUTHENTICATED", message: "Your session is not valid" }, 401);
    }
    const actorId = authData.user.id;

    // Authorization is a database fact, not a client claim.
    const { data: isAdmin, error: roleError } = await svc.rpc("kmd_is_admin", { p_user_id: actorId });
    if (roleError) {
      console.error("admin-actions role check failed:", roleError.message);
      return json({ error: "AUTHORIZATION_FAILED", message: "Could not verify administrator rights" }, 500);
    }
    if (isAdmin !== true) {
      console.warn("admin-actions denied for non-administrator", actorId);
      return json({ error: "FORBIDDEN", message: "Administrator access is required" }, 403);
    }

    const body = await req.json().catch(() => null);
    const action = String(body?.action ?? "");
    const reason = body?.reason ? String(body.reason) : null;

    const run = async (fn: string, args: Record<string, unknown>) => {
      const { data, error } = await svc.rpc(fn, args);
      if (error) {
        console.error(`admin-actions ${action} failed:`, error.message);
        return json({ error: "ACTION_FAILED", message: error.message.replace(/^[A-Z_]+:\s*/, "") }, 400);
      }
      console.log(`admin-actions ${action} ->`, data?.status ?? "ok");
      return json({ ok: data?.status !== "FAILED" && data?.status !== "REJECTED", result: data });
    };

    switch (action) {
      case "confirm_payment":
        return run("kmd_confirm_payment", {
          p_order_id: String(body?.orderId ?? ""),
          p_actor: actorId,
          p_qualification_source: "payment_confirmed",
        });

      case "reject_payment":
        return run("kmd_reject_payment", {
          p_order_id: String(body?.orderId ?? ""),
          p_actor: actorId,
          p_reason: reason ?? "Payment rejected",
        });

      case "set_order_status":
        return run("kmd_set_order_status", {
          p_order_id: String(body?.orderId ?? ""),
          p_status: String(body?.status ?? ""),
          p_actor: actorId,
          p_reason: reason ?? "Order status updated",
        });

      case "activate_member":
        return run("kmd_activate_member", {
          p_member: String(body?.memberId ?? ""),
          p_actor: actorId,
          p_package_id: body?.packageId ? String(body.packageId) : null,
          p_reason: reason ?? "Membership activated",
        });

      case "set_account_type":
        return run("kmd_set_account_type", {
          p_member: String(body?.memberId ?? ""),
          p_account_type: String(body?.accountType ?? ""),
          p_actor: actorId,
        });

      case "set_role":
        return run("kmd_set_member_role", {
          p_user_id: String(body?.memberId ?? ""),
          p_role: String(body?.role ?? ""),
          p_actor: actorId,
        });

      case "change_sponsor":
        return run("kmd_change_sponsor", {
          p_member: String(body?.memberId ?? ""),
          p_new_sponsor: body?.sponsorId ? String(body.sponsorId) : null,
          p_actor: actorId,
          p_reason: reason ?? "Sponsor changed by administrator",
        });

      case "adjust_points":
        return run("kmd_adjust_points", {
          p_member: String(body?.memberId ?? ""),
          p_points: Number(body?.points ?? 0),
          p_direction: String(body?.direction ?? "CREDIT"),
          p_reason: reason ?? "Administrative adjustment",
          p_actor: actorId,
        });

      case "reverse_reward":
        return run("kmd_reverse_reward", {
          p_ledger_id: String(body?.ledgerId ?? ""),
          p_actor: actorId,
          p_reason: reason ?? "Reward reversed by administrator",
        });

      case "update_reward_config":
        return run("kmd_update_reward_config", {
          p_product_id: String(body?.productId ?? ""),
          p_l1: Number(body?.level1 ?? 0),
          p_l2: Number(body?.level2 ?? 0),
          p_l3: Number(body?.level3 ?? 0),
          p_l4: Number(body?.level4 ?? 0),
          p_l5: Number(body?.level5 ?? 0),
          p_loyalty: Number(body?.loyaltyCredit ?? 0),
          p_loyalty_level: Number(body?.loyaltyBeneficiaryLevel ?? 1),
          p_is_active: body?.isActive !== false,
          p_actor: actorId,
        });

      case "update_setting":
        return run("kmd_update_setting", {
          p_key: String(body?.key ?? ""),
          p_value: body?.value ?? null,
          p_actor: actorId,
        });

      case "review_redemption":
        return run("kmd_review_redemption", {
          p_redemption_id: String(body?.redemptionId ?? ""),
          p_actor: actorId,
          p_action: String(body?.decision ?? ""),
          p_reason: reason,
        });

      case "reconcile_balance":
        return run("kmd_reconcile_member_balance", { p_member: String(body?.memberId ?? "") });

      case "process_qualified_purchase":
        // Manual retry path for an order that qualified but whose engine run failed.
        return run("kmd_process_qualified_purchase", {
          p_order_id: String(body?.orderId ?? ""),
          p_actor: actorId,
        });

      case "create_product":
        return run("kmd_create_product", {
          p_actor: actorId,
          p_product_code: String(body?.productCode ?? ""),
          p_name: String(body?.name ?? ""),
          p_sku: String(body?.sku ?? ""),
          p_membership_code: body?.membershipCode ?? null,
          p_category: body?.category ?? null,
          p_product_type: String(body?.productType ?? ""),
          p_selling_price: Number(body?.sellingPrice ?? 0),
          p_is_active: body?.isActive !== false,
        });

      case "update_product":
        return run("kmd_update_product", {
          p_actor: actorId,
          p_product_id: String(body?.productId ?? ""),
          p_name: String(body?.name ?? ""),
          p_sku: String(body?.sku ?? ""),
          p_membership_code: body?.membershipCode ?? null,
          p_category: body?.category ?? null,
          p_product_type: String(body?.productType ?? ""),
          p_selling_price: Number(body?.sellingPrice ?? 0),
          p_is_active: body?.isActive !== false,
        });

      case "create_package":
        return run("kmd_create_package", {
          p_actor: actorId,
          p_package_code: String(body?.packageCode ?? ""),
          p_name: String(body?.name ?? ""),
          p_tier: String(body?.tier ?? ""),
          p_product_id: String(body?.productId ?? ""),
          p_is_active: body?.isActive !== false,
        });

      case "update_package":
        return run("kmd_update_package", {
          p_actor: actorId,
          p_package_id: String(body?.packageId ?? ""),
          p_name: String(body?.name ?? ""),
          p_tier: String(body?.tier ?? ""),
          p_product_id: String(body?.productId ?? ""),
          p_is_active: body?.isActive !== false,
        });

      case "proof_url": {
        // Proof files live in a private bucket, so the administrator is handed a
        // short-lived signed link rather than a public object URL.
        const orderId = String(body?.orderId ?? "");
        const { data: proof, error: proofError } = await svc
          .from("payment_proofs")
          .select("id, proof_path, method, reference_number, amount, status, submitted_at")
          .eq("order_id", orderId)
          .order("submitted_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (proofError) {
          console.error("admin-actions proof_url lookup failed:", proofError.message);
          return json({ error: "PROOF_LOOKUP_FAILED", message: "Could not load the payment proof" }, 500);
        }
        if (!proof) {
          return json({ error: "NO_PROOF", message: "No payment proof has been submitted for this order" }, 404);
        }
        if (!proof.proof_path) {
          return json({ error: "NO_PROOF_FILE", message: "The submitted proof has no file attached" }, 404);
        }

        const { data: signed, error: signError } = await svc.storage
          .from("payment-proofs")
          .createSignedUrl(proof.proof_path, 3600);

        if (signError || !signed?.signedUrl) {
          console.error("admin-actions proof_url signing failed:", signError?.message);
          return json({ error: "SIGNING_FAILED", message: "Could not create a secure link to the proof" }, 500);
        }

        console.log("admin-actions proof_url issued for order", orderId);
        return json({ ok: true, url: signed.signedUrl, proof });
      }

      default:
        return json({ error: "UNKNOWN_ACTION", message: `Unsupported action: ${action || "(none)"}` }, 400);
    }
  } catch (error) {
    console.error("admin-actions unexpected failure:", String(error));
    return json({ error: "UNEXPECTED", message: "Unexpected failure" }, 500);
  }
});
