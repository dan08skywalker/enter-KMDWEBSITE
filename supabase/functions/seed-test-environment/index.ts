// KMD EMPIRE · seed-test-environment
//
// Creates the required test roster in the live database, connected through real
// sponsor relationships, so the reward engine can be exercised for real:
//
//   buyer  -> L1 -> L2 -> L3 -> L4 -> L5      (the required five-level chain)
//   rdm buyer -> rdm sponsor                  (a clean wallet for the redemption test)
//   no-sponsor buyer                          (the missing-sponsor failure case)
//
// Every seeded row is flagged is_test so it can be excluded from production lists.
// Safe to run more than once: existing test members are reused, not duplicated.

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

// Deliberately shared test credentials: these accounts exist to demonstrate the
// reward chain and hold no real money.
const TEST_PASSWORD = "KmdTest2026";

type SeedSpec = {
  username: string;
  firstName: string;
  lastName: string;
  mobile: string;
  accountType: "member" | "retailer";
  sponsorUsername?: string;
};

// Order matters: a sponsor must exist before the member who references them.
const ROSTER: SeedSpec[] = [
  { username: "testsponsor5", firstName: "Test", lastName: "Sponsor L5", mobile: "09170000005", accountType: "member" },
  { username: "testsponsor4", firstName: "Test", lastName: "Sponsor L4", mobile: "09170000004", accountType: "member", sponsorUsername: "testsponsor5" },
  { username: "testsponsor3", firstName: "Test", lastName: "Sponsor L3", mobile: "09170000003", accountType: "member", sponsorUsername: "testsponsor4" },
  { username: "testsponsor2", firstName: "Test", lastName: "Sponsor L2", mobile: "09170000002", accountType: "member", sponsorUsername: "testsponsor3" },
  { username: "testsponsor1", firstName: "Test", lastName: "Sponsor L1", mobile: "09170000001", accountType: "retailer", sponsorUsername: "testsponsor2" },
  { username: "testbuyer", firstName: "Test", lastName: "Buyer", mobile: "09170000010", accountType: "member", sponsorUsername: "testsponsor1" },
  { username: "rdmsponsor", firstName: "Test", lastName: "Redemption Sponsor", mobile: "09170000020", accountType: "member", sponsorUsername: "testsponsor1" },
  { username: "rdmbuyer", firstName: "Test", lastName: "Redemption Buyer", mobile: "09170000021", accountType: "member", sponsorUsername: "rdmsponsor" },
  { username: "testloner", firstName: "Test", lastName: "Buyer No Sponsor", mobile: "09170000030", accountType: "member" },
];

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

    // Bootstrap rule: the super administrator seeds the environment. Before any
    // administrator exists, the first signed-in account may do it.
    const { data: hasAdmin } = await svc.rpc("kmd_has_super_admin");
    if (hasAdmin === true) {
      const { data: isAdmin } = await svc.rpc("kmd_is_admin", { p_user_id: authData.user.id });
      if (isAdmin !== true) {
        console.warn("seed-test-environment denied for non-administrator", authData.user.id);
        return json({ error: "FORBIDDEN", message: "Administrator access is required" }, 403);
      }
    }

    const byUsername = new Map<string, { id: string; member_code: string; account_status: string }>();
    const created: string[] = [];
    const reused: string[] = [];
    const failures: string[] = [];

    // Load any existing test members first so re-runs are idempotent.
    const { data: existing, error: existingError } = await svc
      .from("profiles")
      .select("id, username, member_code, account_status, is_test")
      .in("username", ROSTER.map((r) => r.username));
    if (existingError) {
      console.error("seed-test-environment roster lookup failed:", existingError.message);
      return json({ error: "SEED_FAILED", message: "Could not inspect existing test members" }, 500);
    }
    for (const row of existing ?? []) {
      byUsername.set(row.username, row);
    }

    for (const spec of ROSTER) {
      const already = byUsername.get(spec.username);
      if (already) {
        reused.push(spec.username);
      } else {
        const email = `${spec.username}@kmd-test.local`;
        const { data: createdUser, error: createError } = await svc.auth.admin.createUser({
          email,
          password: TEST_PASSWORD,
          email_confirm: true,
          user_metadata: { username: spec.username, first_name: spec.firstName, last_name: spec.lastName },
        });

        if (createError || !createdUser?.user) {
          const message = createError?.message ?? "unknown error";
          // A leftover auth user from an interrupted run: adopt it instead of failing.
          const { data: list } = await svc.auth.admin.listUsers();
          const found = list?.users?.find((u) => u.email?.toLowerCase() === email);
          if (!found) {
            console.error("seed-test-environment could not create", spec.username, message);
            failures.push(`${spec.username}: ${message}`);
            continue;
          }
          console.warn("seed-test-environment adopted existing auth user", spec.username);
          const { data: adopted, error: adoptError } = await svc.rpc("kmd_register_member", {
            p_user_id: found.id,
            p_email: email,
            p_username: spec.username,
            p_first_name: spec.firstName,
            p_last_name: spec.lastName,
            p_mobile: spec.mobile,
            p_sponsor_code: spec.sponsorUsername ? byUsername.get(spec.sponsorUsername)?.member_code ?? null : null,
            p_account_type: spec.accountType,
            p_is_test: true,
          });
          if (adoptError) {
            console.error("seed-test-environment adopt failed", spec.username, adoptError.message);
            failures.push(`${spec.username}: ${adoptError.message}`);
            continue;
          }
          const { data: adoptedProfile } = await svc
            .from("profiles")
            .select("id, member_code, account_status")
            .eq("id", found.id)
            .maybeSingle();
          if (adoptedProfile) {
            byUsername.set(spec.username, { ...adoptedProfile, username: spec.username });
          }
          created.push(spec.username);
          continue;
        }

        const sponsorCode = spec.sponsorUsername
          ? byUsername.get(spec.sponsorUsername)?.member_code ?? null
          : null;

        const { data: profile, error: registerError } = await svc.rpc("kmd_register_member", {
          p_user_id: createdUser.user.id,
          p_email: email,
          p_username: spec.username,
          p_first_name: spec.firstName,
          p_last_name: spec.lastName,
          p_mobile: spec.mobile,
          p_sponsor_code: sponsorCode,
          p_account_type: spec.accountType,
          p_is_test: true,
        });

        if (registerError) {
          console.error("seed-test-environment register failed", spec.username, registerError.message);
          await svc.auth.admin.deleteUser(createdUser.user.id);
          failures.push(`${spec.username}: ${registerError.message}`);
          continue;
        }

        byUsername.set(spec.username, {
          id: createdUser.user.id,
          member_code: profile?.memberCode ?? "",
          account_status: "pending",
        });
        created.push(spec.username);
      }

      // The whole test chain must be active, otherwise uplines are not qualified.
      const member = byUsername.get(spec.username);
      if (member && member.account_status !== "active") {
        const { error: activateError } = await svc.rpc("kmd_activate_member", {
          p_member: member.id,
          p_actor: authData.user.id,
          p_package_id: null,
          p_reason: "Test environment activation",
        });
        if (activateError) {
          console.error("seed-test-environment activation failed", spec.username, activateError.message);
        } else {
          member.account_status = "active";
        }
      }
    }

    // Rebuild the genealogy closure from the authoritative direct_sponsor_id.
    const { error: rebuildError } = await svc.rpc("kmd_rebuild_closure");
    if (rebuildError) {
      console.error("seed-test-environment closure rebuild failed:", rebuildError.message);
    }

    const { data: products, error: productError } = await svc
      .from("products")
      .select("id, sku, name, product_code");
    if (productError) {
      console.error("seed-test-environment product lookup failed:", productError.message);
    }

    const summary = ROSTER.map((spec) => {
      const member = byUsername.get(spec.username);
      return {
        username: spec.username,
        role: spec.lastName,
        memberCode: member?.member_code ?? null,
        accountStatus: member?.account_status ?? "missing",
        sponsorUsername: spec.sponsorUsername ?? null,
      };
    });

    console.log(
      `seed-test-environment done: created=${created.length} reused=${reused.length} failed=${failures.length}`,
    );

    return json({
      ok: failures.length === 0,
      password: TEST_PASSWORD,
      created,
      reused,
      failures,
      members: summary,
      products: products ?? [],
      message:
        failures.length === 0
          ? "Test environment ready"
          : "Test environment seeded with some failures - see failures",
    });
  } catch (error) {
    console.error("seed-test-environment unexpected failure:", String(error));
    return json({ error: "SEED_FAILED", message: "Unexpected failure" }, 500);
  }
});
