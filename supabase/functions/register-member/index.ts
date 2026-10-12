// KMD EMPIRE · register-member
//
// Creates the auth account, then the member record (unique member code, sponsor
// link and level 1-5 genealogy closure) through the kmd_register_member database
// function. If the member record cannot be created, the freshly created auth user
// is deleted so a half-registered account can never survive.
//
// The first account created on an empty system is promoted to super administrator,
// which is how the platform obtains its first administrator.

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

/** Address parts, each optional: many countries use neither a province nor a postcode. */
const MAX_ADDRESS_PART = 120;
const MAX_POSTAL = 20;
const MAX_COUNTRY = 80;

const ERROR_CODES: Record<string, string> = {
  KMD_VALIDATION: "VALIDATION",
  KMD_DUPLICATE_USERNAME: "DUPLICATE_USERNAME",
  KMD_DUPLICATE_EMAIL: "DUPLICATE_EMAIL",
  KMD_DUPLICATE_PHONE: "DUPLICATE_PHONE",
  KMD_INVALID_SPONSOR: "INVALID_SPONSOR",
};

function toClientError(message: string) {
  const code = (message.split(":")[0] ?? "").trim();
  return {
    error: ERROR_CODES[code] ?? "REGISTRATION_FAILED",
    message: message.replace(/^[A-Z_]+:\s*/, ""),
  };
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
      return json({ error: "VALIDATION", message: "A registration payload is required" });
    }

    const firstName = String(body.firstName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    const mobile = String(body.mobile ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const username = String(body.username ?? "").trim();
    const password = String(body.password ?? "");
    const confirmPassword = String(body.confirmPassword ?? password);
    const sponsorCode = String(body.sponsorCode ?? "").trim();
    const accountType = body.accountType === "retailer" ? "retailer" : "member";

    // Address details. Nothing here is required, because a country that uses no
    // province or no postal code must still be able to register.
    const streetAddress = String(body.streetAddress ?? "").trim().slice(0, MAX_ADDRESS_PART);
    const city = String(body.city ?? "").trim().slice(0, MAX_ADDRESS_PART);
    const region = String(body.region ?? "").trim().slice(0, MAX_ADDRESS_PART);
    const postalCode = String(body.postalCode ?? "").trim().slice(0, MAX_POSTAL);
    const country = String(body.country ?? "").trim().slice(0, MAX_COUNTRY);

    if (!firstName) return json({ error: "VALIDATION", message: "First name is required" });
    if (!lastName) return json({ error: "VALIDATION", message: "Last name is required" });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return json({ error: "VALIDATION", message: "A valid email address is required" });
    }
    if (!/^[A-Za-z0-9._-]{3,32}$/.test(username)) {
      return json({
        error: "VALIDATION",
        message: "Username must be 3-32 characters using letters, numbers, dot, dash or underscore",
      });
    }
    if (mobile && !/^[0-9+\-\s()]{7,20}$/.test(mobile)) {
      return json({ error: "VALIDATION", message: "Mobile number format is not recognised" });
    }
    if (password.length < 6) {
      return json({ error: "VALIDATION", message: "Password must be at least 6 characters" });
    }
    if (!/^[A-Za-z0-9]+$/.test(password)) {
      return json({ error: "VALIDATION", message: "Password may contain letters and numbers only" });
    }
    if (password !== confirmPassword) {
      return json({ error: "VALIDATION", message: "Password and confirmation do not match" });
    }
    // Letters, numbers, spaces and hyphens: leading zeros and alphanumeric codes
    // are normal outside the Philippines.
    if (postalCode && !/^[A-Za-z0-9][A-Za-z0-9\s-]{0,19}$/.test(postalCode)) {
      return json({
        error: "VALIDATION",
        message: "ZIP or postal code may use letters, numbers, spaces and hyphens",
      });
    }
    if (country && !/^[A-Za-z][A-Za-z\s.'(),\-/]{0,79}$/.test(country)) {
      return json({ error: "VALIDATION", message: "Choose a country from the list" });
    }

    const svc = serviceClient();

    const { data: usernameFree, error: lookupError } = await svc.rpc("kmd_username_available", {
      p_username: username,
    });
    if (lookupError) {
      console.error("register-member username lookup failed:", lookupError.message);
      return json({ error: "REGISTRATION_FAILED", message: "Could not verify the username" }, 500);
    }
    if (usernameFree === false) {
      return json({ error: "DUPLICATE_USERNAME", message: "That username is already taken" });
    }

    if (sponsorCode) {
      const { data: sponsor, error: sponsorError } = await svc.rpc("kmd_sponsor_preview", {
        p_code: sponsorCode,
      });
      if (sponsorError) {
        console.error("register-member sponsor lookup failed:", sponsorError.message);
        return json({ error: "REGISTRATION_FAILED", message: "Could not verify the sponsor ID" }, 500);
      }
      if (!sponsor || sponsor.found !== true) {
        return json({ error: "INVALID_SPONSOR", message: "Sponsor ID does not exist" });
      }
    }

    const { data: created, error: createError } = await svc.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username, first_name: firstName, last_name: lastName, mobile },
    });

    if (createError || !created?.user) {
      const message = createError?.message ?? "Could not create the account";
      console.error("register-member auth create failed:", message);
      if (/already|exists|registered/i.test(message)) {
        return json({
        error: "DUPLICATE_EMAIL",
        message: "This email address already exists in the system.",
      });
      }
      return json({ error: "AUTH_CREATE_FAILED", message }, 400);
    }

    const userId = created.user.id;

    // The member record and its address are written in one transaction, so a
    // failure leaves neither behind.
    const { data: profile, error: registerError } = await svc.rpc("kmd_register_member_with_address", {
      p_user_id: userId,
      p_email: email,
      p_username: username,
      p_first_name: firstName,
      p_last_name: lastName,
      p_mobile: mobile,
      p_sponsor_code: sponsorCode || null,
      p_account_type: accountType,
      p_is_test: false,
      p_street_address: streetAddress || null,
      p_city: city || null,
      p_region: region || null,
      p_postal_code: postalCode || null,
      p_country: country || null,
    });

    if (registerError) {
      console.error("register-member member record failed:", registerError.message);
      const { error: cleanupError } = await svc.auth.admin.deleteUser(userId);
      if (cleanupError) {
        console.error("register-member cleanup failed for user", userId, cleanupError.message);
      }
      return json(toClientError(registerError.message), 400);
    }

    // Bootstrap: the very first account on an empty system becomes the super administrator.
    let bootstrapAdmin = false;
    const { data: hasAdmin, error: adminCheckError } = await svc.rpc("kmd_has_super_admin");
    if (adminCheckError) {
      console.error("register-member admin check failed:", adminCheckError.message);
    } else if (hasAdmin === false) {
      const { error: roleError } = await svc.rpc("kmd_set_member_role", {
        p_user_id: userId,
        p_role: "super_admin",
        p_actor: userId,
      });
      if (roleError) {
        console.error("register-member bootstrap role failed:", roleError.message);
      } else {
        bootstrapAdmin = true;
        console.log("register-member bootstrapped super administrator:", profile?.memberCode);
      }
    }

    console.log(
      "register-member created",
      profile?.memberCode,
      "sponsor:",
      sponsorCode || "none",
      "type:",
      accountType,
      "country:",
      country || "not given",
    );

    return json({ ok: true, ...profile, bootstrapAdmin });
  } catch (error) {
    console.error("register-member unexpected failure:", String(error));
    return json({ error: "REGISTRATION_FAILED", message: "Unexpected registration failure" }, 500);
  }
});
