import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarClock,
  Eye,
  FileSpreadsheet,
  Inbox,
  Loader2,
  Mail,
  MapPin,
  Paperclip,
  Phone,
  RefreshCw,
  Save,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/kmd/invoke";
import { PageHeader } from "@/components/kmd/page-header";
import { DataTable, type Column } from "@/components/kmd/data-table";
import { EmptyState } from "@/components/kmd/empty-state";
import { StatusBadge } from "@/components/kmd/status-badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { formatDateTime, formatPeso } from "@/lib/kmd/format";
import {
  REQUEST_STATUS_LABEL,
  mapRequest,
  type ClientRequest,
  type RequestStatus,
} from "@/lib/digital/types";

const STATUS_TONE: Record<RequestStatus, "info" | "warning" | "success" | "neutral" | "danger"> = {
  submitted: "info",
  in_review: "warning",
  quoted: "success",
  closed: "neutral",
  cancelled: "danger",
};

export default function AdminDigitalRequests() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"open" | "all" | RequestStatus>("open");
  const [target, setTarget] = useState<ClientRequest | null>(null);
  const [statusDraft, setStatusDraft] = useState<RequestStatus>("submitted");
  const [notesDraft, setNotesDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [attachments, setAttachments] = useState<Array<{ path: string; url: string | null }>>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("client_requests")
      .select("*")
      .order("submitted_at", { ascending: false });

    setLoading(false);
    if (error) {
      console.error("Could not load the digital requests:", error.message);
      toast.error("The client requests could not be loaded");
      setRequests([]);
      return;
    }
    setRequests(((data ?? []) as Array<Record<string, unknown>>).map(mapRequest));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeRefresh(["client_requests"], () => {
    void load();
  });

  const openRequest = async (request: ClientRequest) => {
    setTarget(request);
    setStatusDraft(request.status);
    setNotesDraft(request.adminNotes ?? "");
    setAttachments([]);

    if (request.attachmentPaths.length === 0) return;

    const signed: Array<{ path: string; url: string | null }> = [];
    for (const path of request.attachmentPaths) {
      const outcome = await invokeFunction<{ url?: string }>("admin-actions", {
        action: "support_attachment_url",
        bucket: "client-request-files",
        path,
      });
      signed.push({ path, url: outcome.ok ? (outcome.data?.url ?? null) : null });
    }
    setAttachments(signed);
  };

  const save = async () => {
    if (!target) return;
    setBusy(true);
    const outcome = await invokeFunction<{ result?: { status?: string; reasonText?: string } }>(
      "admin-actions",
      {
        action: "update_client_request",
        requestId: target.id,
        status: statusDraft,
        notes: notesDraft.trim() || null,
      },
    );
    setBusy(false);

    if (!outcome.ok) {
      toast.error(outcome.error ?? "The request could not be updated");
      return;
    }
    if (outcome.data?.result?.status !== "UPDATED") {
      toast.error(outcome.data?.result?.reasonText ?? "The request could not be updated");
      return;
    }

    toast.success("Request updated", {
      description: `${target.requestNumber} is now ${REQUEST_STATUS_LABEL[statusDraft].toLowerCase()}.`,
    });
    setTarget(null);
    await load();
  };

  const filtered = useMemo(() => {
    if (filter === "all") return requests;
    if (filter === "open") {
      return requests.filter((request) => request.status !== "closed" && request.status !== "cancelled");
    }
    return requests.filter((request) => request.status === filter);
  }, [requests, filter]);

  const columns: Column<ClientRequest>[] = [
    {
      key: "number",
      header: "Request",
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-mono text-xs font-semibold">{row.requestNumber}</span>
          <span className="text-[10px] text-muted-foreground">{formatDateTime(row.submittedAt)}</span>
        </div>
      ),
    },
    {
      key: "client",
      header: "Client",
      cell: (row) => (
        <div className="flex flex-col">
          <span className="text-xs font-semibold">{row.clientName}</span>
          <span className="text-[10px] text-muted-foreground">
            {row.businessName ? `${row.businessName} · ` : ""}
            {row.email}
          </span>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      cell: (row) => (
        <StatusBadge
          label={row.requestType === "service" ? "Website / dashboard" : "Learning package"}
          tone={row.requestType === "service" ? "info" : "neutral"}
        />
      ),
    },
    {
      key: "items",
      header: "Selected",
      cell: (row) => (
        <span className="text-[11px]">
          {row.items.map((item) => item.label).join(", ") || "\u2014"}
        </span>
      ),
    },
    {
      key: "total",
      header: "Published total",
      cell: (row) => <span className="text-xs tabular-nums">{formatPeso(row.estimatedTotal)}</span>,
      className: "text-right",
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <StatusBadge label={REQUEST_STATUS_LABEL[row.status]} tone={STATUS_TONE[row.status]} />,
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (row) => (
        <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => void openRequest(row)}>
          <Eye className="h-3 w-3" />
          Review
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Digital Client Requests"
        description="Every request sent from the KMD Digital Solutions listings. A request is not a payment and not a contract — it is the client asking for a quotation."
        actions={
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Refresh
          </Button>
        }
      />

      <Tabs value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
        <TabsList>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="submitted">Submitted</TabsTrigger>
          <TabsTrigger value="in_review">In review</TabsTrigger>
          <TabsTrigger value="quoted">Quoted</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-4">
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(row) => row.id}
          loading={loading}
          empty={
            <EmptyState
              icon={Inbox}
              title="No client requests here"
              description="Requests sent from the digital listings appear on this screen as soon as they arrive."
            />
          }
        />
      </div>

      <Dialog
        open={Boolean(target)}
        onOpenChange={(open) => {
          if (busy) return;
          if (!open) setTarget(null);
        }}
      >
        <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="font-mono text-sm">{target?.requestNumber}</span>
              {target ? <StatusBadge label={REQUEST_STATUS_LABEL[target.status]} tone={STATUS_TONE[target.status]} /> : null}
            </DialogTitle>
            <DialogDescription>
              Received {target ? formatDateTime(target.submittedAt) : ""}. Review the details, then prepare the
              quotation.
            </DialogDescription>
          </DialogHeader>

          {target ? (
            <div className="space-y-5">
              <section className="kmd-panel p-4">
                <h3 className="flex items-center gap-2 text-xs font-semibold">
                  <User className="h-3.5 w-3.5 text-primary" />
                  Client
                </h3>
                <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Detail icon={User} label="Client or requester" value={target.clientName} />
                  <Detail icon={Phone} label="Contact number" value={target.phone} />
                  <Detail icon={Mail} label="Email" value={target.email} />
                  <Detail icon={MapPin} label="Address" value={target.clientAddress ?? "\u2014"} />
                </dl>
              </section>

              <section className="kmd-panel p-4">
                <h3 className="flex items-center gap-2 text-xs font-semibold">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-primary" />
                  Selected listings
                </h3>
                <ul className="mt-3 space-y-3">
                  {target.items.map((item) => (
                    <li key={item.offeringKey} className="border-b pb-3 last:border-0 last:pb-0">
                      <p className="text-xs font-semibold">
                        <span className="text-muted-foreground">{item.label} · </span>
                        {item.name}
                      </p>
                      <p className="mt-1 text-xs tabular-nums">{formatPeso(item.price)}</p>
                      {item.annualFee !== null && item.annualFeeLabel ? (
                        <p className="text-[11px] text-muted-foreground">
                          {item.annualFeeLabel}: {formatPeso(item.annualFee)}/year
                          {item.annualFeeOption === "optional" ? " (optional)" : ""}
                        </p>
                      ) : null}
                      {item.inclusions.length > 0 ? (
                        <ul className="mt-1 space-y-0.5">
                          {item.inclusions.map((inclusion) => (
                            <li key={inclusion} className="text-[11px] text-muted-foreground">
                              • {inclusion}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs font-semibold tabular-nums">
                  Published total: {formatPeso(target.estimatedTotal)}
                </p>
              </section>

              <section className="kmd-panel p-4">
                <h3 className="text-xs font-semibold">Project and learning details</h3>
                <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Detail label="Business name" value={target.businessName ?? "\u2014"} />
                  <Detail label="Products or services offered" value={target.productsServices ?? "\u2014"} />
                  <Detail label="Learning goals" value={target.learningGoals ?? "\u2014"} />
                  <Detail label="Preferred domain" value={target.preferredDomain ?? "\u2014"} />
                  <Detail label="Design references" value={target.designReferences ?? "\u2014"} />
                  <Detail label="Content supplied" value={target.contentSupplied ?? "\u2014"} />
                  <Detail
                    label="Preferred completion"
                    value={target.preferredCompletion ? target.preferredCompletion : "\u2014"}
                  />
                  <Detail
                    label="Hosting preference"
                    value={target.hostingPreference ?? "\u2014"}
                  />
                  <Detail label="Maintenance plan" value={target.maintenancePreference ?? "\u2014"} />
                  <Detail
                    label="MLM maintenance choice"
                    value={target.maintenanceChoice ?? "Not chosen"}
                  />
                </dl>
                <div className="mt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Required pages, features or project description
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-xs">
                    {target.requiredFeatures ?? "\u2014"}
                  </p>
                </div>
              </section>

              {attachments.length > 0 ? (
                <section className="kmd-panel p-4">
                  <h3 className="flex items-center gap-2 text-xs font-semibold">
                    <Paperclip className="h-3.5 w-3.5 text-primary" />
                    Attached content
                  </h3>
                  <ul className="mt-3 space-y-2">
                    {attachments.map((attachment) => (
                      <li key={attachment.path} className="flex flex-wrap items-center gap-2 text-xs">
                        {attachment.url ? (
                          <a
                            href={attachment.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-accent underline underline-offset-2"
                          >
                            {attachment.path.split("/").pop() ?? attachment.path}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">
                            {attachment.path.split("/").pop() ?? attachment.path} (link could not be created)
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Links expire after an hour. Files stay in private storage.
                  </p>
                </section>
              ) : null}

              <section className="kmd-panel p-4">
                <h3 className="text-xs font-semibold">Queue status and internal note</h3>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="request-status">Status</Label>
                    <Select value={statusDraft} onValueChange={(value) => setStatusDraft(value as RequestStatus)}>
                      <SelectTrigger id="request-status" className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(REQUEST_STATUS_LABEL) as RequestStatus[]).map((status) => (
                          <SelectItem key={status} value={status}>
                            {REQUEST_STATUS_LABEL[status]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Closing or cancelling a request releases the client&apos;s reference, so the same set can
                      be requested again later.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="request-notes">Internal note</Label>
                    <Textarea
                      id="request-notes"
                      value={notesDraft}
                      onChange={(event) => setNotesDraft(event.target.value)}
                      rows={3}
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </section>
            </div>
          ) : null}

          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => setTarget(null)} disabled={busy}>
              Close
            </Button>
            <Button
              variant="outline"
              disabled={!target}
              onClick={() => {
                if (!target) return;
                navigate(`/admin/quotations/new?request=${target.id}`);
              }}
            >
              <CalendarClock className="h-4 w-4" />
              Prepare quotation
            </Button>
            <Button onClick={() => void save()} disabled={busy || !target}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon?: typeof User;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {Icon ? <Icon className="h-3 w-3" /> : null}
        {label}
      </dt>
      <dd className="mt-0.5 whitespace-pre-wrap break-words text-xs">{value}</dd>
    </div>
  );
}
