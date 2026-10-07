import { useCallback, useEffect, useMemo, useState } from "react";
import { LifeBuoy, Loader2, Lock, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/kmd/page-header";
import { DataTable, type Column } from "@/components/kmd/data-table";
import { EmptyState } from "@/components/kmd/empty-state";
import { StatusBadge } from "@/components/kmd/status-badge";
import { FilterBar, SearchInput } from "@/components/kmd/filter-bar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { invokeFunction } from "@/lib/kmd/invoke";
import { formatDateTime } from "@/lib/kmd/format";
import type { Tone } from "@/lib/kmd/labels";

interface Ticket {
  id: string;
  ticket_number: string;
  member_id: string | null;
  member_code: string | null;
  guest_name: string | null;
  guest_email: string | null;
  subject: string;
  category: string;
  priority: string;
  status: string;
  last_reply_at: string | null;
  created_at: string;
}

interface Message {
  id: string;
  ticket_id: string;
  author_role: string;
  author_label: string | null;
  body: string;
  is_internal: boolean;
  created_at: string;
}

const STATUS_TONE: Record<string, Tone> = {
  open: "info",
  in_progress: "gold",
  waiting_customer: "warning",
  resolved: "success",
  closed: "neutral",
};

const PRIORITY_TONE: Record<string, Tone> = {
  low: "neutral",
  normal: "info",
  high: "warning",
  urgent: "danger",
};

export default function AdminSupport() {
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("support_tickets")
      .select(
        "id, ticket_number, member_id, member_code, guest_name, guest_email, subject, category, priority, status, last_reply_at, created_at",
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Could not load support tickets:", error.message);
      setTickets([]);
    } else {
      setTickets((data ?? []) as Ticket[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  const selected = tickets.find((ticket) => ticket.id === selectedId) ?? null;

  const loadMessages = useCallback(async (ticketId: string) => {
    const { data, error } = await supabase
      .from("ticket_messages")
      .select("id, ticket_id, author_role, author_label, body, is_internal, created_at")
      .eq("ticket_id", ticketId)
      .order("created_at");

    if (error) {
      console.error("Could not load ticket messages:", error.message);
      setMessages([]);
      return;
    }
    setMessages((data ?? []) as Message[]);
  }, []);

  useEffect(() => {
    if (selectedId) void loadMessages(selectedId);
    else setMessages([]);
  }, [selectedId, loadMessages]);

  const sendReply = async () => {
    if (!selectedId || !reply.trim()) return;
    setBusy(true);

    const { error } = await supabase.rpc("kmd_ticket_reply", {
      p_ticket_id: selectedId,
      p_body: reply.trim(),
      p_is_internal: internal,
    });

    setBusy(false);

    if (error) {
      toast.error(error.message.replace(/^[A-Z_]+:\s*/, ""));
      return;
    }

    setReply("");
    setInternal(false);
    void loadMessages(selectedId);
    void loadTickets();
  };

  const updateTicket = async (patch: { status?: string; priority?: string }) => {
    if (!selectedId) return;
    setBusy(true);

    const outcome = await invokeFunction<{ reasonText?: string }>("admin-actions", {
      action: "update_ticket",
      ticketId: selectedId,
      status: patch.status ?? null,
      priority: patch.priority ?? null,
    });

    setBusy(false);

    if (!outcome.ok) {
      toast.error(outcome.error ?? "The ticket could not be updated");
      return;
    }
    void loadTickets();
  };

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return tickets.filter((ticket) => {
      if (statusFilter !== "all") {
        if (statusFilter === "active") {
          if (["resolved", "closed"].includes(ticket.status)) return false;
        } else if (ticket.status !== statusFilter) {
          return false;
        }
      }
      if (!needle) return true;
      return (
        ticket.ticket_number.toLowerCase().includes(needle) ||
        ticket.subject.toLowerCase().includes(needle) ||
        (ticket.guest_email ?? "").toLowerCase().includes(needle) ||
        (ticket.guest_name ?? "").toLowerCase().includes(needle) ||
        (ticket.member_code ?? "").toLowerCase().includes(needle)
      );
    });
  }, [tickets, search, statusFilter]);

  const columns: Array<Column<Ticket>> = [
    {
      key: "ticket",
      header: "Ticket",
      cell: (ticket) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{ticket.subject}</p>
          <p className="font-mono text-[10px] text-muted-foreground">{ticket.ticket_number}</p>
        </div>
      ),
    },
    {
      key: "from",
      header: "From",
      cell: (ticket) => (
        <div className="min-w-0">
          <p className="truncate text-xs">{ticket.guest_name ?? "—"}</p>
          <p className="truncate text-[10px] text-muted-foreground">
            {ticket.guest_email ?? ticket.member_code ?? "—"}
          </p>
        </div>
      ),
    },
    {
      key: "category",
      header: "Topic",
      cell: (ticket) => (
        <span className="text-xs capitalize">{ticket.category.replace(/_/g, " ")}</span>
      ),
    },
    {
      key: "priority",
      header: "Priority",
      cell: (ticket) => (
        <StatusBadge
          label={ticket.priority}
          tone={PRIORITY_TONE[ticket.priority] ?? "neutral"}
        />
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (ticket) => (
        <StatusBadge
          label={ticket.status.replace(/_/g, " ")}
          tone={STATUS_TONE[ticket.status] ?? "neutral"}
        />
      ),
    },
    {
      key: "updated",
      header: "Last activity",
      cell: (ticket) => (
        <span className="text-xs text-muted-foreground">
          {formatDateTime(ticket.last_reply_at ?? ticket.created_at)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support tickets"
        description="Messages from customers and members. Internal notes are never shown to the customer."
      />

      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search tickets" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Needs attention</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In progress</SelectItem>
            <SelectItem value="waiting_customer">Waiting on customer</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="all">All tickets</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={visible}
        rowKey={(ticket) => ticket.id}
        loading={loading}
        onRowClick={(ticket) => setSelectedId(ticket.id)}
        empty={
          <EmptyState
            icon={LifeBuoy}
            title="No tickets match those filters"
            description="Change the filter or clear the search to see more."
          />
        }
      />

      {selected ? (
        <div className="kmd-panel p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{selected.subject}</p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                {selected.ticket_number} · {selected.guest_name ?? "Member"}{" "}
                {selected.guest_email ? `· ${selected.guest_email}` : ""}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Opened {formatDateTime(selected.created_at)} · {selected.category.replace(/_/g, " ")}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={selected.priority}
                onValueChange={(value) => void updateTicket({ priority: value })}
              >
                <SelectTrigger className="h-9 w-[140px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["low", "normal", "high", "urgent"].map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={selected.status}
                onValueChange={(value) => void updateTicket({ status: value })}
              >
                <SelectTrigger className="h-9 w-[190px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["open", "in_progress", "waiting_customer", "resolved", "closed"].map((value) => (
                    <SelectItem key={value} value={value}>
                      {value.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
                Close
              </Button>
            </div>
          </div>

          <ul className="mt-5 space-y-3">
            {messages.map((message) => (
              <li
                key={message.id}
                className={
                  message.is_internal
                    ? "rounded-lg border border-warning/35 bg-warning/10 p-3"
                    : message.author_role === "staff"
                      ? "rounded-lg border border-primary/25 bg-secondary/60 p-3"
                      : "rounded-lg border p-3"
                }
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {message.is_internal ? <Lock className="h-3 w-3" /> : null}
                    {message.author_role}
                    {message.author_label ? ` · ${message.author_label}` : ""}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatDateTime(message.created_at)}
                  </p>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{message.body}</p>
              </li>
            ))}
          </ul>

          <div className="mt-5 border-t pt-5">
            <Textarea
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              rows={4}
              placeholder="Write a reply to the customer…"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Switch checked={internal} onCheckedChange={setInternal} />
                Internal note (hidden from the customer)
              </label>
              <Button
                type="button"
                variant="brand"
                size="sm"
                disabled={busy || !reply.trim()}
                onClick={() => void sendReply()}
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {internal ? "Save note" : "Send reply"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
