import { createContext, useContext, type ReactNode } from "react";
import { useMemberPricing, type MemberPricing } from "@/hooks/use-member-pricing";

const MemberPricingContext = createContext<MemberPricing | null>(null);

/**
 * Reads the signed-in buyer's member prices once for the whole app, so product
 * cards, the bag and the checkout all show the same figures without each of them
 * asking the server again.
 */
export function MemberPricingProvider({ children }: { children: ReactNode }) {
  const pricing = useMemberPricing();
  return <MemberPricingContext.Provider value={pricing}>{children}</MemberPricingContext.Provider>;
}

export function useMemberPricingContext(): MemberPricing {
  const context = useContext(MemberPricingContext);
  if (!context) {
    throw new Error("useMemberPricingContext must be used inside a MemberPricingProvider");
  }
  return context;
}
