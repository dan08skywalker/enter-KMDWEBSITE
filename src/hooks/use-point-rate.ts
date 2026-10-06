import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_POINT_RATE } from "@/lib/kmd/constants";
import { toNumber } from "@/lib/kmd/format";

/**
 * Point-to-peso conversion rate, read from system settings so an administrator
 * can change it without a code change.
 */
export function usePointRate(): number {
  const [rate, setRate] = useState<number>(DEFAULT_POINT_RATE);

  useEffect(() => {
    let active = true;

    void (async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("key, value")
        .eq("key", "point_to_peso_rate")
        .maybeSingle();

      if (error) {
        console.error("Could not read the point conversion rate:", error.message);
        return;
      }
      if (active && data) {
        const parsed = toNumber(data.value as unknown, DEFAULT_POINT_RATE);
        setRate(parsed > 0 ? parsed : DEFAULT_POINT_RATE);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return rate;
}
