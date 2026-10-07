import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CartLine } from "@/lib/site/types";

/**
 * The shopping bag.
 *
 * It is kept in localStorage rather than the database on purpose: a visitor can
 * fill a bag, register or sign in, and the bag is still there afterwards, with
 * no anonymous write access to the backend and nothing to clean up for a guest
 * who never checks out.
 */
const STORAGE_KEY = "kmd.cart.v1";

interface CartContextValue {
  lines: CartLine[];
  count: number;
  subtotal: number;
  requiresShipping: boolean;
  add: (line: Omit<CartLine, "quantity">, quantity?: number) => void;
  setQuantity: (sku: string, quantity: number) => void;
  remove: (sku: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function readStoredCart(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // A stored bag is untrusted input: keep only well-formed lines.
    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const line = entry as Partial<CartLine>;
      const quantity = Number(line.quantity);
      const unitPrice = Number(line.unitPrice);
      if (typeof line.sku !== "string" || !line.sku) return [];
      if (!Number.isFinite(quantity) || quantity < 1) return [];
      return [
        {
          sku: line.sku,
          name: typeof line.name === "string" ? line.name : line.sku,
          unitPrice: Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0,
          quantity: Math.min(Math.floor(quantity), 99),
          imageUrl: typeof line.imageUrl === "string" ? line.imageUrl : null,
          isDigital: line.isDigital === true,
        },
      ];
    });
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(readStoredCart);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // A full or blocked localStorage must never break the page.
    }
  }, [lines]);

  const add = useCallback((line: Omit<CartLine, "quantity">, quantity = 1) => {
    setLines((current) => {
      const existing = current.find((row) => row.sku === line.sku);
      if (!existing) {
        return [...current, { ...line, quantity: Math.min(Math.max(quantity, 1), 99) }];
      }
      return current.map((row) =>
        row.sku === line.sku
          ? {
              ...row,
              // Refresh the catalogue values so a repriced item is never stale.
              name: line.name,
              unitPrice: line.unitPrice,
              imageUrl: line.imageUrl,
              isDigital: line.isDigital,
              quantity: Math.min(row.quantity + quantity, 99),
            }
          : row,
      );
    });
  }, []);

  const setQuantity = useCallback((sku: string, quantity: number) => {
    setLines((current) =>
      quantity < 1
        ? current.filter((row) => row.sku !== sku)
        : current.map((row) =>
            row.sku === sku ? { ...row, quantity: Math.min(Math.floor(quantity), 99) } : row,
          ),
    );
  }, []);

  const remove = useCallback((sku: string) => {
    setLines((current) => current.filter((row) => row.sku !== sku));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartContextValue>(() => {
    const count = lines.reduce((total, row) => total + row.quantity, 0);
    const subtotal = lines.reduce((total, row) => total + row.unitPrice * row.quantity, 0);
    return {
      lines,
      count,
      subtotal,
      requiresShipping: lines.some((row) => !row.isDigital),
      add,
      setQuantity,
      remove,
      clear,
    };
  }, [lines, add, setQuantity, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used inside a CartProvider");
  }
  return context;
}
