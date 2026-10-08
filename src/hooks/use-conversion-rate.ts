import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toNumber } from "@/lib/kmd/format";

export interface ConversionRate {
  /** null until an administrator configures it — conversions stay disabled. */
  rate: number | null;
  feePercent: number;
  loading: boolean;
}

/**
 * The rate and fee that govern Shopping Wallet conversions.
 *
 * The rate is deliberately nullable: a missing setting means "not configured",
 * not "1 to 1", so the UI can disable conversions instead of moving balances at
 * a rate nobody chose.
 */
export function useConversionRate(): ConversionRate {
  const [rate, setRate] = useState<number | null>(null);
  const [feePercent, setFeePercent] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void (async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("key, value")
        .in("key", ["wallet_conversion_rate", "wallet_conversion_fee_percent"]);

      if (error) {
        console.error("Could not read the conversion settings:", error.message);
        if (active) setLoading(false);
        return;
      }

      if (!active) return;

      const rows = (data ?? []) as Array<{ key: string; value: unknown }>;
      const rateRow = rows.find((row) => row.key === "wallet_conversion_rate");
      const feeRow = rows.find((row) => row.key === "wallet_conversion_fee_percent");

      const parsed = rateRow ? toNumber(rateRow.value, 0) : 0;
      setRate(parsed > 0 ? parsed : null);
      setFeePercent(feeRow ? Math.max(toNumber(feeRow.value, 0), 0) : 0);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  return { rate, feePercent, loading };
}
