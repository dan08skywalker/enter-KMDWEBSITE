import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { invokeFunction } from "@/lib/kmd/invoke";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Profile } from "@/lib/kmd/types";

const MEMBER_CODE_PATTERN = /^KMD-\d{4}-\d{4}-\d{4}-\d{4}$/;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MOBILE_PATTERN = /^[0-9+\-\s()]{7,20}$/;

interface LoadedDetails {
  profile: Pick<
    Profile,
    | "id"
    | "member_code"
    | "first_name"
    | "last_name"
    | "full_name"
    | "mobile_number"
    | "email"
    | "contact_email"
    | "street_address"
    | "city"
    | "region"
    | "postal_code"
    | "country"
  >;
  loginEmail: string | null;
  loginEmailMatchesProfile: boolean;
}

interface FormState {
  firstName: string;
  lastName: string;
  mobile: string;
  contactEmail: string;
  memberCode: string;
  loginEmail: string;
  changeLoginEmail: boolean;
}

interface Changes {
  firstName?: { from: string; to: string };
  lastName?: { from: string; to: string };
  mobile?: { from: string; to: string };
  contactEmail?: { from: string; to: string };
  memberCode?: { from: string; to: string };
  loginEmail?: { from: string; to: string };
}

const FIELD_LABELS: Record<string, string> = {
  firstName: "First name",
  lastName: "Last name",
  mobile: "Contact / phone number",
  contactEmail: "Contact email",
  memberCode: "Displayed member ID",
  loginEmail: "Login email (used to sign in)",
};

/**
 * Administrator edit of a member's own details.
 *
 * Deliberately narrow: names, phone, the contact address, the displayed member ID
 * and (as a separate, explicitly opted-in action) the login email. Roles, sponsor
 * placement, balances and every ledger record are untouched by this form.
 */
export function MemberDetailsDialog({
  member,
  onOpenChange,
  onSaved,
}: {
  member: Profile | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState<LoadedDetails | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [step, setStep] = useState<"edit" | "review">("edit");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (memberId: string) => {
    setLoading(true);
    setError(null);
    setStep("edit");

    const outcome = await invokeFunction<{ ok?: boolean; result?: LoadedDetails }>("admin-actions", {
      action: "member_details",
      memberId,
    });
    setLoading(false);

    if (!outcome.ok || !outcome.data?.result) {
      setError(outcome.error ?? "Could not load the member details");
      setLoaded(null);
      setForm(null);
      return;
    }

    const result = outcome.data.result;
    setLoaded(result);
    setForm({
      firstName: result.profile.first_name ?? "",
      lastName: result.profile.last_name ?? "",
      mobile: result.profile.mobile_number ?? "",
      contactEmail: result.profile.contact_email ?? "",
      memberCode: result.profile.member_code ?? "",
      loginEmail: result.loginEmail ?? result.profile.email ?? "",
      changeLoginEmail: false,
    });
  }, []);

  useEffect(() => {
    if (member) void load(member.id);
    else {
      setLoaded(null);
      setForm(null);
      setError(null);
    }
  }, [member, load]);

  /** Client-side mirror of the server rules, so problems surface before saving. */
  const validation = useMemo(() => {
    if (!form) return { ok: false, problems: [] as string[] };
    const problems: string[] = [];

    if (!form.firstName.trim()) problems.push("A first name is required.");
    if (!form.lastName.trim()) problems.push("A last name is required.");
    if (form.mobile.trim() && !MOBILE_PATTERN.test(form.mobile.trim())) {
      problems.push("The phone number is not in a recognised format.");
    }
    if (form.contactEmail.trim() && !EMAIL_PATTERN.test(form.contactEmail.trim())) {
      problems.push("The contact email address is not valid.");
    }
    if (!MEMBER_CODE_PATTERN.test(form.memberCode.trim().toUpperCase())) {
      problems.push("The member ID must look like KMD-0000-0000-0000-0000.");
    }
    if (form.changeLoginEmail) {
      if (!EMAIL_PATTERN.test(form.loginEmail.trim())) {
        problems.push("The login email address is not valid.");
      } else if (form.loginEmail.trim().toLowerCase() === (loaded?.loginEmail ?? "").toLowerCase()) {
        problems.push("The login email is unchanged, so there is nothing to update.");
      }
    }

    return { ok: problems.length === 0, problems };
  }, [form, loaded]);

  const changes = useMemo<Changes>(() => {
    if (!form || !loaded) return {};
    const result: Changes = {};
    const trim = (value: string) => value.trim();

    if (trim(form.firstName) !== (loaded.profile.first_name ?? "")) {
      result.firstName = { from: loaded.profile.first_name ?? "", to: trim(form.firstName) };
    }
    if (trim(form.lastName) !== (loaded.profile.last_name ?? "")) {
      result.lastName = { from: loaded.profile.last_name ?? "", to: trim(form.lastName) };
    }
    if (trim(form.mobile) !== (loaded.profile.mobile_number ?? "")) {
      result.mobile = { from: loaded.profile.mobile_number ?? "", to: trim(form.mobile) };
    }
    if (trim(form.contactEmail) !== (loaded.profile.contact_email ?? "")) {
      result.contactEmail = { from: loaded.profile.contact_email ?? "", to: trim(form.contactEmail) };
    }
    if (form.memberCode.trim().toUpperCase() !== (loaded.profile.member_code ?? "")) {
      result.memberCode = { from: loaded.profile.member_code ?? "", to: form.memberCode.trim().toUpperCase() };
    }
    if (form.changeLoginEmail && form.loginEmail.trim().toLowerCase() !== (loaded.loginEmail ?? "").toLowerCase()) {
      result.loginEmail = { from: loaded.loginEmail ?? "(none)", to: form.loginEmail.trim().toLowerCase() };
    }

    return result;
  }, [form, loaded]);

  const changedKeys = Object.keys(changes);

  const save = async () => {
    if (!form || !member) return;
    if (!validation.ok) {
      setError(validation.problems[0] ?? "Please correct the highlighted fields.");
      setStep("edit");
      return;
    }

    setBusy(true);
    setError(null);

    const outcome = await invokeFunction<{
      ok?: boolean;
      reasonText?: string;
      changed?: string[];
      downlineReferencesRepointed?: number;
      loginEmail?: { requested: boolean; changed?: boolean; reason?: string; loginEmail?: string };
    }>("admin-actions", {
      action: "update_member_details",
      memberId: member.id,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      mobile: form.mobile.trim(),
      contactEmail: form.contactEmail.trim(),
      memberCode: form.memberCode.trim().toUpperCase(),
      changeLoginEmail: form.changeLoginEmail,
      loginEmail: form.loginEmail.trim().toLowerCase(),
    });
    setBusy(false);

    if (!outcome.ok) {
      setError(outcome.error ?? "The member details could not be saved");
      return;
    }

    const loginEmail = outcome.data?.loginEmail;
    const profileUnchanged = outcome.data?.reasonText === "No details were changed";
    const loginChanged = loginEmail?.requested === true && loginEmail.changed === true;
    const loginFailed = loginEmail?.requested === true && loginEmail.changed === false;

    if (loginFailed) {
      // The profile edits may have saved, but the login address did not change.
      // Say that plainly rather than implying the sign-in address was updated.
      toast.warning(
        profileUnchanged
          ? "The login email was not changed"
          : "Member details saved, but the login email was not changed",
        { description: loginEmail?.reason ?? "The authentication provider rejected the change." },
      );
    } else if (loginChanged) {
      toast.success(
        profileUnchanged ? "Login email changed" : "Member details and login email updated",
        {
          description: "The profile address was moved with the login account, so signing in still resolves.",
        },
      );
    } else if (profileUnchanged) {
      toast.info("No details were changed");
      onOpenChange(false);
      return;
    } else {
      toast.success("Member details updated", {
        description:
          outcome.data?.downlineReferencesRepointed
            ? `Member ID changed; ${outcome.data.downlineReferencesRepointed} downline sponsor reference(s) re-pointed.`
            : undefined,
      });
    }

    onSaved();
    onOpenChange(false);
  };

  const set = (patch: Partial<FormState>) => setForm((current) => (current ? { ...current, ...patch } : current));

  return (
    <Dialog open={member !== null} onOpenChange={(open) => !busy && onOpenChange(open)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit member details</DialogTitle>
          <DialogDescription>
            {member ? `${loaded?.profile.full_name ?? member.full_name} · ${member.member_code}` : ""}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-10 w-full" />
            ))}
          </div>
        ) : !form || !loaded ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive">
            {error ?? "The member details could not be loaded."}
          </p>
        ) : step === "edit" ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="md-first">First name</Label>
                <Input
                  id="md-first"
                  value={form.firstName}
                  onChange={(event) => set({ firstName: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="md-last">Last name</Label>
                <Input
                  id="md-last"
                  value={form.lastName}
                  onChange={(event) => set({ lastName: event.target.value })}
                />
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              The full name shown across the site is derived from these two fields, so it stays in step
              automatically.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="md-mobile">Contact / phone number</Label>
                <Input
                  id="md-mobile"
                  inputMode="tel"
                  value={form.mobile}
                  onChange={(event) => set({ mobile: event.target.value })}
                  placeholder="09XX XXX XXXX"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="md-contact-email">Contact email</Label>
                <Input
                  id="md-contact-email"
                  type="email"
                  value={form.contactEmail}
                  onChange={(event) => set({ contactEmail: event.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              The contact email is a reachable address on the member record. It is not used to sign in.
            </p>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="md-code">Displayed member ID</Label>
              <Input
                id="md-code"
                value={form.memberCode}
                onChange={(event) => set({ memberCode: event.target.value.toUpperCase() })}
                className="font-mono"
                placeholder="KMD-0000-0000-0000-0000"
              />
              <p className="text-[11px] text-muted-foreground">
                Format KMD-0000-0000-0000-0000. The ID must be unique, and the automatic numbering is
                moved past any number you choose so a future registration can never collide with it.
              </p>
            </div>

            <Separator />

            <div className="space-y-3">
              <div>
                <p className="kmd-label">Login email (used to sign in)</p>
                <p className="mt-1 font-mono text-sm">{loaded.loginEmail ?? "No login account email"}</p>
                {loaded.loginEmail && !loaded.loginEmailMatchesProfile ? (
                  <p className="mt-1 flex items-start gap-1.5 text-[11px] text-[hsl(var(--warning))]">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    The login account and the profile record currently hold different addresses.
                  </p>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="md-change-login"
                  checked={form.changeLoginEmail}
                  onCheckedChange={(checked) => set({ changeLoginEmail: checked })}
                />
                <Label htmlFor="md-change-login" className="cursor-pointer text-sm">
                  Also change the login email
                </Label>
              </div>

              {form.changeLoginEmail ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="md-login-email">New login email</Label>
                    <Input
                      id="md-login-email"
                      type="email"
                      value={form.loginEmail}
                      onChange={(event) => set({ loginEmail: event.target.value })}
                    />
                  </div>
                  <p className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-[11px]">
                    This changes the account used to sign in and is applied through the authentication
                    provider, which confirms it immediately (the same way registration does) so the member
                    is not locked out waiting for an email. The profile record is moved with it, because
                    signing in resolves the username to that address.
                  </p>
                </>
              ) : null}
            </div>

            {error ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive">
                {error}
              </p>
            ) : null}

            {/* The address the member entered when they registered. Shown for the
                record; empty parts mean the country uses none. */}
            <div className="rounded-lg border bg-muted/30 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Address on record
              </h3>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["Street Address", loaded.profile.street_address],
                    ["City", loaded.profile.city],
                    ["Province / State / Region", loaded.profile.region],
                    ["ZIP / Postal Code", loaded.profile.postal_code],
                    ["Country", loaded.profile.country],
                  ] as Array<[string, string | null]>
                ).map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {label}
                    </dt>
                    <dd className={value ? "mt-0.5 break-words text-xs" : "mt-0.5 text-xs text-muted-foreground"}>
                      {value ?? "Not provided"}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {!validation.ok ? (
              <ul className="space-y-1 text-[11px] text-destructive">
                {validation.problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Review the change before it is saved. Only these fields are affected.
            </p>

            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-muted-foreground">
                      Field
                    </th>
                    <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-muted-foreground">
                      Current
                    </th>
                    <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-muted-foreground">
                      New
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {changedKeys.length === 0 ? (
                    <tr className="border-t">
                      <td colSpan={3} className="px-3 py-3 text-muted-foreground">
                        Nothing has been changed yet.
                      </td>
                    </tr>
                  ) : (
                    changedKeys.map((key) => {
                      const change = changes[key as keyof Changes]!;
                      return (
                        <tr key={key} className="border-t align-top">
                          <td className="px-3 py-2 font-medium">{FIELD_LABELS[key] ?? key}</td>
                          <td className="px-3 py-2 text-muted-foreground line-through">
                            {change.from || "(empty)"}
                          </td>
                          <td className="px-3 py-2 font-semibold">{change.to || "(empty)"}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {changes.memberCode ? (
              <p className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-[11px]">
                Changing the member ID updates the live sponsor reference on every member this member
                sponsors. Orders, ledger entries, payments and audit records keep the ID as it was
                recorded at the time, so no financial history is rewritten — only the identity shown for
                this member going forward.
              </p>
            ) : null}

            {changes.loginEmail ? (
              <p className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-[11px]">
                The login email change is applied to the authentication account and the profile record
                together. If the provider rejects it, the details above are still saved and you will be
                told the login email was not changed.
              </p>
            ) : null}

            {error ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive">
                {error}
              </p>
            ) : null}
          </div>
        )}

        <DialogFooter>
          {step === "edit" ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy || loading}>
                Cancel
              </Button>
              <Button
                onClick={() => setStep("review")}
                disabled={busy || loading || !form || changedKeys.length === 0}
              >
                Review changes
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("edit")} disabled={busy}>
                Back
              </Button>
              <Button onClick={() => void save()} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Confirm and save
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
