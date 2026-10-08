import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Each subscription is given its own channel topic.
 *
 * `supabase.channel(topic)` does not create a new channel when the topic is
 * already in use — it returns the existing one, and a channel that has been
 * subscribed refuses any further `on()` call. Two components watching the same
 * table therefore collided and took the page down with "cannot add
 * `postgres_changes` callbacks ... after `subscribe()`". A topic unique to each
 * subscription removes that, including the case where a listener is replaced
 * before its predecessor has finished tearing down.
 */
let channelSequence = 0;

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
        channelSequence += 1;

        const channel = supabase
          .channel(`kmd-${table}-${filter ?? "all"}-${channelSequence}`)
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
