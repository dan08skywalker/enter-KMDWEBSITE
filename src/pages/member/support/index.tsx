import { useCallback, useEffect, useState } from "react";
import { LifeBuoy, Loader2, Lock, Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/kmd/page-header";
import { EmptyState } from "@/components/kmd/empty-state";
import { StatusBadge } from "@/components/kmd/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTime } from "@/lib/kmd/format";
import type { Tone } from "@/lib/kmd/labels";

interface Ticket {
  id: string;
  ticket_number: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  last_reply_at: string | null;
  created_at: string;
}

interface Message {
  id: string;
  author_role: string;
  body: string;
  created_at: string;
}

const STATUS_TONE: Record<string, Tone> = {
  open: "info",
  in_progress: "gold",
  waiting_customer: "warning",
  resolved: "success",
  closed: "neutral",
};

const CATEGORIES = [
  { value: "general", label: "General enquiry" },
  { value: "order", label: "About an order" },
  { value: "payment", label: "Payment or verification" },
  { value: "delivery", label: "Delivery" },
  { value: "product", label: "A product question" },
  { value: "account", label: "My member account" },
  { value: "digital_service", label: "Website or landing page service" },
];

export default function MemberSupport() {
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("general");
  const [body, setBody] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("support_tickets")
      .select("id, ticket_number, subject, category, priority, status, last_reply_at, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Could not load your tickets:", error.message);
      setTickets([]);
    } else {
      setTickets((data ?? []) as Ticket[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMessages = useCallback(async (ticketId: string) => {
    // is_internal rows are filtered by the row-level policy as well as here, so a
    // staff note can never reach a member even if this query changed.
    const { data, error } = await supabase
      .from("ticket_messages")
      .select("id, author_role, body, created_at")
      .eq("ticket_id", ticketId)
      .eq("is_internal", false)
      .order("created_at");

    if (error) {
      console.error("Could not load the conversation:", error.message);
      setMessages([]);
      return;
    }
    setMessages((data ?? []) as Message[]);
  }, []);

  useEffect(() => {
    if (selectedId) void loadMessages(selectedId);
    else setMessages([]);
  }, [selectedId, loadMessages]);

  const create = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error("Add a subject and a message");
      return;
    }
    setBusy(true);

    const { data, error } = await supabase.rpc("kmd_ticket_create", {
      p_payload: { subject: subject.trim(), category, message: body.trim() },
    });

    setBusy(false);

    const result = (data ?? {}) as { status?: string; reasonText?: string };
    if (error || result.status === "FAILED") {
      toast.error(result.reasonText ?? error?.message ?? "Your ticket could not be created");
      return;
    }

    toast.success(result.reasonText ?? "Your ticket is open");
    setSubject("");
    setBody("");
    setCreating(false);
    void load();
  };

  const send = async () => {
    if (!selectedId || !reply.trim()) return;
    setBusy(true);

    const { error } = await supabase.rpc("kmd_ticket_reply", {
      p_ticket_id: selectedId,
      p_body: reply.trim(),
      p_is_internal: false,
    });

    setBusy(false);

    if (error) {
      toast.error(error.message.replace(/^[A-Z_]+:\s*/, ""));
      return;
    }

    setReply("");
    void loadMessages(selectedId);
    void load();
  };

  const selected = tickets.find((ticket) => ticket.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support"
        description="Ask us anything and track every reply in one place. We answer on working days."
        actions={
          <Button type="button" variant="brand" size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-3.5 w-3.5" />
            New ticket
          </Button>
        }
      />

      {creating ? (
        <div className="kmd-panel p-6">
          <p className="text-sm font-semibold">Open a new ticket</p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="ticket-subject">Subject</Label>
              <Input
                id="ticket-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                className="mt-1.5"
                placeholder="What do you need help with?"
              />
            </div>
            <div>
              <Label htmlFor="ticket-category">Topic</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="ticket-category" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="ticket-body">Message</Label>
              <Textarea
                id="ticket-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={5}
                className="mt-1.5"
                placeholder="Include an order number if this is about an order."
              />
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button type="button" variant="brand" disabled={busy} onClick={() => void create()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Open ticket
            </Button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          {[0, 1].map((row) => (
            <Skeleton key={row} className="h-20 w-full" />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title="You have no tickets yet"
          description="Open one and our team will reply here. You will also see a notification in the bell menu."
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <button
                type="button"
                onClick={() => setSelectedId(ticket.id === selectedId ? null : ticket.id)}
                className="kmd-panel w-full p-5 text-left transition-shadow hover:shadow-[var(--shadow-elegant)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold">{ticket.subject}</p>
                  <StatusBadge
                    label={ticket.status.replace(/_/g, " ")}
                    tone={STATUS_TONE[ticket.status] ?? "neutral"}
                  />
                </div>
                <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">
                  {ticket.ticket_number} · {ticket.category.replace(/_/g, " ")} ·{" "}
                  {formatDateTime(ticket.last_reply_at ?? ticket.created_at)}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected ? (
        <div className="kmd-panel p-6">
          <p className="text-sm font-semibold">{selected.subject}</p>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            {selected.ticket_number} · opened {formatDateTime(selected.created_at)}
          </p>

          <ul className="mt-5 space-y-3">
            {messages.map((message) => (
              <li
                key={message.id}
                className={
                  message.author_role === "staff"
                    ? "rounded-lg border border-primary/25 bg-secondary/60 p-3"
                    : "rounded-lg border p-3"
                }
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {message.author_role === "staff" ? "KMD support" : "You"}
                    {message.author_role === "staff" ? <Lock className="h-3 w-3" /> : null}
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
              rows={3}
              placeholder="Add to this conversation…"
            />
            <Button
              type="button"
              variant="brand"
              size="sm"
              className="mt-3"
              disabled={busy || !reply.trim()}
              onClick={() => void send()}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Send reply
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
