// KMD EMPIRE · member-actions
//
// Everything a signed-in member may do that touches money or files:
//   create_order        - place a purchase (price and SKU resolved server-side)
//   submit_proof        - upload payment proof and move the order to proof_submitted
//   request_redemption  - redeem available points for GCash / bank payout
//   convert_to_wallet   - convert available points into Shopping Wallet balance
//   update_profile      - update contact details
//
// Authorization is the caller's own identity; every amount is calculated in the
// database, never taken from the request body.

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

const BUCKET = "payment-proofs";
const MAX_PROOF_BYTES = 6 * 1024 * 1024;

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

function userClient(authHeader: string) {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function requireUser(
  svc: ReturnType<typeof serviceClient>,
  req: Request,
): Promise<{ id: string } | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data, error } = await svc.auth.getUser(token);
  if (error || !data?.user) return null;
  return { id: data.user.id };
}

async function ensureBucket(svc: ReturnType<typeof serviceClient>) {
  const { data } = await svc.storage.getBucket(BUCKET);
  if (data) return;
  const { error } = await svc.storage.createBucket(BUCKET, { public: false });
  if (error && !/already exists/i.test(error.message)) {
    console.error("member-actions bucket preparation failed:", error.message);
    throw new Error("Could not prepare secure storage for payment proofs");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const svc = serviceClient();
    const user = await requireUser(svc, req);
    if (!user) {
      console.warn("member-actions rejected an unauthenticated call");
      return json({ error: "UNAUTHENTICATED", message: "You must be signed in" }, 401);
    }

    const body = await req.json().catch(() => null);
    const action = String(body?.action ?? "");
    const authHeader = req.headers.get("Authorization") ?? "";

    if (action === "create_order") {
      const productId = String(body?.productId ?? "");
      const quantity = Number(body?.quantity ?? 1);
      if (!productId) return json({ error: "VALIDATION", message: "A product is required" });
      if (!Number.isInteger(quantity) || quantity < 1) {
        return json({ error: "VALIDATION", message: "Quantity must be a whole number of at least 1" });
      }

      // Called with the member's own token so auth.uid() is the buyer:
      // price, SKU and product identity are resolved in the database.
      const { data, error } = await userClient(authHeader).rpc("kmd_create_order", {
        p_product_id: productId,
        p_quantity: quantity,
      });
      if (error) {
        console.error("member-actions create_order failed:", error.message);
        return json({ error: "ORDER_FAILED", message: error.message.replace(/^[A-Z_]+:\s*/, "") }, 400);
      }
      console.log("member-actions create_order", data?.orderNumber, "qty", quantity);
      return json({ ok: true, order: data });
    }

    if (action === "submit_proof") {
      const orderId = String(body?.orderId ?? "");
      const method = String(body?.method ?? "");
      const proofBase64 = typeof body?.proofBase64 === "string" ? body.proofBase64 : "";
      const contentType = String(body?.contentType ?? "image/jpeg");
      const amount = Number(body?.amount ?? 0);

      if (!orderId) return json({ error: "VALIDATION", message: "An order is required" });
      if (!["gcash", "bank_transfer", "cash", "other"].includes(method)) {
        return json({ error: "VALIDATION", message: "Choose a payment method" });
      }

      const { data: order, error: orderError } = await svc
        .from("orders")
        .select("id, buyer_profile_id, order_number, status, is_test")
        .eq("id", orderId)
        .maybeSingle();

      if (orderError) {
        console.error("member-actions submit_proof order lookup failed:", orderError.message);
        return json({ error: "ORDER_LOOKUP_FAILED", message: "Could not load the order" }, 500);
      }
      if (!order) return json({ error: "ORDER_NOT_FOUND", message: "Order not found" }, 404);
      if (order.buyer_profile_id !== user.id) {
        console.warn("member-actions submit_proof forbidden for order", orderId);
        return json({ error: "FORBIDDEN", message: "This order belongs to another member" }, 403);
      }
      if (order.status === "confirmed") {
        return json({ error: "ORDER_ALREADY_CONFIRMED", message: "This order is already confirmed" }, 400);
      }
      if (order.status === "cancelled" || order.status === "rejected") {
        return json({ error: "ORDER_CLOSED", message: `A ${order.status} order cannot receive payment proof` }, 400);
      }

      let proofPath: string | null = null;
      if (proofBase64) {
        const bytes = Uint8Array.from(atob(proofBase64), (c) => c.charCodeAt(0));
        if (bytes.byteLength > MAX_PROOF_BYTES) {
          return json({ error: "FILE_TOO_LARGE", message: "Payment proof must be 6 MB or smaller" }, 400);
        }
        await ensureBucket(svc);
        const extension = contentType.includes("png") ? "png" : contentType.includes("pdf") ? "pdf" : "jpg";
        proofPath = `${user.id}/${order.order_number}-${Date.now()}.${extension}`;
        const { error: uploadError } = await svc.storage
          .from(BUCKET)
          .upload(proofPath, bytes, { contentType, upsert: true });
        if (uploadError) {
          console.error("member-actions proof upload failed:", uploadError.message);
          return json({ error: "UPLOAD_FAILED", message: "Could not store the payment proof" }, 500);
        }
      }

      const { error: proofError } = await svc.from("payment_proofs").insert({
        order_id: order.id,
        member_id: user.id,
        method,
        reference_number: body?.referenceNumber ? String(body.referenceNumber) : null,
        bank_name: body?.bankName ? String(body.bankName) : null,
        account_name: body?.accountName ? String(body.accountName) : null,
        amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
        proof_path: proofPath,
        status: "under_review",
        is_test: order.is_test === true,
      });
      if (proofError) {
        console.error("member-actions proof insert failed:", proofError.message);
        return json({ error: "PROOF_SAVE_FAILED", message: "Could not record the payment proof" }, 500);
      }

      const { error: statusError } = await svc.rpc("kmd_set_order_status", {
        p_order_id: order.id,
        p_status: "proof_submitted",
        p_actor: user.id,
        p_reason: "Payment proof submitted by member",
      });
      if (statusError) {
        console.error("member-actions status update failed:", statusError.message);
      }

      console.log("member-actions submit_proof", order.order_number, method, proofPath ?? "no file");
      return json({
        ok: true,
        orderId: order.id,
        orderNumber: order.order_number,
        status: "proof_submitted",
        message: "Payment proof submitted. An administrator will verify it.",
      });
    }

    if (action === "request_redemption") {
      const points = Number(body?.points ?? 0);
      const type = String(body?.redemptionType ?? "");
      const { data, error } = await svc.rpc("kmd_request_redemption", {
        p_member: user.id,
        p_points: points,
        p_redemption_type: type,
        p_gcash_number: body?.gcashNumber ?? null,
        p_gcash_account_name: body?.gcashAccountName ?? null,
        p_bank_name: body?.bankName ?? null,
        p_bank_account_name: body?.bankAccountName ?? null,
        p_bank_account_number: body?.bankAccountNumber ?? null,
        p_other_bank_name: body?.otherBankName ?? null,
        p_actor: user.id,
      });
      if (error) {
        console.error("member-actions request_redemption failed:", error.message);
        return json({ error: "REDEMPTION_FAILED", message: error.message.replace(/^[A-Z_]+:\s*/, "") }, 400);
      }
      console.log("member-actions request_redemption", data?.status, points, type);
      return json({ ok: data?.status === "PENDING", redemption: data });
    }

    if (action === "convert_balance") {
      // Both directions go through the same audited database function, which
      // applies the configured rate and fee and moves both balances in one
      // transaction. Nothing is calculated here.
      const direction = String(body?.direction ?? "");
      const amount = Number(body?.amount ?? 0);
      const idempotencyKey = body?.idempotencyKey ? String(body.idempotencyKey) : null;

      const { data, error } = await svc.rpc("kmd_convert_balance", {
        p_member: user.id,
        p_direction: direction,
        p_amount: amount,
        p_actor: user.id,
        p_idempotency_key: idempotencyKey,
      });

      if (error) {
        console.error("member-actions convert_balance failed:", error.message);
        return json({ error: "CONVERSION_FAILED", message: error.message.replace(/^[A-Z_]+:\s*/, "") }, 400);
      }

      console.log("member-actions convert_balance ->", data?.status, direction, amount, data?.reference ?? "");
      return json({ ok: data?.status === "CONVERTED" || data?.status === "DUPLICATE", conversion: data });
    }

    if (action === "proof_url") {
      // A member may view the proof they submitted on their own order, and nothing else.
      const orderId = String(body?.orderId ?? "");
      const { data: order, error: orderError } = await svc
        .from("orders")
        .select("id, buyer_profile_id")
        .eq("id", orderId)
        .maybeSingle();

      if (orderError || !order) {
        return json({ error: "ORDER_NOT_FOUND", message: "Order not found" }, 404);
      }
      if (order.buyer_profile_id !== user.id) {
        return json({ error: "FORBIDDEN", message: "This order belongs to another member" }, 403);
      }

      const { data: proof, error: proofError } = await svc
        .from("payment_proofs")
        .select("proof_path")
        .eq("order_id", orderId)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (proofError) {
        console.error("member-actions proof_url lookup failed:", proofError.message);
        return json({ error: "PROOF_LOOKUP_FAILED", message: "Could not load the payment proof" }, 500);
      }
      if (!proof?.proof_path) {
        return json({ error: "NO_PROOF_FILE", message: "No payment proof file is attached to this order" }, 404);
      }

      const { data: signed, error: signError } = await svc.storage
        .from(BUCKET)
        .createSignedUrl(proof.proof_path, 3600);

      if (signError || !signed?.signedUrl) {
        console.error("member-actions proof_url signing failed:", signError?.message);
        return json({ error: "SIGNING_FAILED", message: "Could not create a secure link to the proof" }, 500);
      }

      return json({ ok: true, url: signed.signedUrl });
    }

    if (action === "update_profile") {
      const updates: Record<string, unknown> = {};
      if (typeof body?.mobile === "string") updates.mobile_number = body.mobile.trim();
      if (typeof body?.profilePhotoUrl === "string") updates.profile_photo_url = body.profilePhotoUrl.trim();

      if (Object.keys(updates).length === 0) {
        return json({ error: "VALIDATION", message: "Nothing to update" });
      }

      const { error } = await svc.from("profiles").update(updates).eq("id", user.id);
      if (error) {
        console.error("member-actions update_profile failed:", error.message);
        return json({ error: "UPDATE_FAILED", message: "Could not update the profile" }, 400);
      }
      return json({ ok: true, message: "Profile updated" });
    }

    return json({ error: "UNKNOWN_ACTION", message: `Unsupported action: ${action || "(none)"}` }, 400);
  } catch (error) {
    console.error("member-actions unexpected failure:", String(error));
    return json({ error: "UNEXPECTED", message: "Unexpected failure" }, 500);
  }
});
