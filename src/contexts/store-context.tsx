import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  DeliveryZone,
  PaymentAccount,
  SiteSettings,
  StoreCatalog,
  StorePackage,
  StoreProduct,
} from "@/lib/site/types";

/**
 * One anonymous read of the whole storefront.
 *
 * The catalogue comes from the backend rather than direct table reads so that
 * the published surface is defined in one place: only active products, only
 * active delivery areas, and only payment accounts the owner has verified.
 */
const EMPTY: StoreCatalog = {
  products: [],
  packages: [],
  deliveryZones: [],
  paymentAccounts: [],
  settings: {},
};

interface StoreContextValue {
  loading: boolean;
  error: string | null;
  products: StoreProduct[];
  packages: StorePackage[];
  deliveryZones: DeliveryZone[];
  paymentAccounts: PaymentAccount[];
  settings: SiteSettings;
  reload: () => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<StoreCatalog>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);

    void (async () => {
      const { data, error: rpcError } = await supabase.rpc("kmd_storefront_catalog");

      if (!active) return;

      if (rpcError) {
        console.error("Could not load the storefront catalogue:", rpcError.message);
        setError("The shop could not be loaded just now. Please refresh the page.");
        setLoading(false);
        return;
      }

      const payload = (data ?? {}) as Partial<StoreCatalog>;
      setCatalog({
        products: payload.products ?? [],
        packages: payload.packages ?? [],
        deliveryZones: payload.deliveryZones ?? [],
        paymentAccounts: payload.paymentAccounts ?? [],
        settings: payload.settings ?? {},
      });
      setError(null);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  const value = useMemo<StoreContextValue>(
    () => ({
      loading,
      error,
      products: catalog.products,
      packages: catalog.packages,
      deliveryZones: catalog.deliveryZones,
      paymentAccounts: catalog.paymentAccounts,
      settings: catalog.settings,
      reload,
    }),
    [loading, error, catalog, reload],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useStore must be used inside a StoreProvider");
  }
  return context;
}

/** Reads a published site setting as a string, with a fallback. */
export function useSiteText(key: string, fallback = ""): string {
  const { settings } = useStore();
  const raw = settings[key];
  return typeof raw === "string" && raw.length > 0 ? raw : fallback;
}

/** Reads a published site setting that is an array of strings. */
export function useSiteList(key: string, fallback: string[] = []): string[] {
  const { settings } = useStore();
  const raw = settings[key];
  if (Array.isArray(raw)) {
    const items = raw.filter((item): item is string => typeof item === "string" && item.length > 0);
    return items.length > 0 ? items : fallback;
  }
  return fallback;
}
