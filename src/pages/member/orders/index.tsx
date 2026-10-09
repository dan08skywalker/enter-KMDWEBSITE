import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Package, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { invokeFunction } from "@/lib/kmd/invoke";
import { PageHeader } from "@/components/kmd/page-header";
import { DataTable, type Column } from "@/components/kmd/data-table";
import { EmptyState } from "@/components/kmd/empty-state";
import { StatusBadge } from "@/components/kmd/status-badge";
import { FilterBar, SelectFilter } from "@/components/kmd/filter-bar";
import { CourierTrackingCell } from "@/components/kmd/courier-tracking";
import { useDigitalProductIds } from "@/hooks/use-digital-products";
import { isDigitalOnlyOrder } from "@/lib/kmd/courier";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, formatPeso } from "@/lib/kmd/format";
import { orderStatus } from "@/lib/kmd/labels";
import type { Order, OrderItem, Product } from "@/lib/kmd/types";

interface OrderRow extends Order {
  order_items: OrderItem[];
}

interface CreateOrderResult {
  ok?: boolean;
  order?: { orderId: string; orderNumber: string; totalAmount: number; sku: string; quantity: number };
}

export default function MemberOrders() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [status, setStatus] = useState("all");
  const [products, setProducts] = useState<Product[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [creating, setCreating] = useState(false);
  const digitalProductIds = useDigitalProductIds();

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Could not load orders:", error.message);
      setLoading(false);
      return;
    }
    setOrders((data ?? []) as unknown as OrderRow[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useRealtimeRefresh(["orders"], () => void load());

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("product_code");
      if (error) {
        console.error("Could not load products:", error.message);
        return;
      }
      if (active) setProducts((data ?? []) as unknown as Product[]);
    })();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(
    () => (status === "all" ? orders : orders.filter((order) => order.status === status)),
    [orders, status],
  );

  const selectedProduct = products.find((product) => product.id === productId);
  const requestedQuantity = Math.max(1, Number(quantity) || 1);

  const createOrder = async () => {
    if (!productId) {
      toast.error("Choose a product or package");
      return;
    }

    setCreating(true);
    const outcome = await invokeFunction<CreateOrderResult>("member-actions", {
      action: "create_order",
      productId,
      quantity: requestedQuantity,
    });
    setCreating(false);

    if (!outcome.ok || !outcome.data?.order) {
      toast.error("Could not create the order", { description: outcome.error });
      return;
    }

    toast.success(`Order ${outcome.data.order.orderNumber} created`, {
      description: "Submit your payment proof to move it forward. Commission is only generated after payment is confirmed.",
    });
    setDialogOpen(false);
    setProductId("");
    setQuantity("1");
    await load();
    navigate(`/app/orders/${outcome.data.order.orderId}`);
  };

  const columns: Column<OrderRow>[] = [
    { key: "date", header: "Date", cell: (row) => formatDate(row.created_at) },
    {
      key: "number",
      header: "Order Number",
      cell: (row) => <span className="font-mono text-xs font-semibold">{row.order_number}</span>,
    },
    {
      key: "tracking",
      header: "Courier Tracking",
      cell: (row) => (
        <CourierTrackingCell
          courier={row.courier}
          trackingNumber={row.tracking_number}
          digitalOnly={isDigitalOnlyOrder(row.order_items ?? [], digitalProductIds)}
        />
      ),
    },
    {
      key: "product",
      header: "Product / SKU",
      cell: (row) => {
        const item = row.order_items?.[0];
        if (!item) return "\u2014";
        return (
          <div className="flex flex-col">
            <span className="text-sm">{item.product_name}</span>
            <span className="font-mono text-[11px] text-muted-foreground">{item.sku}</span>
          </div>
        );
      },
    },
    {
      key: "qty",
      header: "Qty",
      cell: (row) => row.order_items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0,
      className: "text-right",
    },
    {
      key: "amount",
      header: "Amount",
      cell: (row) => formatPeso(row.total_amount),
      className: "text-right",
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => {
        const descriptor = orderStatus(row.status);
        return <StatusBadge label={descriptor.label} tone={descriptor.tone} />;
      },
    },
    {
      key: "rewards",
      header: "Rewards",
      cell: (row) => (
        <StatusBadge
          label={row.rewards_processed ? "Processed" : "Not processed"}
          tone={row.rewards_processed ? "success" : "neutral"}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="My Orders"
        description="Your purchases and their payment verification status."
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" />
                New order
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create an order</DialogTitle>
                <DialogDescription>
                  Choose a product or membership package and the quantity. The price and SKU are
                  applied by the system.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="order-product">Product / Package</Label>
                  <Select value={productId} onValueChange={setProductId}>
                    <SelectTrigger id="order-product">
                      <SelectValue placeholder="Select a product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} ({product.sku})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="order-quantity">Quantity</Label>
                  <Input
                    id="order-quantity"
                    inputMode="numeric"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value.replace(/[^0-9]/g, ""))}
                  />
                </div>

                {selectedProduct ? (
                  <div className="rounded-lg bg-muted/40 p-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Unit price</span>
                      <span className="font-semibold">{formatPeso(selectedProduct.selling_price)}</span>
                    </div>
                    <div className="mt-1 flex justify-between">
                      <span className="text-muted-foreground">Order total</span>
                      <span className="font-semibold">
                        {formatPeso(selectedProduct.selling_price * requestedQuantity)}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={creating}>
                  Cancel
                </Button>
                <Button onClick={() => void createOrder()} disabled={creating}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Create order
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <FilterBar>
        <SelectFilter
          value={status}
          onChange={setStatus}
          allLabel="All statuses"
          options={[
            { value: "pending_payment", label: "Pending Payment" },
            { value: "proof_submitted", label: "Proof Submitted" },
            { value: "under_review", label: "Under Review" },
            { value: "confirmed", label: "Confirmed" },
            { value: "rejected", label: "Rejected" },
            { value: "cancelled", label: "Cancelled" },
          ]}
        />
      </FilterBar>

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(row) => row.id}
        loading={loading}
        onRowClick={(row) => navigate(`/app/orders/${row.id}`)}
        empty={
          <EmptyState
            icon={Package}
            title="No orders yet"
            description="Create your first order to begin earning and building your loyalty card history."
            action={
              <Button asChild variant="outline">
                <Link to="/app/redeem">See what you can redeem</Link>
              </Button>
            }
          />
        }
      />
    </>
  );
}
