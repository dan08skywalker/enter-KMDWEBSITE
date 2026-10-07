// KMD EMPIRE · run-required-tests
//
// Executes the required acceptance tests (#1-#7 from the build brief) against the
// real reward engine, using real database rows, and records every verdict with the
// evidence behind it in test_results.
//
// This does not fake anything: each test creates a real order, moves it through
// real payment states, calls the real reward engine and then reads the ledger back.

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

type Verdict = "PASS" | "FAIL" | "BLOCKED";

type TestOutcome = {
  test_key: string;
  test_name: string;
  expected: string;
  actual: string;
  verdict: Verdict;
  details: Record<string, unknown>;
};

function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Enter Cloud connection is missing ${name}`);
  return value;
}

type Svc = ReturnType<typeof createClient>;

function serviceClient(): Svc {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as Svc;
}

async function profileByUsername(svc: Svc, username: string) {
  const { data, error } = await svc
    .from("profiles")
    .select("id, username, member_code, account_status, direct_sponsor_id, is_test")
    .eq("username", username)
    .maybeSingle();
  if (error) throw new Error(`profile lookup failed for ${username}: ${error.message}`);
  if (!data) throw new Error(`profile not found for ${username} - run seed-test-environment first`);
  return data;
}

async function productBySku(svc: Svc, sku: string) {
  const { data, error } = await svc
    .from("products")
    .select("id, sku, name, selling_price, is_active")
    .eq("sku", sku)
    .maybeSingle();
  if (error) throw new Error(`product lookup failed for ${sku}: ${error.message}`);
  if (!data) throw new Error(`product not found for ${sku}`);
  return data;
}

async function createOrder(svc: Svc, buyerId: string, productId: string, quantity: number) {
  const { data, error } = await svc.rpc("kmd_create_order", {
    p_product_id: productId,
    p_quantity: quantity,
    p_buyer: buyerId,
  });
  if (error) throw new Error(`create_order failed: ${error.message}`);
  return data as { orderId: string; orderNumber: string; totalAmount: number };
}

async function submitProof(svc: Svc, orderId: string, memberId: string, isTest: boolean) {
  const { error: proofError } = await svc.from("payment_proofs").insert({
    order_id: orderId,
    member_id: memberId,
    method: "cash",
    reference_number: "TEST-RUN",
    amount: 0,
    status: "under_review",
    is_test: isTest,
  });
  if (proofError) throw new Error(`proof insert failed: ${proofError.message}`);
  const { error: statusError } = await svc.rpc("kmd_set_order_status", {
    p_order_id: orderId,
    p_status: "proof_submitted",
    p_actor: memberId,
    p_reason: "Required test run",
  });
  if (statusError) throw new Error(`proof status update failed: ${statusError.message}`);
}

async function confirmPayment(svc: Svc, orderId: string, actorId: string) {
  const { data, error } = await svc.rpc("kmd_confirm_payment", {
    p_order_id: orderId,
    p_actor: actorId,
    p_qualification_source: "payment_confirmed",
  });
  if (error) return { error: error.message, result: null as Record<string, unknown> | null };
  return { error: null, result: data as Record<string, unknown> };
}

async function runEngine(svc: Svc, orderId: string, actorId: string) {
  const { data, error } = await svc.rpc("kmd_process_qualified_purchase", {
    p_order_id: orderId,
    p_actor: actorId,
  });
  if (error) return { error: error.message, result: null as Record<string, unknown> | null };
  return { error: null, result: data as Record<string, unknown> };
}

async function ledgerRows(svc: Svc, orderId: string) {
  const { data, error } = await svc
    .from("point_ledger")
    .select("id, transaction_id, unilevel_level, points_per_unit, quantity, total_points, beneficiary_member_code, transaction_type, direction, status, sku")
    .eq("order_id", orderId)
    .order("unilevel_level", { ascending: true });
  if (error) throw new Error(`ledger read failed: ${error.message}`);
  return data ?? [];
}

async function loyaltyRows(svc: Svc, orderId: string) {
  const { data, error } = await svc
    .from("loyalty_credit_ledger")
    .select("id, transaction_id, beneficiary_member_code, credit_amount, direction, status")
    .eq("order_id", orderId);
  if (error) throw new Error(`loyalty ledger read failed: ${error.message}`);
  return data ?? [];
}

async function orderStatus(svc: Svc, orderId: string) {
  const { data, error } = await svc
    .from("orders")
    .select("id, status, rewards_processed")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(`order read failed: ${error.message}`);
  return data;
}

async function balances(svc: Svc, memberId: string) {
  const { data, error } = await svc.rpc("kmd_member_balances", { p_member: memberId });
  if (error) throw new Error(`balance read failed: ${error.message}`);
  return data as Record<string, number>;
}

async function updateRewardConfig(
  svc: Svc,
  productId: string,
  actorId: string,
  values: { l1?: number; l2?: number; l3?: number; l4?: number; l5?: number; loyalty?: number; loyaltyLevel?: number; isActive?: boolean },
) {
  const { data: current, error: readError } = await svc
    .from("reward_configurations")
    .select("*")
    .eq("product_id", productId)
    .maybeSingle();
  if (readError || !current) throw new Error(`reward configuration read failed: ${readError?.message}`);

  const { error } = await svc.rpc("kmd_update_reward_config", {
    p_product_id: productId,
    p_l1: values.l1 ?? current.level1_points,
    p_l2: values.l2 ?? current.level2_points,
    p_l3: values.l3 ?? current.level3_points,
    p_l4: values.l4 ?? current.level4_points,
    p_l5: values.l5 ?? current.level5_points,
    p_loyalty: values.loyalty ?? current.loyalty_credit,
    p_loyalty_level: values.loyaltyLevel ?? current.loyalty_beneficiary_level,
    p_is_active: values.isActive ?? current.is_active,
    p_actor: actorId,
  });
  if (error) throw new Error(`reward configuration update failed: ${error.message}`);
}

// ---- helpers for the storefront and reward-matrix tests ----

async function inventoryByProduct(svc: Svc, productId: string) {
  const { data, error } = await svc
    .from("inventory")
    .select("quantity_on_hand, reserved_quantity, low_stock_threshold, is_unlimited")
    .eq("product_id", productId)
    .maybeSingle();
  if (error) throw new Error(`inventory lookup failed: ${error.message}`);
  return data;
}

async function setStock(svc: Svc, productId: string, actorId: string, quantity: number) {
  const { data, error } = await svc.rpc("kmd_admin_set_stock", {
    p_actor: actorId,
    p_product_id: productId,
    p_quantity: quantity,
    p_note: "Required test run - temporary stock",
  });
  if (error) throw new Error(`set_stock failed: ${error.message}`);
  return data as Record<string, unknown>;
}

async function checkoutPlace(svc: Svc, payload: Record<string, unknown>) {
  const { data, error } = await svc.rpc("kmd_checkout_place_order", { p_payload: payload });
  if (error) return { error: error.message, result: null as Record<string, unknown> | null };
  return { error: null, result: data as Record<string, unknown> };
}

async function cancelOrder(svc: Svc, orderId: string, actorId: string) {
  if (!orderId) return;
  await svc.rpc("kmd_set_order_status", {
    p_order_id: orderId,
    p_status: "cancelled",
    p_actor: actorId,
    p_reason: "Required test run - releasing the reservation",
  });
}

/**
 * Puts one product back to a known stock state before a stock test runs.
 *
 * The suite is re-runnable: a previous run may have left a checkout holding a
 * reservation, and a held reservation legitimately blocks a stock reset. Every
 * held reservation for this product is released first, and the counter is then
 * cleared as a test fixture so the assertions start from a fixed baseline.
 */
async function resetStockState(svc: Svc, productId: string, actorId: string) {
  const { data: held } = await svc
    .from("stock_reservations")
    .select("id, order_id")
    .eq("product_id", productId)
    .eq("status", "held");

  for (const row of held ?? []) {
    await cancelOrder(svc, String(row.order_id), actorId);
  }

  await svc.from("inventory").update({ reserved_quantity: 0 }).eq("product_id", productId);
}

async function rewardConfigBySku(svc: Svc, sku: string) {
  const product = await productBySku(svc, sku);
  const { data, error } = await svc
    .from("reward_configurations")
    .select("*")
    .eq("product_id", product.id)
    .maybeSingle();
  if (error) throw new Error(`reward configuration lookup failed: ${error.message}`);
  return { productId: product.id, config: data as Record<string, unknown> | null };
}

async function orderRow(svc: Svc, orderId: string) {
  const { data, error } = await svc
    .from("orders")
    .select("id, order_number, status, customer_type, subtotal, shipping_fee, total_amount, is_shipping_quoted, rewards_processed, buyer_profile_id, guest_email, fulfillment_status")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(`order lookup failed: ${error.message}`);
  return data as Record<string, unknown> | null;
}

async function orderItemRows(svc: Svc, orderId: string) {
  const { data, error } = await svc
    .from("order_items")
    .select("sku, quantity, unit_price, line_total")
    .eq("order_id", orderId);
  if (error) throw new Error(`order item lookup failed: ${error.message}`);
  return (data ?? []) as Array<Record<string, unknown>>;
}

async function stockReservationRows(svc: Svc, orderId: string) {
  const { data, error } = await svc
    .from("stock_reservations")
    .select("id, product_id, quantity, status")
    .eq("order_id", orderId);
  if (error) throw new Error(`reservation lookup failed: ${error.message}`);
  return (data ?? []) as Array<Record<string, unknown>>;
}

async function saveZone(svc: Svc, actorId: string, payload: Record<string, unknown>) {
  const { data, error } = await svc.rpc("kmd_admin_upsert_delivery_zone", {
    p_actor: actorId,
    p_payload: payload,
  });
  if (error) throw new Error(`save_delivery_zone failed: ${error.message}`);
  return data as Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const outcomes: TestOutcome[] = [];
  const runId = crypto.randomUUID();

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

    const { data: isAdmin } = await svc.rpc("kmd_is_admin", { p_user_id: actorId });
    if (isAdmin !== true) {
      return json({ error: "FORBIDDEN", message: "Administrator access is required" }, 403);
    }

    const buyer = await profileByUsername(svc, "testbuyer");
    const l1 = await profileByUsername(svc, "testsponsor1");
    const l2 = await profileByUsername(svc, "testsponsor2");
    const loner = await profileByUsername(svc, "testloner");
    const rdmSponsor = await profileByUsername(svc, "rdmsponsor");
    const rdmBuyer = await profileByUsername(svc, "rdmbuyer");

    const trial = await productBySku(svc, "KMD-TRIAL-001");
    const dokudami = await productBySku(svc, "KMD-DOKUDAMI-001");

    // ================= TEST 1 - qualification timing =================
    try {
      const order = await createOrder(svc, buyer.id, trial.id, 1);

      const pending = await runEngine(svc, order.orderId, actorId);
      const ledgerWhilePending = (await ledgerRows(svc, order.orderId)).length;

      await submitProof(svc, order.orderId, buyer.id, true);
      const afterProof = await runEngine(svc, order.orderId, actorId);
      const ledgerAfterProof = (await ledgerRows(svc, order.orderId)).length;

      const confirmed = await confirmPayment(svc, order.orderId, actorId);
      const rows = await ledgerRows(svc, order.orderId);
      const level1 = rows.find((r) => r.unilevel_level === 1);
      const level2 = rows.find((r) => r.unilevel_level === 2);

      const pass =
        pending.result?.status === "NOT_QUALIFIED" &&
        ledgerWhilePending === 0 &&
        afterProof.result?.status === "NOT_QUALIFIED" &&
        ledgerAfterProof === 0 &&
        confirmed.result?.status === "PROCESSED" &&
        Number(level1?.total_points) === 150 &&
        Number(level2?.total_points) === 20;

      outcomes.push({
        test_key: "test_1_qualification_timing",
        test_name: "Required Test #1 - Pending purchase pays nothing until payment is confirmed",
        expected: "No rewards at pending_payment or proof_submitted; Level 1 = 150 and Level 2 = 20 after confirmation",
        actual: `pending=${pending.result?.status ?? pending.error}, afterProof=${afterProof.result?.status ?? afterProof.error}, confirmed=${confirmed.result?.status ?? confirmed.error}, ledgerRows=${rows.length}, L1=${level1?.total_points ?? "none"}, L2=${level2?.total_points ?? "none"}`,
        verdict: pass ? "PASS" : "FAIL",
        details: { orderNumber: order.orderNumber, pending, afterProof, confirmed, rows },
      });
    } catch (error) {
      outcomes.push({
        test_key: "test_1_qualification_timing",
        test_name: "Required Test #1 - Pending purchase pays nothing until payment is confirmed",
        expected: "No rewards before confirmation, rewards after",
        actual: String(error),
        verdict: "FAIL",
        details: {},
      });
    }

    // ================= TEST 2 - duplicate confirmation =================
    try {
      const order = await createOrder(svc, buyer.id, trial.id, 1);
      await submitProof(svc, order.orderId, buyer.id, true);
      const first = await confirmPayment(svc, order.orderId, actorId);
      const rowsAfterFirst = await ledgerRows(svc, order.orderId);
      const second = await confirmPayment(svc, order.orderId, actorId);
      const rowsAfterSecond = await ledgerRows(svc, order.orderId);

      const distinctKeys = new Set(rowsAfterSecond.map((r) => `${r.unilevel_level}:${r.beneficiary_member_code}`));

      const pass =
        second.result?.status === "ALREADY_PROCESSED" &&
        second.result?.reasonText === "REWARD ALREADY PROCESSED FOR THIS TRANSACTION" &&
        rowsAfterFirst.length === rowsAfterSecond.length &&
        distinctKeys.size === rowsAfterFirst.length;

      outcomes.push({
        test_key: "test_2_duplicate_confirmation",
        test_name: "Required Test #2 - Confirming the same order twice issues no duplicate rewards",
        expected: "Second confirmation returns REWARD ALREADY PROCESSED FOR THIS TRANSACTION and the ledger row count is unchanged",
        actual: `first=${first.result?.status ?? first.error}, second=${second.result?.status ?? second.error} (${second.result?.reasonText ?? "-"}), rows ${rowsAfterFirst.length} -> ${rowsAfterSecond.length}`,
        verdict: pass ? "PASS" : "FAIL",
        details: { orderNumber: order.orderNumber, rowsAfterFirst, rowsAfterSecond },
      });
    } catch (error) {
      outcomes.push({
        test_key: "test_2_duplicate_confirmation",
        test_name: "Required Test #2 - Confirming the same order twice issues no duplicate rewards",
        expected: "Zero duplicate rewards",
        actual: String(error),
        verdict: "FAIL",
        details: {},
      });
    }

    // ================= TEST 3 - quantity =================
    try {
      const order = await createOrder(svc, buyer.id, trial.id, 10);
      await submitProof(svc, order.orderId, buyer.id, true);
      await confirmPayment(svc, order.orderId, actorId);
      const rows = await ledgerRows(svc, order.orderId);
      const level1 = rows.find((r) => r.unilevel_level === 1);

      const pass =
        Number(level1?.points_per_unit) === 150 &&
        Number(level1?.quantity) === 10 &&
        Number(level1?.total_points) === 1500;

      outcomes.push({
        test_key: "test_3_quantity",
        test_name: "Required Test #3 - 10 Trial Pack Bundles pay Level 1 exactly 1,500 points",
        expected: "Level 1 = 10 x 150 = 1,500 points on the actual Point Ledger row",
        actual: `pointsPerUnit=${level1?.points_per_unit ?? "none"}, quantity=${level1?.quantity ?? "none"}, totalPoints=${level1?.total_points ?? "none"}`,
        verdict: pass ? "PASS" : "FAIL",
        details: { orderNumber: order.orderNumber, level1Row: level1 ?? null, allRows: rows },
      });
    } catch (error) {
      outcomes.push({
        test_key: "test_3_quantity",
        test_name: "Required Test #3 - 10 Trial Pack Bundles pay Level 1 exactly 1,500 points",
        expected: "Level 1 = 1,500 points",
        actual: String(error),
        verdict: "FAIL",
        details: {},
      });
    }

    // ================= TEST 4 - Dokudami reorder =================
    try {
      const order = await createOrder(svc, buyer.id, dokudami.id, 10);
      await submitProof(svc, order.orderId, buyer.id, true);
      await confirmPayment(svc, order.orderId, actorId);
      const rows = await ledgerRows(svc, order.orderId);
      const level1 = rows.find((r) => r.unilevel_level === 1);
      const level2 = rows.find((r) => r.unilevel_level === 2);

      const pass = Number(level1?.total_points) === 100 && Number(level2?.total_points) === 50;

      outcomes.push({
        test_key: "test_4_dokudami_reorder",
        test_name: "Required Test #4 - Dokudami reorder pays per qualified unit (10 x 10 and 10 x 5)",
        expected: "Level 1 = 100 points, Level 2 = 50 points",
        actual: `L1=${level1?.total_points ?? "none"}, L2=${level2?.total_points ?? "none"}, ledgerRows=${rows.length}`,
        verdict: pass ? "PASS" : "FAIL",
        details: { orderNumber: order.orderNumber, rows },
      });
    } catch (error) {
      outcomes.push({
        test_key: "test_4_dokudami_reorder",
        test_name: "Required Test #4 - Dokudami reorder pays per qualified unit (10 x 10 and 10 x 5)",
        expected: "Level 1 = 100, Level 2 = 50",
        actual: String(error),
        verdict: "FAIL",
        details: {},
      });
    }

    // ================= TEST 5 - broken transactions fail safely =================
    try {
      const cases: Record<string, unknown> = {};
      let allSafe = true;

      // 5a - SKU that does not match the reward configuration
      const skuOrder = await createOrder(svc, buyer.id, trial.id, 1);
      await submitProof(svc, skuOrder.orderId, buyer.id, true);
      const { data: item } = await svc
        .from("order_items")
        .select("id, sku")
        .eq("order_id", skuOrder.orderId)
        .maybeSingle();
      await svc.from("order_items").update({ sku: "KMD-NOT-A-REAL-SKU" }).eq("id", item!.id);
      const skuAttempt = await confirmPayment(svc, skuOrder.orderId, actorId);
      const skuLedger = (await ledgerRows(svc, skuOrder.orderId)).length;
      const skuStatus = await orderStatus(svc, skuOrder.orderId);
      await svc.from("order_items").update({ sku: item!.sku }).eq("id", item!.id);

      cases.invalidSku = {
        error: skuAttempt.error,
        ledgerRows: skuLedger,
        orderStatus: skuStatus?.status,
        safe: !!skuAttempt.error && skuLedger === 0 && skuStatus?.status !== "confirmed",
      };
      if (!(cases.invalidSku as { safe: boolean }).safe) allSafe = false;

      // 5b - buyer with no sponsor at all
      const lonerOrder = await createOrder(svc, loner.id, trial.id, 1);
      await submitProof(svc, lonerOrder.orderId, loner.id, true);
      const lonerAttempt = await confirmPayment(svc, lonerOrder.orderId, actorId);
      const lonerLedger = (await ledgerRows(svc, lonerOrder.orderId)).length;
      cases.missingSponsor = {
        status: lonerAttempt.result?.status ?? lonerAttempt.error,
        ledgerRows: lonerLedger,
        skipped: lonerAttempt.result?.skipped ?? null,
        safe: lonerAttempt.result?.status === "PROCESSED_NO_REWARDS" && lonerLedger === 0,
      };
      if (!(cases.missingSponsor as { safe: boolean }).safe) allSafe = false;

      // 5c - product deactivated after the order was placed
      const inactiveOrder = await createOrder(svc, buyer.id, trial.id, 1);
      await submitProof(svc, inactiveOrder.orderId, buyer.id, true);
      await svc.from("products").update({ is_active: false }).eq("id", trial.id);
      const inactiveAttempt = await confirmPayment(svc, inactiveOrder.orderId, actorId);
      const inactiveLedger = (await ledgerRows(svc, inactiveOrder.orderId)).length;
      const inactiveStatus = await orderStatus(svc, inactiveOrder.orderId);
      await svc.from("products").update({ is_active: true }).eq("id", trial.id);
      cases.inactiveProduct = {
        error: inactiveAttempt.error,
        ledgerRows: inactiveLedger,
        orderStatus: inactiveStatus?.status,
        safe: !!inactiveAttempt.error && inactiveLedger === 0 && inactiveStatus?.status !== "confirmed",
      };
      if (!(cases.inactiveProduct as { safe: boolean }).safe) allSafe = false;

      // 5d - reward configuration switched off
      await updateRewardConfig(svc, trial.id, actorId, { isActive: false });
      const configOrder = await createOrder(svc, buyer.id, trial.id, 1);
      await submitProof(svc, configOrder.orderId, buyer.id, true);
      const configAttempt = await confirmPayment(svc, configOrder.orderId, actorId);
      const configLedger = (await ledgerRows(svc, configOrder.orderId)).length;
      const configStatus = await orderStatus(svc, configOrder.orderId);
      await updateRewardConfig(svc, trial.id, actorId, { isActive: true });
      cases.missingConfiguration = {
        error: configAttempt.error,
        ledgerRows: configLedger,
        orderStatus: configStatus?.status,
        safe: !!configAttempt.error && configLedger === 0 && configStatus?.status !== "confirmed",
      };
      if (!(cases.missingConfiguration as { safe: boolean }).safe) allSafe = false;

      // 5e - reward attempt while payment is still unconfirmed
      const unconfirmedOrder = await createOrder(svc, buyer.id, trial.id, 1);
      const unconfirmedAttempt = await runEngine(svc, unconfirmedOrder.orderId, actorId);
      const unconfirmedLedger = (await ledgerRows(svc, unconfirmedOrder.orderId)).length;
      cases.unconfirmedPayment = {
        status: unconfirmedAttempt.result?.status ?? unconfirmedAttempt.error,
        reasonText: unconfirmedAttempt.result?.reasonText ?? null,
        ledgerRows: unconfirmedLedger,
        safe: unconfirmedAttempt.result?.status === "NOT_QUALIFIED" && unconfirmedLedger === 0,
      };
      if (!(cases.unconfirmedPayment as { safe: boolean }).safe) allSafe = false;

      outcomes.push({
        test_key: "test_5_broken_transaction",
        test_name: "Required Test #5 - Broken transactions fail safely with no partial rewards",
        expected:
          "Invalid SKU, missing sponsor, inactive product, missing configuration and unconfirmed payment each fail with a specific reason and zero new ledger rows",
        actual: allSafe
          ? "All five failure cases failed safely with no reward rows created"
          : "At least one failure case did not fail safely",
        verdict: allSafe ? "PASS" : "FAIL",
        details: cases,
      });
    } catch (error) {
      outcomes.push({
        test_key: "test_5_broken_transaction",
        test_name: "Required Test #5 - Broken transactions fail safely with no partial rewards",
        expected: "Safe failure on every broken case",
        actual: String(error),
        verdict: "FAIL",
        details: {},
      });
    }

    // ================= TEST 6 - loyalty credit =================
    try {
      const loyaltyAmount = 25;
      await updateRewardConfig(svc, trial.id, actorId, { loyalty: loyaltyAmount, loyaltyLevel: 1 });

      const before = await balances(svc, l1.id);
      const order = await createOrder(svc, buyer.id, trial.id, 1);
      await submitProof(svc, order.orderId, buyer.id, true);
      await confirmPayment(svc, order.orderId, actorId);

      const loyalty = await loyaltyRows(svc, order.orderId);
      const points = await ledgerRows(svc, order.orderId);
      const after = await balances(svc, l1.id);

      await updateRewardConfig(svc, trial.id, actorId, { loyalty: 0, loyaltyLevel: 1 });

      const loyaltyDelta = Number(after.loyaltyCredits) - Number(before.loyaltyCredits);
      const pointsDelta = Number(after.unilevelPoints) - Number(before.unilevelPoints);

      // With the complete matrix in force a Trial purchase pays all five levels
      // (150/20/10/5/5). Only the 150 Level 1 value belongs to this member, so the
      // other four rows are attributed to their own beneficiaries.
      const byLevel = new Map<number, number>();
      for (const row of points) {
        byLevel.set(Number(row.unilevel_level), Number(row.total_points));
      }
      const matrixPaid =
        points.length === 5 &&
        byLevel.get(1) === 150 &&
        byLevel.get(2) === 20 &&
        byLevel.get(3) === 10 &&
        byLevel.get(4) === 5 &&
        byLevel.get(5) === 5;

      const pass =
        loyalty.length === 1 &&
        Number(loyalty[0].credit_amount) === loyaltyAmount &&
        loyalty[0].beneficiary_member_code === l1.member_code &&
        loyaltyDelta === loyaltyAmount &&
        matrixPaid &&
        pointsDelta === 150 &&
        points.every((row) => row.transaction_type === "UNILEVEL_BONUS") &&
        // The loyalty credit must never appear in the unilevel ledger.
        points.every((row) => Number(row.total_points) !== loyaltyAmount);

      outcomes.push({
        test_key: "test_6_loyalty_credit",
        test_name: "Required Test #6 - A temporary Loyalty Credit posts to its own ledger and balance",
        expected:
          "Loyalty ledger row of 25 for the Level 1 sponsor and a loyalty balance of +25, while the unilevel ledger separately pays 150/20/10/5/5 across the five levels and never contains the loyalty credit",
        actual: `loyaltyRows=${loyalty.length}, loyaltyAmount=${loyalty[0]?.credit_amount ?? "none"}, loyaltyBalanceDelta=${loyaltyDelta}, unilevelRows=${points.length}, levels=${JSON.stringify([...byLevel.entries()])}, unilevelBalanceDelta=${pointsDelta}`,
        verdict: pass ? "PASS" : "FAIL",
        details: { orderNumber: order.orderNumber, loyaltyRows: loyalty, pointRows: points, before, after },
      });
    } catch (error) {
      outcomes.push({
        test_key: "test_6_loyalty_credit",
        test_name: "Required Test #6 - A temporary Loyalty Credit posts to its own ledger and balance",
        expected: "Loyalty ledger and balance update separately from unilevel points",
        actual: String(error),
        verdict: "FAIL",
        details: {},
      });
    }

    // ================= TEST 7 - redemption limits =================
    try {
      const fundOrder = await createOrder(svc, rdmBuyer.id, trial.id, 10);
      await submitProof(svc, fundOrder.orderId, rdmBuyer.id, true);
      await confirmPayment(svc, fundOrder.orderId, actorId);

      const starting = await balances(svc, rdmSponsor.id);
      const available = Number(starting.availablePoints);
      const excessive = available + 1000;

      const over = await svc.rpc("kmd_request_redemption", {
        p_member: rdmSponsor.id,
        p_points: excessive,
        p_redemption_type: "PAYOUT_GCASH",
        p_gcash_number: "09170000020",
        p_gcash_account_name: "Test Redemption Sponsor",
        p_actor: rdmSponsor.id,
      });

      const within = await svc.rpc("kmd_request_redemption", {
        p_member: rdmSponsor.id,
        p_points: 1000,
        p_redemption_type: "PAYOUT_BANK",
        p_bank_name: "BDO",
        p_bank_account_name: "Test Redemption Sponsor",
        p_bank_account_number: "1234567890",
        p_actor: rdmSponsor.id,
      });

      const afterRequest = await balances(svc, rdmSponsor.id);

      const overResult = over.data as Record<string, unknown> | null;
      const withinResult = within.data as Record<string, unknown> | null;

      const pass =
        !over.error &&
        overResult?.status === "REJECTED" &&
        overResult?.reason === "INSUFFICIENT_AVAILABLE_POINTS" &&
        !within.error &&
        withinResult?.status === "PENDING";

      outcomes.push({
        test_key: "test_7_redemption_limits",
        test_name: "Required Test #7 - A redemption above the available balance is rejected",
        expected:
          "A request above available points is REJECTED - INSUFFICIENT AVAILABLE POINTS; a request inside the balance is accepted. The brief's example is 1,500 available, 2,000 rejected, 1,000 accepted",
        actual: `availableAtStart=${available}, rejectedAttempt=${excessive} -> ${overResult?.reason ?? over.error ?? "none"}, acceptedAttempt=1000 -> ${withinResult?.status ?? within.error ?? "none"}, availableAfterHold=${afterRequest.availablePoints}`,
        verdict: pass ? "PASS" : "FAIL",
        details: {
          fundOrderNumber: fundOrder.orderNumber,
          starting,
          over: overResult ?? over.error,
          within: withinResult ?? within.error,
          afterRequest,
        },
      });
    } catch (error) {
      outcomes.push({
        test_key: "test_7_redemption_limits",
        test_name: "Required Test #7 - A redemption above the available balance is rejected",
        expected: "Over-balance redemption rejected, in-balance redemption accepted",
        actual: String(error),
        verdict: "FAIL",
        details: {},
      });
    }

    // ================= TEST 8 - authoritative reward matrix =================
    try {
      const dok = await rewardConfigBySku(svc, "KMD-DOKUDAMI-001");
      const classic = await rewardConfigBySku(svc, "KMD-CLASSIC-001");
      const gold = await rewardConfigBySku(svc, "KMD-GOLD-001");
      const platinum = await rewardConfigBySku(svc, "KMD-PLATINUM-001");

      const matches = (
        config: Record<string, unknown> | null,
        expected: number[],
        loyalty: number,
      ) =>
        !!config &&
        Number(config.level1_points) === expected[0] &&
        Number(config.level2_points) === expected[1] &&
        Number(config.level3_points) === expected[2] &&
        Number(config.level4_points) === expected[3] &&
        Number(config.level5_points) === expected[4] &&
        Number(config.loyalty_credit) === loyalty;

      const storedOk =
        matches(dok.config, [10, 5, 5, 5, 5], 0) &&
        matches(classic.config, [300, 40, 20, 10, 10], 2) &&
        matches(gold.config, [600, 100, 40, 20, 20], 4) &&
        matches(platinum.config, [5000, 300, 150, 100, 50], 30);

      // A live run against DOK-REORDER as a MEMBER (a guest order correctly earns
      // nothing, so it cannot demonstrate the matrix): Level 1 must pay 10 and
      // Level 2 must pay 5, with no Loyalty Credit for a reorder.
      const place = await createOrder(svc, buyer.id, dok.productId, 1);
      await submitProof(svc, place.orderId, buyer.id, true);
      const confirm = await confirmPayment(svc, place.orderId, actorId);
      const points = await ledgerRows(svc, place.orderId);
      const loyalty = await loyaltyRows(svc, place.orderId);

      const byLevel = new Map<number, number>();
      for (const row of points) {
        byLevel.set(Number(row.unilevel_level), Number(row.total_points));
      }

      const liveOk =
        byLevel.get(1) === 10 &&
        byLevel.get(2) === 5 &&
        byLevel.get(3) === 5 &&
        byLevel.get(4) === 5 &&
        byLevel.get(5) === 5 &&
        loyalty.length === 0 &&
        confirm.result?.status === "PROCESSED";

      outcomes.push({
        test_key: "test_8_reward_matrix",
        test_name: "Required Test #8 - The authoritative reward matrix is stored and applied exactly",
        expected:
          "DOK-REORDER 10/5/5/5/5 with 0 loyalty, Trial 150/20/10/5/5 with 0, Classic 300/40/20/10/10 with 2, Gold 600/100/40/20/20 with 4, Platinum 5000/300/150/100/50 with 30. A DOK-REORDER purchase pays Level 1 = 10 and Level 2 = 5 with no Loyalty Credit.",
        actual: `storedMatrixCorrect=${storedOk}, liveLedgerRows=${points.length}, levels=${JSON.stringify([...byLevel.entries()])}, loyaltyRows=${loyalty.length}, engineStatus=${confirm.result?.status ?? "none"}`,
        verdict: storedOk && liveOk ? "PASS" : "FAIL",
        details: {
          orderNumber: place.orderNumber,
          dokudami: dok.config,
          classic: classic.config,
          gold: gold.config,
          platinum: platinum.config,
          pointRows: points,
          loyaltyRows: loyalty,
        },
      });
    } catch (error) {
      outcomes.push({
        test_key: "test_8_reward_matrix",
        test_name: "Required Test #8 - The authoritative reward matrix is stored and applied exactly",
        expected: "Stored values match the supplied matrix and pay correctly",
        actual: String(error),
        verdict: "FAIL",
        details: {},
      });
    }

    // ================= TEST 9 - Level 2-5 loyalty is always zero =================
    try {
      const { data: allConfigs, error: configError } = await svc
        .from("reward_configurations")
        .select("product_id, loyalty_beneficiary_level, loyalty_credit");
      if (configError) throw new Error(configError.message);

      const rows = allConfigs ?? [];
      const everyRowPinsLoyaltyToLevel1 = rows.every(
        (row) => Number(row.loyalty_beneficiary_level) === 1,
      );

      // Try to move the loyalty beneficiary to Level 5. The database must refuse.
      const classic = await rewardConfigBySku(svc, "KMD-CLASSIC-001");
      const illegal = await svc.rpc("kmd_update_reward_config", {
        p_product_id: classic.productId,
        p_l1: 300,
        p_l2: 40,
        p_l3: 20,
        p_l4: 10,
        p_l5: 10,
        p_loyalty: 2,
        p_loyalty_level: 5,
        p_is_active: true,
        p_actor: actorId,
      });

      const after = await rewardConfigBySku(svc, "KMD-CLASSIC-001");
      const stillOnLevel1 = Number(after.config?.loyalty_beneficiary_level) === 1;

      const pass = everyRowPinsLoyaltyToLevel1 && !!illegal.error && stillOnLevel1;

      outcomes.push({
        test_key: "test_9_loyalty_only_level1",
        test_name: "Required Test #9 - Loyalty Credits can never be paid below Level 1",
        expected:
          "Every reward configuration pins the loyalty beneficiary to Level 1, and an attempt to set Level 5 is refused by the database with the stored value unchanged",
        actual: `configsChecked=${rows.length}, allPinnedToLevel1=${everyRowPinsLoyaltyToLevel1}, level5Attempt=${illegal.error ? "refused" : "ACCEPTED"}, valueAfterAttempt=${after.config?.loyalty_beneficiary_level}`,
        verdict: pass ? "PASS" : "FAIL",
        details: { refusedWith: illegal.error?.message ?? null, configs: rows },
      });
    } catch (error) {
      outcomes.push({
        test_key: "test_9_loyalty_only_level1",
        test_name: "Required Test #9 - Loyalty Credits can never be paid below Level 1",
        expected: "Level 2-5 loyalty is impossible",
        actual: String(error),
        verdict: "FAIL",
        details: {},
      });
    }

    // ================= TEST 10 - stock is reserved and cannot be oversold =======
    try {
      const dok = await rewardConfigBySku(svc, "KMD-DOKUDAMI-001");
      await resetStockState(svc, dok.productId, actorId);
      await setStock(svc, dok.productId, actorId, 1);
      const beforeInv = await inventoryByProduct(svc, dok.productId);

      const tooMany = await checkoutPlace(svc, {
        items: [{ sku: "KMD-DOKUDAMI-001", quantity: 2 }],
        contactName: "Test Buyer",
        contactPhone: "09170000001",
        contactEmail: "testbuyer@example.com",
      });

      const first = await checkoutPlace(svc, {
        items: [{ sku: "KMD-DOKUDAMI-001", quantity: 1 }],
        contactName: "Test Buyer",
        contactPhone: "09170000001",
        contactEmail: "testbuyer@example.com",
      });
      const firstOrderId = String(first.result?.orderId ?? "");

      const afterFirst = await inventoryByProduct(svc, dok.productId);
      const reservations = firstOrderId ? await stockReservationRows(svc, firstOrderId) : [];

      const second = await checkoutPlace(svc, {
        items: [{ sku: "KMD-DOKUDAMI-001", quantity: 1 }],
        contactName: "Test Buyer",
        contactPhone: "09170000001",
        contactEmail: "testbuyer@example.com",
      });

      const rejectedOversell = tooMany.result?.reason === "INSUFFICIENT_STOCK";
      const reservedOnce =
        Number(afterFirst?.reserved_quantity) === 1 &&
        reservations.length === 1 &&
        reservations[0].status === "held";
      const secondRefused = second.result?.reason === "INSUFFICIENT_STOCK";
      const neverNegative =
        Number(beforeInv?.quantity_on_hand ?? 0) === 1 &&
        Number(afterFirst?.quantity_on_hand ?? 0) === 1;

      // Release the held reservation so the reset cannot be refused by the
      // reserved-stock guard, and so the next test starts from a known state.
      await cancelOrder(svc, firstOrderId, actorId);
      await setStock(svc, dok.productId, actorId, 0);

      const pass = rejectedOversell && reservedOnce && secondRefused && neverNegative;

      outcomes.push({
        test_key: "test_10_no_oversell",
        test_name: "Required Test #10 - Stock is reserved at checkout and can never be oversold",
        expected:
          "With 1 unit on hand, a quantity of 2 is refused, a quantity of 1 is accepted and reserves exactly 1 unit, and a second attempt for 1 is refused. On-hand stock never goes negative before payment is confirmed.",
        actual: `qty2=${tooMany.result?.reason ?? tooMany.error ?? "none"}, qty1=${first.result?.status ?? first.error ?? "none"}, reservedAfterFirst=${afterFirst?.reserved_quantity}, reservations=${reservations.length}, secondAttempt=${second.result?.reason ?? second.error ?? "none"}`,
        verdict: pass ? "PASS" : "FAIL",
        details: { before: beforeInv, afterFirst, reservations, tooMany: tooMany.result, second: second.result },
      });
    } catch (error) {
      outcomes.push({
        test_key: "test_10_no_oversell",
        test_name: "Required Test #10 - Stock is reserved at checkout and can never be oversold",
        expected: "Reservation prevents overselling",
        actual: String(error),
        verdict: "FAIL",
        details: {},
      });
    }

    // ================= TEST 11 - shipping quote honesty ========================
    try {
      const { data: zones } = await svc
        .from("delivery_zones")
        .select("id, name, shipping_fee, is_configured, is_active")
        .eq("is_active", true)
        .order("sort_order");

      const zoneList = (zones ?? []) as Array<{
        id: string;
        name: string;
        shipping_fee: number;
        is_configured: boolean;
      }>;
      const unconfigured = zoneList.find((zone) => !zone.is_configured) ?? null;

      if (!unconfigured) {
        outcomes.push({
          test_key: "test_11_shipping_quote",
          test_name: "Required Test #11 - An area without an owner-supplied fee is never charged a guessed amount",
          expected: "A delivery area exists that still has no verified fee",
          actual: "Every active delivery area is already configured, so the pending-fee path could not be exercised",
          verdict: "BLOCKED",
          details: { zones: zoneList },
        });
      } else {
        const dok = await rewardConfigBySku(svc, "KMD-DOKUDAMI-001");
        // A sellable quantity must exist for both halves of this test.
        await resetStockState(svc, dok.productId, actorId);
        await setStock(svc, dok.productId, actorId, 8);

        const pending = await checkoutPlace(svc, {
          items: [{ sku: "KMD-DOKUDAMI-001", quantity: 1 }],
          contactName: "Test Buyer",
          contactPhone: "09170000001",
          contactEmail: "testbuyer@example.com",
          deliveryZoneId: unconfigured.id,
        });
        const pendingRow = pending.result?.orderId
          ? await orderRow(svc, String(pending.result.orderId))
          : null;

        const pendingOk =
          pending.result?.status === "CREATED" &&
          pending.result?.shippingQuoted === false &&
          Number(pending.result?.shippingFee ?? -1) === 0 &&
          pendingRow?.is_shipping_quoted === false;

        await cancelOrder(svc, String(pending.result?.orderId ?? ""), actorId);

        // Now give the area a real fee and confirm checkout quotes it.
        const fee = 137;
        await saveZone(svc, actorId, {
          id: unconfigured.id,
          name: unconfigured.name,
          shippingFee: fee,
          isConfigured: true,
        });

        const quoted = await checkoutPlace(svc, {
          items: [{ sku: "KMD-DOKUDAMI-001", quantity: 1 }],
          contactName: "Test Buyer",
          contactPhone: "09170000001",
          contactEmail: "testbuyer@example.com",
          deliveryZoneId: unconfigured.id,
        });

        const quotedOk =
          quoted.result?.status === "CREATED" &&
          quoted.result?.shippingQuoted === true &&
          Number(quoted.result?.shippingFee) === fee &&
          Number(quoted.result?.totalAmount) ===
            Number(quoted.result?.subtotal) + fee;

        await cancelOrder(svc, String(quoted.result?.orderId ?? ""), actorId);

        await saveZone(svc, actorId, {
          id: unconfigured.id,
          name: unconfigured.name,
          shippingFee: 0,
          isConfigured: false,
        });
        await setStock(svc, dok.productId, actorId, 0);

        outcomes.push({
          test_key: "test_11_shipping_quote",
          test_name: "Required Test #11 - An area without an owner-supplied fee is never charged a guessed amount",
          expected:
            "An unconfigured area accepts the order with shippingQuoted=false and a shipping fee of 0. Once the owner saves a fee the same checkout quotes it exactly and adds it to the total.",
          actual: `area=${unconfigured.name}, pendingOrderShippingQuoted=${pending.result?.shippingQuoted}, pendingFee=${pending.result?.shippingFee}, configuredOrderFee=${quoted.result?.shippingFee}, configuredTotal=${quoted.result?.totalAmount}`,
          verdict: pendingOk && quotedOk ? "PASS" : "FAIL",
          details: { pending: pending.result, pendingRow, quoted: quoted.result, fee },
        });
      }
    } catch (error) {
      outcomes.push({
        test_key: "test_11_shipping_quote",
        test_name: "Required Test #11 - An area without an owner-supplied fee is never charged a guessed amount",
        expected: "Shipping quote pending until the owner sets a fee",
        actual: String(error),
        verdict: "FAIL",
        details: {},
      });
    }

    // ================= TEST 12 - server-side pricing ==========================
    try {
      const dok = await rewardConfigBySku(svc, "KMD-DOKUDAMI-001");
      await resetStockState(svc, dok.productId, actorId);
      await setStock(svc, dok.productId, actorId, 5);

      // The client claims the item costs 1 peso and passes a bogus total.
      const tampered = await checkoutPlace(svc, {
        items: [{ sku: "KMD-DOKUDAMI-001", quantity: 2, unitPrice: 1, lineTotal: 2 }],
        unitPrice: 1,
        total: 2,
        contactName: "Test Buyer",
        contactPhone: "09170000001",
        contactEmail: "testbuyer@example.com",
      });

      const orderId = String(tampered.result?.orderId ?? "");
      const items = orderId ? await orderItemRows(svc, orderId) : [];
      const row = orderId ? await orderRow(svc, orderId) : null;
      const { data: product } = await svc
        .from("products")
        .select("selling_price")
        .eq("id", dok.productId)
        .maybeSingle();
      const cataloguePrice = Number(product?.selling_price ?? 0);

      const pass =
        tampered.result?.status === "CREATED" &&
        items.length === 1 &&
        Number(items[0].unit_price) === cataloguePrice &&
        Number(items[0].line_total) === cataloguePrice * 2 &&
        Number(row?.subtotal) === cataloguePrice * 2;

      await cancelOrder(svc, orderId, actorId);
      await setStock(svc, dok.productId, actorId, 0);

      outcomes.push({
        test_key: "test_12_server_side_pricing",
        test_name: "Required Test #12 - Prices always come from the server, never from the request",
        expected:
          "A request that claims a unit price of 1 is ignored: the order item and the order total use the catalogue selling price instead",
        actual: `claimedUnitPrice=1, storedUnitPrice=${items[0]?.unit_price ?? "none"}, cataloguePrice=${cataloguePrice}, storedSubtotal=${row?.subtotal ?? "none"}`,
        verdict: pass ? "PASS" : "FAIL",
        details: { orderNumber: tampered.result?.orderNumber ?? null, items, row },
      });
    } catch (error) {
      outcomes.push({
        test_key: "test_12_server_side_pricing",
        test_name: "Required Test #12 - Prices always come from the server, never from the request",
        expected: "Client-supplied prices are ignored",
        actual: String(error),
        verdict: "FAIL",
        details: {},
      });
    }

    // ================= TEST 13 - rejection releases stock, guest earns nothing ==
    try {
      const dok = await rewardConfigBySku(svc, "KMD-DOKUDAMI-001");
      await resetStockState(svc, dok.productId, actorId);
      await setStock(svc, dok.productId, actorId, 3);

      // 13a - a rejected order returns its reservation and posts no rewards.
      const rejectOrder = await checkoutPlace(svc, {
        items: [{ sku: "KMD-DOKUDAMI-001", quantity: 2 }],
        contactName: "Test Buyer",
        contactPhone: "09170000001",
        contactEmail: "testbuyer@example.com",
      });
      const rejectOrderId = String(rejectOrder.result?.orderId ?? "");

      const duringHold = await inventoryByProduct(svc, dok.productId);
      const rejected = await svc.rpc("kmd_reject_payment", {
        p_order_id: rejectOrderId,
        p_actor: actorId,
        p_reason: "Required test run",
      });
      const afterRelease = await inventoryByProduct(svc, dok.productId);
      const rejectLedger = await ledgerRows(svc, rejectOrderId);
      const releaseReservations = await stockReservationRows(svc, rejectOrderId);

      const releaseOk =
        Number(duringHold?.reserved_quantity) === 2 &&
        Number(afterRelease?.reserved_quantity) === 0 &&
        releaseReservations.every((row) => row.status === "released") &&
        rejectLedger.length === 0;

      // 13b - a guest order earns no unilevel rewards but is processed explicitly.
      const guest = await checkoutPlace(svc, {
        items: [{ sku: "KMD-DOKUDAMI-001", quantity: 1 }],
        contactName: "Guest Shopper",
        contactPhone: "09170000099",
        contactEmail: "guest@example.com",
      });
      const guestOrderId = String(guest.result?.orderId ?? "");
      const guestConfirm = await confirmPayment(svc, guestOrderId, actorId);
      const guestRow = await orderRow(svc, guestOrderId);
      const guestLedger = await ledgerRows(svc, guestOrderId);

      const guestOk =
        guest.result?.customerType === "guest" &&
        guestRow?.customer_type === "guest" &&
        guestRow?.buyer_profile_id === null &&
        guestLedger.length === 0 &&
        guestConfirm.result?.reason === "GUEST_PURCHASE_NO_REWARDS" &&
        guestRow?.rewards_processed === true;

      await setStock(svc, dok.productId, actorId, 0);

      outcomes.push({
        test_key: "test_13_release_and_guest",
        test_name:
          "Required Test #13 - A rejected order releases its stock, and a guest purchase posts no unilevel rewards",
        expected:
          "Rejecting an order that held 2 units returns the reservation to the shelf and creates no ledger rows. A guest order is recorded as a guest with no member buyer, posts no rewards, and is explicitly marked processed so nothing is silently skipped.",
        actual: `reservedDuringHold=${duringHold?.reserved_quantity}, reservedAfterReject=${afterRelease?.reserved_quantity}, reservations=${releaseReservations.map((r) => r.status).join(",") || "none"}, rejectLedgerRows=${rejectLedger.length}, guestCustomerType=${guestRow?.customer_type}, guestLedgerRows=${guestLedger.length}, guestReason=${guestConfirm.result?.reason ?? "none"}, guestRewardsProcessed=${guestRow?.rewards_processed}`,
        verdict: releaseOk && guestOk ? "PASS" : "FAIL",
        details: {
          rejectOrderNumber: rejectOrder.result?.orderNumber ?? null,
          guestOrderNumber: guest.result?.orderNumber ?? null,
          duringHold,
          afterRelease,
          releaseReservations,
          guestRow,
          guestConfirm: guestConfirm.result,
        },
      });
    } catch (error) {
      outcomes.push({
        test_key: "test_13_release_and_guest",
        test_name:
          "Required Test #13 - A rejected order releases its stock, and a guest purchase posts no unilevel rewards",
        expected: "Stock released and no rewards for a rejected or guest order",
        actual: String(error),
        verdict: "FAIL",
        details: {},
      });
    }

    // ================= TEST 14 - membership activation on approval =================
    try {
      const { data: trialPackage } = await svc
        .from("membership_packages")
        .select("id, package_code, name")
        .eq("product_id", trial.id)
        .maybeSingle();
      const packageId = String(trialPackage?.id ?? "");

      // Fixture: a registered member who has not been activated yet.
      await svc
        .from("profiles")
        .update({ account_status: "pending", activation_date: null, package_id: null })
        .eq("id", loner.id);

      const order = await createOrder(svc, loner.id, trial.id, 1);
      await submitProof(svc, order.orderId, loner.id, true);
      const confirmed = await confirmPayment(svc, order.orderId, actorId);

      const { data: activated } = await svc
        .from("profiles")
        .select("account_status, package_id, activation_date")
        .eq("id", loner.id)
        .maybeSingle();

      const confirmedAgain = await confirmPayment(svc, order.orderId, actorId);

      const pass =
        (confirmed.result?.status === "PROCESSED" ||
          confirmed.result?.status === "PROCESSED_NO_REWARDS") &&
        (confirmed.result?.membership as Record<string, unknown> | undefined)?.activated === true &&
        activated?.account_status === "active" &&
        activated?.package_id === packageId &&
        activated?.activation_date != null &&
        confirmedAgain.result?.status === "ALREADY_PROCESSED";

      // Fixture restored: the buyer returns to its plain test state.
      await svc.from("profiles").update({ package_id: null }).eq("id", loner.id);

      outcomes.push({
        test_key: "test_14_membership_activation",
        test_name:
          "Required Test #14 - Approving a membership payment activates the member and can never do it twice",
        expected:
          "A pending member who buys a membership package becomes active with that package assigned in the same transaction as the payment approval. Approving the same payment again returns ALREADY_PROCESSED and changes nothing.",
        actual: `confirm=${confirmed.result?.status ?? confirmed.error}, membershipActivated=${String((confirmed.result?.membership as Record<string, unknown> | undefined)?.activated)}, accountStatusAfter=${activated?.account_status}, packageAssigned=${activated?.package_id === packageId}, activationDateSet=${activated?.activation_date != null}, secondApproval=${confirmedAgain.result?.status ?? confirmedAgain.error}`,
        verdict: pass ? "PASS" : "FAIL",
        details: {
          orderNumber: order.orderNumber,
          expectedPackageId: packageId,
          confirmed: confirmed.result,
          confirmedAgain: confirmedAgain.result,
          profileAfter: activated,
        },
      });
    } catch (error) {
      outcomes.push({
        test_key: "test_14_membership_activation",
        test_name:
          "Required Test #14 - Approving a membership payment activates the member and can never do it twice",
        expected: "The buyer becomes active with the purchased package in the same transaction",
        actual: String(error),
        verdict: "FAIL",
        details: {},
      });
    }

    // ---- persist every outcome ----
    const rows = outcomes.map((outcome) => ({
      run_id: runId,
      test_key: outcome.test_key,
      test_name: outcome.test_name,
      expected: outcome.expected,
      actual: outcome.actual,
      verdict: outcome.verdict,
      details: outcome.details,
    }));

    const { error: insertError } = await svc.from("test_results").insert(rows);
    if (insertError) {
      console.error("run-required-tests could not record results:", insertError.message);
    }

    const passed = outcomes.filter((o) => o.verdict === "PASS").length;
    console.log(`run-required-tests ${runId}: ${passed}/${outcomes.length} passed`);

    return json({
      ok: passed === outcomes.length,
      runId,
      passed,
      total: outcomes.length,
      results: outcomes,
    });
  } catch (error) {
    console.error("run-required-tests unexpected failure:", String(error));
    return json({ error: "TEST_RUN_FAILED", message: String(error) }, 500);
  }
});
