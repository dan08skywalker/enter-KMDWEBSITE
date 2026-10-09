import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * The ids of every digital product, so an order made only of digital lines can be
 * recognised and kept out of the courier-tracking display.
 *
 * Only active products are readable by a member, so a product that is no longer
 * listed simply does not appear here — an order containing one is treated as a
 * physical shipment rather than hiding tracking that may exist.
 */
export function useDigitalProductIds(): Set<string> {
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;

    void (async () => {
      const { data, error } = await supabase.from("products").select("id").eq("is_digital", true);
      if (error) {
        console.error("Could not load digital products:", error.message);
        return;
      }
      if (active) setIds(new Set(((data ?? []) as Array<{ id: string }>).map((row) => row.id)));
    })();

    return () => {
      active = false;
    };
  }, []);

  return ids;
}
