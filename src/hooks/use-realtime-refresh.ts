import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Re-runs `onChange` whenever one of the given tables changes.
 * This is what makes a posted reward appear on a dashboard without a manual
 * refresh: the reward engine writes to the ledger, realtime fires, the page reloads.
 *
 * `filter` accepts a Postgres changes filter such as `beneficiary_id=eq.<uuid>`.
 */
export function useRealtimeRefresh(
  tables: string[],
  onChange: () => void,
  filter?: string,
): void {
  const handler = useRef(onChange);
  handler.current = onChange;

  const tableKey = tables.join(",");

  useEffect(() => {
    const channels = tableKey
      .split(",")
      .filter(Boolean)
      .map((table) => {
        const channel = supabase
          .channel(`kmd-${table}-${filter ?? "all"}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table,
              ...(filter ? { filter } : {}),
            },
            () => handler.current(),
          )
          .subscribe();

        return channel;
      });

    return () => {
      channels.forEach((channel) => {
        void supabase.removeChannel(channel);
      });
    };
  }, [tableKey, filter]);
}
