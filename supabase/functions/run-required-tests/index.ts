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

      // The Level 1 sponsor receives the 150 Level 1 bonus; the 20 Level 2 bonus
      // belongs to their own upline, so only 150 lands on this member's balance.
      const pass =
        loyalty.length === 1 &&
        Number(loyalty[0].credit_amount) === loyaltyAmount &&
        loyalty[0].beneficiary_member_code === l1.member_code &&
        loyaltyDelta === loyaltyAmount &&
        points.length === 2 &&
        pointsDelta === 150 &&
        points.every((row) => row.transaction_type === "UNILEVEL_BONUS");

      outcomes.push({
        test_key: "test_6_loyalty_credit",
        test_name: "Required Test #6 - A temporary Loyalty Credit posts to its own ledger and balance",
        expected:
          "Loyalty ledger row of 25 for the Level 1 sponsor, loyalty balance +25, and a separate unilevel ledger (+150 to Level 1, +20 to Level 2) that does not include the loyalty credit",
        actual: `loyaltyRows=${loyalty.length}, loyaltyAmount=${loyalty[0]?.credit_amount ?? "none"}, loyaltyBalanceDelta=${loyaltyDelta}, unilevelRows=${points.length}, unilevelBalanceDelta=${pointsDelta}`,
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
