import { useEffect, useState } from "react";
import { Database, Loader2, Save, Settings as SettingsIcon, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { invokeFunction } from "@/lib/kmd/invoke";
import { PageHeader } from "@/components/kmd/page-header";
import { StatusBadge } from "@/components/kmd/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { formatDateTime, formatPeso } from "@/lib/kmd/format";
import { MEMBER_ID_FORMAT, UNILEVEL_LEVELS } from "@/lib/kmd/constants";
import type { SystemSetting } from "@/lib/kmd/types";

interface EditableSetting {
  key: string;
  label: string;
  description: string;
  kind: "number" | "text";
  /** Smallest accepted value for a number. Defaults to above zero. */
  min?: number;
}

const EDITABLE: EditableSetting[] = [
  {
    key: "point_to_peso_rate",
    label: "Point to peso rate",
    description: "Monetary value of one Unilevel point. Default 1 POINT = PHP 1.",
    kind: "number",
    min: 0.01,
  },
  {
    key: "max_unilevel_levels",
    label: "Unilevel levels traced",
    description: "How many levels the reward engine walks up the sponsor chain. Default 5.",
    kind: "number",
    min: 1,
  },
  {
    key: "currency_code",
    label: "Currency code",
    description: "Display currency for peso equivalents.",
    kind: "text",
  },
  {
    key: "wallet_conversion_rate",
    label: "Wallet conversion rate",
    description:
      "Shopping Wallet units received per 1 Unilevel point. Members convert at this rate in both directions (the reverse direction uses its inverse). Set 0 to keep conversions disabled.",
    kind: "number",
    min: 0,
  },
  {
    key: "wallet_conversion_fee_percent",
    label: "Wallet conversion fee (%)",
    description:
      "Percentage retained on each Shopping Wallet conversion. 0 means no fee. The fee is shown to the member before they confirm.",
    kind: "number",
    min: 0,
  },
];

export default function AdminSettings() {
  const { isSuperAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [seedBusy, setSeedBusy] = useState(false);
  const [seedResult, setSeedResult] = useState<Record<string, unknown> | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("system_settings").select("*").order("key");
    if (error) console.error("Could not load settings:", error.message);

    const rows = (data ?? []) as unknown as SystemSetting[];
    setSettings(rows);
    setDrafts(
      Object.fromEntries(
        rows.map((row) => [row.key, typeof row.value === "object" ? JSON.stringify(row.value) : String(row.value)]),
      ),
    );
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async (setting: EditableSetting) => {
    const draft = drafts[setting.key] ?? "";
    const trimmed = draft.trim();
    const minimum = setting.min ?? 0.01;

    if (setting.kind === "number" && (trimmed === "" || !Number.isFinite(Number(trimmed)) || Number(trimmed) < minimum)) {
      toast.error(
        minimum > 0
          ? `Enter a number of at least ${minimum}`
          : "Enter a number of zero or more",
      );
      return;
    }

    const value = setting.kind === "number" ? Number(trimmed) : trimmed === "" ? null : trimmed;

    setSavingKey(setting.key);
    const outcome = await invokeFunction("admin-actions", {
      action: "update_setting",
      key: setting.key,
      value,
    });
    setSavingKey(null);

    if (!outcome.ok) {
      toast.error("Could not save the setting", { description: outcome.error });
      return;
    }
    toast.success("Setting saved and audited");
    await load();
  };

  const seedEnvironment = async () => {
    setSeedBusy(true);
    const outcome = await invokeFunction<Record<string, unknown>>("seed-test-environment", {});
    setSeedBusy(false);

    if (!outcome.ok) {
      toast.error("Could not seed the test environment", { description: outcome.error });
      return;
    }
    setSeedResult(outcome.data ?? null);
    toast.success("Test environment ready", {
      description: "Test members are flagged as test data and excluded from lists by default.",
    });
  };

  const rate = Number(
    settings.find((row) => row.key === "point_to_peso_rate")?.value ?? 1,
  );

  return (
    <>
      <PageHeader
        title="Settings"
        description="System-wide configuration. Every change is recorded on the audit log."
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <div className="kmd-panel p-5">
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">System settings</h2>
          </div>

          <div className="mt-4 space-y-5">
            {EDITABLE.map((setting) => (
              <div key={setting.key} className="space-y-2">
                <Label htmlFor={`setting-${setting.key}`}>{setting.label}</Label>
                <div className="flex gap-2">
                  <Input
                    id={`setting-${setting.key}`}
                    value={drafts[setting.key] ?? ""}
                    onChange={(event) => setDrafts({ ...drafts, [setting.key]: event.target.value })}
                    inputMode={setting.kind === "number" ? "decimal" : "text"}
                    disabled={loading}
                  />
                  <Button
                    variant="outline"
                    onClick={() => void save(setting)}
                    disabled={savingKey === setting.key || loading}
                  >
                    {savingKey === setting.key ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">{setting.description}</p>
              </div>
            ))}
          </div>

          <Separator className="my-5" />

          <p className="text-xs text-muted-foreground">
            At the current rate, 1 point = {formatPeso(1, rate)}. This drives every peso equivalent shown
            to members and the value of a redemption request, but it never changes the points recorded in
            the ledger.
          </p>
        </div>

        <div className="space-y-6">
          <div className="kmd-panel p-5">
            <h2 className="text-sm font-semibold">Platform reference</h2>
            <dl className="mt-3 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Member ID format</dt>
                <dd className="font-mono">{MEMBER_ID_FORMAT}</dd>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Unilevel levels</dt>
                <dd>{UNILEVEL_LEVELS.length} (Level 1 to Level 5)</dd>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Verification flow</dt>
                <dd className="text-right">Pending Payment, Proof Submitted, Under Review, Confirmed</dd>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Reward values</dt>
                <dd className="text-right">Reward Configuration</dd>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Balance source of truth</dt>
                <dd className="text-right">The ledgers</dd>
              </div>
            </dl>
          </div>

          <div className="kmd-panel p-5">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Test environment</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Creates the required test roster — a buyer plus Level 1 to Level 5 sponsors chained through
              real sponsor relationships — plus a clean wallet for the redemption test. Every seeded row
              is flagged as test data, so it stays out of member and production lists. Nothing is deleted
              by this action.
            </p>

            {isSuperAdmin ? (
              <Button className="mt-4 w-full" onClick={() => void seedEnvironment()} disabled={seedBusy}>
                {seedBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Seed the test environment
              </Button>
            ) : (
              <p className="mt-4 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
                Only a super administrator can seed the test environment.
              </p>
            )}

            {seedResult ? (
              <div className="mt-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Result</span>
                  <StatusBadge
                    label={seedResult.ok === true ? "Ready" : "Completed with issues"}
                    tone={seedResult.ok === true ? "success" : "warning"}
                  />
                </div>
                <pre className="max-h-56 overflow-auto rounded-lg bg-muted/50 p-3 text-[10px] kmd-scroll">
                  {JSON.stringify(seedResult, null, 2)}
                </pre>
              </div>
            ) : null}
          </div>

          <div className="kmd-panel border-dashed p-5">
            <h2 className="text-sm font-semibold">Last settings change</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {settings.length > 0
                ? formatDateTime(
                    settings
                      .map((row) => row.updated_at)
                      .sort()
                      .slice(-1)[0],
                  )
                : "\u2014"}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
