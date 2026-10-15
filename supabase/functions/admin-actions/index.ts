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

    // Payment decisions release money and run the reward engine, so they are
    // reserved for a super administrator. Like the role check above, this is a
    // database fact re-read on every call - never a client claim.
    if (action === "confirm_payment" || action === "reject_payment") {
      const { data: isSuperAdmin, error: superError } = await svc.rpc("kmd_is_super_admin", {
        p_user_id: actorId,
      });
      if (superError) {
        console.error("admin-actions super administrator check failed:", superError.message);
        return json({ error: "AUTHORIZATION_FAILED", message: "Could not verify your rights" }, 500);
      }
      if (isSuperAdmin !== true) {
        console.warn("admin-actions denied payment decision for non-super-administrator", actorId);
        return json(
          { error: "FORBIDDEN", message: "Only a super administrator can approve or reject a payment" },
          403,
        );
      }
    }

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

      case "set_member_status":
        return run("kmd_set_member_status", {
          p_member: String(body?.memberId ?? ""),
          p_status: String(body?.status ?? ""),
          p_actor: actorId,
          p_reason: reason ?? "Membership status changed by administrator",
        });

      case "delete_member": {
        // Deletion is guarded in the database function: it refuses when records
        // that must be kept would be destroyed, and returns the specific reason.
        const memberId = String(body?.memberId ?? "");
        const { data, error } = await svc.rpc("kmd_delete_member", {
          p_member: memberId,
          p_actor: actorId,
          p_reason: reason ?? null,
          p_confirm_code: body?.confirmCode ? String(body.confirmCode) : null,
        });

        if (error) {
          console.error("admin-actions delete_member failed:", error.message);
          return json({ error: "ACTION_FAILED", message: error.message.replace(/^[A-Z_]+:\s*/, "") }, 400);
        }

        if (data?.status !== "DELETED") {
          console.log("admin-actions delete_member refused:", data?.reason, data?.reasonText);
          return json({ ok: false, result: data });
        }

        // The member record is gone, so remove the sign-in as well. Otherwise the
        // account could still authenticate against a profile that no longer exists.
        let signInRemoved = true;
        const { error: authError } = await svc.auth.admin.deleteUser(memberId);
        if (authError) {
          signInRemoved = false;
          console.error("admin-actions delete_member could not remove the sign-in:", authError.message);
        }

        console.log("admin-actions delete_member ->", data?.memberCode, "signInRemoved:", signInRemoved);
        return json({ ok: true, result: { ...data, signInRemoved } });
      }

      case "member_details": {
        // The login address lives on the authentication account, not in the
        // profile, so the edit form needs both to show the difference.
        const memberId = String(body?.memberId ?? "");
        const { data: profile, error: profileError } = await svc
          .from("profiles")
          .select(
            "id, member_code, first_name, last_name, full_name, mobile_number, email, contact_email, account_status, is_test, street_address, city, region, postal_code, country",
          )
          .eq("id", memberId)
          .maybeSingle();

        if (profileError) {
          console.error("admin-actions member_details failed:", profileError.message);
          return json({ error: "MEMBER_LOOKUP_FAILED", message: "Could not load the member record" }, 500);
        }
        if (!profile) {
          return json({ error: "MEMBER_NOT_FOUND", message: "Member record not found" }, 404);
        }

        const { data: authUser, error: authError } = await svc.auth.admin.getUserById(memberId);
        if (authError) {
          console.error("admin-actions member_details could not read the login account:", authError.message);
        }

        return json({
          ok: true,
          result: {
            profile,
            loginEmail: authUser?.user?.email ?? null,
            loginEmailConfirmedAt: authUser?.user?.email_confirmed_at ?? null,
            loginEmailMatchesProfile: (authUser?.user?.email ?? null) === profile.email,
          },
        });
      }

      case "update_member_details": {
        const memberId = String(body?.memberId ?? "");
        const wantsLoginEmailChange = body?.changeLoginEmail === true;
        const newLoginEmail = String(body?.loginEmail ?? "").trim().toLowerCase();

        if (wantsLoginEmailChange && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newLoginEmail)) {
          return json({ error: "INVALID_LOGIN_EMAIL", message: "Enter a valid login email address" }, 400);
        }

        // 1. Names, phone, contact address and the displayed member ID, in one
        //    audited database transaction.
        const { data, error } = await svc.rpc("kmd_admin_update_member_details", {
          p_member: memberId,
          p_actor: actorId,
          p_first_name: body?.firstName ?? null,
          p_last_name: body?.lastName ?? null,
          p_mobile: body?.mobile ?? null,
          p_contact_email: body?.contactEmail ?? null,
          p_member_code: body?.memberCode ?? null,
        });

        if (error) {
          console.error("admin-actions update_member_details failed:", error.message);
          return json({ error: "ACTION_FAILED", message: error.message.replace(/^[A-Z_]+:\s*/, "") }, 400);
        }
        if (data?.status === "FAILED") {
          return json({ ok: false, result: data });
        }

        // 2. The login email is a change to the authentication account, so it goes
        //    through the provider's admin API rather than the profile table.
        let loginEmail: Record<string, unknown> = { requested: false };
        if (wantsLoginEmailChange) {
          const { data: before } = await svc.auth.admin.getUserById(memberId);
          const previousLoginEmail = before?.user?.email ?? null;

          const { data: updated, error: authError } = await svc.auth.admin.updateUserById(memberId, {
            email: newLoginEmail,
            // Confirmed immediately, matching how registration works, so the
            // member is never locked out waiting on a mail round-trip.
            email_confirm: true,
          });

          if (authError) {
            console.error("admin-actions login email change failed:", authError.message);
            loginEmail = {
              requested: true,
              changed: false,
              previousLoginEmail,
              reason: authError.message,
            };
            await svc.rpc("kmd_audit", {
              p_actor: actorId,
              p_action: "LOGIN_EMAIL_CHANGE_FAILED",
              p_target_member: memberId,
              p_entity: "auth.users",
              p_entity_id: memberId,
              p_previous: { email: previousLoginEmail },
              p_new: { email: newLoginEmail },
              p_reason: "Login email change failed: " + authError.message,
            });
          } else {
            // Sign-in resolves a username through profiles.email, so the profile
            // address has to move with the account or the member cannot sign in.
            const { error: syncError } = await svc
              .from("profiles")
              .update({ email: newLoginEmail })
              .eq("id", memberId);

            if (syncError) {
              console.error("admin-actions login email changed but the profile address did not:", syncError.message);
            }

            loginEmail = {
              requested: true,
              changed: true,
              previousLoginEmail,
              loginEmail: updated?.user?.email ?? newLoginEmail,
              profileSynced: !syncError,
            };

            await svc.rpc("kmd_audit", {
              p_actor: actorId,
              p_action: "LOGIN_EMAIL_CHANGE",
              p_target_member: memberId,
              p_entity: "auth.users",
              p_entity_id: memberId,
              p_previous: { email: previousLoginEmail },
              p_new: { email: newLoginEmail, profileSynced: !syncError },
              p_reason: "Login email changed by administrator" + (syncError ? " - profile address NOT synced" : ""),
            });
          }
        }

        console.log("admin-actions update_member_details ->", data?.memberCode, "loginEmail:", loginEmail);
        return json({ ok: true, result: { ...data, loginEmail } });
      }

      case "adjust_points":
        // The reason is deliberately not defaulted: the database refuses an
        // adjustment without one, and it is stored on the ledger entry. The
        // idempotency key makes a retried submission recognisable, so a double
        // click cannot post the same adjustment twice.
        return run("kmd_adjust_points", {
          p_member: String(body?.memberId ?? ""),
          p_points: Number(body?.points ?? 0),
          p_direction: String(body?.direction ?? "CREDIT"),
          p_reason: reason,
          p_actor: actorId,
          p_idempotency_key: body?.idempotencyKey ? String(body.idempotencyKey) : null,
        });

      case "adjust_loyalty_credits":
        // The reason is deliberately not defaulted: the database refuses an
        // adjustment without one, and it is stored on the ledger entry.
        return run("kmd_adjust_loyalty_credits", {
          p_member: String(body?.memberId ?? ""),
          p_amount: Number(body?.amount ?? 0),
          p_direction: String(body?.direction ?? "CREDIT"),
          p_reason: reason,
          p_actor: actorId,
          p_idempotency_key: body?.idempotencyKey ? String(body.idempotencyKey) : null,
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
          p_l6: Number(body?.level6 ?? 0),
          p_l7: Number(body?.level7 ?? 0),
          p_l8: Number(body?.level8 ?? 0),
          p_l9: Number(body?.level9 ?? 0),
          p_l10: Number(body?.level10 ?? 0),
          p_loyalty: Number(body?.loyaltyCredit ?? 0),
          p_loyalty_level: Number(body?.loyaltyBeneficiaryLevel ?? 1),
          p_is_active: body?.isActive !== false,
          p_actor: actorId,
        });

      case "pricing_matrix":
        return run("kmd_admin_pricing_matrix", { p_actor: actorId });

      case "set_member_price":
        // One matrix cell. The database validates the amount, records the previous
        // and new value with the actor and timestamp, and bumps the pricing version.
        return run("kmd_admin_set_member_price", {
          p_actor: actorId,
          p_product_id: String(body?.productId ?? ""),
          p_category: String(body?.category ?? ""),
          p_price: Number(body?.price ?? 0),
        });

      case "level1_caps":
        return run("kmd_admin_level1_caps", { p_actor: actorId });

      case "set_level1_cap":
        // One package cap. Validated, audited with the previous value, and applied
        // only to future qualifying transactions.
        return run("kmd_admin_set_level1_cap", {
          p_actor: actorId,
          p_package_id: String(body?.packageId ?? ""),
          p_cap_amount:
            body?.capAmount === undefined || body?.capAmount === null || body?.capAmount === ""
              ? null
              : Number(body.capAmount),
        });

      case "reward_status":
        // The same authoritative reward status for every screen that shows it.
        return run("kmd_admin_reward_status", {
          p_actor: actorId,
          p_order_ids: Array.isArray(body?.orderIds) ? body.orderIds.map(String) : [],
        });

      case "reward_integrity":
        // Administrator review: duplicates, missing labels, incomplete orders.
        return run("kmd_admin_reward_integrity", { p_actor: actorId });

      case "duplicate_contacts":
        return run("kmd_duplicate_contacts", { p_actor: actorId });

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

      case "refund_wallet_payment": {
        // Returns money to the same member's Shopping Wallet. The database
        // function refuses a second refund of the same amount, so a double click
        // or a retried request cannot pay the member twice.
        const paymentId = String(body?.paymentId ?? "");
        const amount = body?.amount === undefined || body?.amount === null ? 0 : Number(body.amount);

        const { data, error } = await svc.rpc("kmd_refund_wallet_payment", {
          p_payment_id: paymentId,
          p_amount: amount,
          p_actor: actorId,
          p_reason: reason,
          p_idempotency_key: body?.idempotencyKey ? String(body.idempotencyKey) : null,
        });

        if (error) {
          console.error("admin-actions refund_wallet_payment failed:", error.message);
          return json({ error: "ACTION_FAILED", message: error.message.replace(/^[A-Z_]+:\s*/, "") }, 400);
        }

        if (data?.status !== "REFUNDED") {
          console.log("admin-actions refund_wallet_payment refused:", data?.reason, data?.reasonText);
          return json({ ok: false, result: data });
        }

        console.log("admin-actions refund_wallet_payment ->", data.reference, data.amount, data.orderNumber);
        return json({ ok: true, result: data });
      }

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

      // ---- storefront catalogue, stock, delivery and payment accounts ----

      case "save_product":
        return run("kmd_admin_upsert_product", {
          p_actor: actorId,
          p_payload: body?.payload ?? {},
        });

      case "set_product_visibility":
        // Visibility on its own, so hiding a product never touches its stock.
        return run("kmd_set_product_visibility", {
          p_product_id: String(body?.productId ?? ""),
          p_is_active: body?.isActive === true,
          p_actor: actorId,
          p_reason: reason ?? null,
        });

      case "set_stock":
        return run("kmd_admin_set_stock", {
          p_actor: actorId,
          p_product_id: String(body?.productId ?? ""),
          p_quantity: Number(body?.quantity ?? 0),
          p_note: reason ?? "Stock adjusted by administrator",
          p_low_stock_threshold:
            body?.lowStockThreshold === undefined || body?.lowStockThreshold === null
              ? null
              : Number(body.lowStockThreshold),
          p_is_unlimited:
            body?.isUnlimited === undefined || body?.isUnlimited === null
              ? null
              : body.isUnlimited === true,
        });

      case "save_delivery_zone":
        return run("kmd_admin_upsert_delivery_zone", {
          p_actor: actorId,
          p_payload: body?.payload ?? {},
        });

      case "save_payment_account":
        return run("kmd_admin_upsert_payment_account", {
          p_actor: actorId,
          p_payload: body?.payload ?? {},
        });

      case "review_payment_account":
        return run("kmd_admin_review_payment_account", {
          p_actor: actorId,
          p_account_id: String(body?.accountId ?? ""),
          p_verified: body?.verified === true,
          p_flag_reason: reason,
        });

      case "set_fulfillment":
        return run("kmd_admin_set_fulfillment", {
          p_actor: actorId,
          p_order_id: String(body?.orderId ?? ""),
          p_status: String(body?.status ?? ""),
          p_courier: body?.courier ?? null,
          p_tracking: body?.trackingNumber ?? null,
          p_note: reason,
        });

      case "set_bundle":
        return run("kmd_admin_set_bundle", {
          p_actor: actorId,
          p_bundle_product_id: String(body?.bundleProductId ?? ""),
          p_components: body?.components ?? [],
        });

      case "save_content":
        return run("kmd_admin_upsert_content", {
          p_actor: actorId,
          p_payload: body?.payload ?? {},
        });

      case "update_ticket":
        return run("kmd_admin_ticket_update", {
          p_actor: actorId,
          p_ticket_id: String(body?.ticketId ?? ""),
          p_status: body?.status ?? null,
          p_priority: body?.priority ?? null,
          p_assigned_to: body?.assignedTo ? String(body.assignedTo) : null,
        });

      // ---- KMD Digital Solutions: listings, client requests and quotations ----

      case "save_digital_offering":
        // The published listing copy, prices and recurring fees. The database
        // validates the figures and records the previous and new values.
        return run("kmd_admin_digital_offering_save", {
          p_actor: actorId,
          p_payload: body?.payload ?? {},
        });

      case "update_client_request":
        // Queue movement only: the client's submitted details are never rewritten.
        return run("kmd_admin_client_request_update", {
          p_actor: actorId,
          p_request_id: String(body?.requestId ?? ""),
          p_status: body?.status ? String(body.status) : null,
          p_notes: body?.notes ? String(body.notes) : null,
        });

      case "save_quotation":
        // Every total is recalculated inside the database function from the line
        // items, so the saved record cannot disagree with what is printed.
        return run("kmd_admin_quotation_save", {
          p_actor: actorId,
          p_payload: body?.payload ?? {},
        });

      case "readiness":
        return run("kmd_readiness_report", {});

      case "export_data":
        return run("kmd_admin_export", {
          p_actor: actorId,
          p_dataset: String(body?.dataset ?? ""),
          p_filters: body?.filters ?? {},
        });

      case "support_attachment_url": {
        // Support attachments and payment proofs live in private buckets, so staff
        // receive a short-lived signed link instead of a public object URL.
        const path = String(body?.path ?? "");
        const bucket = String(body?.bucket ?? "support-attachments");
        if (!path) {
          return json({ error: "MISSING_PATH", message: "An object path is required" }, 400);
        }
        const { data: signed, error: signError } = await svc.storage
          .from(bucket)
          .createSignedUrl(path, 3600);

        if (signError || !signed?.signedUrl) {
          console.error("admin-actions support_attachment_url signing failed:", signError?.message);
          return json({ error: "SIGNING_FAILED", message: "Could not create a secure link" }, 500);
        }
        return json({ ok: true, url: signed.signedUrl });
      }

      case "proof_url": {        // Proof files live in a private bucket, so the administrator is handed a
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
