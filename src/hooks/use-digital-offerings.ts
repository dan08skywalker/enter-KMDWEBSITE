import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { mapOffering, type DigitalOffering } from "@/lib/digital/types";

/**
 * The published KMD Digital Solutions listings.
 *
 * Only active listings are returned: the table's access policy scopes the read,
 * so a listing an administrator has hidden never reaches the public page.
 */
export function useDigitalOfferings() {
  const [offerings, setOfferings] = useState<DigitalOffering[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);

    void (async () => {
      const { data, error: readError } = await supabase
        .from("digital_offerings")
        .select("*")
        .eq("is_active", true)
        .order("offering_group", { ascending: true })
        .order("sort_order", { ascending: true });

      if (!active) return;

      if (readError) {
        console.error("Could not load the digital listings:", readError.message);
        setError("The digital solutions could not be loaded just now.");
        setLoading(false);
        return;
      }

      setOfferings(((data ?? []) as Array<Record<string, unknown>>).map(mapOffering));
      setError(null);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  return {
    offerings,
    learningPackages: offerings.filter((offering) => offering.offeringGroup === "learning_package"),
    services: offerings.filter((offering) => offering.offeringGroup === "service"),
    loading,
    error,
    reload,
  };
}
