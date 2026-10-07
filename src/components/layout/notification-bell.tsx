import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatRelative } from "@/lib/kmd/format";
import { cn } from "@/lib/utils";

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

/** In-app notification bell used by both the member and administrator shells. */
export function NotificationBell() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data, error } = await supabase
      .from("notifications")
      .select("id, type, title, body, link, is_read, created_at")
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      console.error("Could not load notifications:", error.message);
      return;
    }
    setRows((data ?? []) as NotificationRow[]);
  }, [profile]);

  useEffect(() => {
    void load();
  }, [load]);

  const unread = rows.filter((row) => !row.is_read).length;

  const markAllRead = async () => {
    const { error } = await supabase.rpc("kmd_notifications_mark_read", { p_ids: null });
    if (error) {
      console.error("Could not mark notifications as read:", error.message);
      return;
    }
    void load();
  };

  if (!profile) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        >
          <Bell className="h-4 w-4" />
          {unread > 0 ? (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[9px] font-bold text-gold-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px]"
              onClick={() => void markAllRead()}
            >
              <CheckCheck className="h-3 w-3" />
              Mark all read
            </Button>
          ) : null}
        </div>

        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">
            Nothing yet. You will be notified when a payment is confirmed, an order ships or a ticket
            is answered.
          </p>
        ) : (
          <ScrollArea className="max-h-80">
            <ul className="divide-y">
              {rows.map((row) => {
                const content = (
                  <div className={cn("px-4 py-3", row.is_read ? "" : "bg-secondary/50")}>
                    <p className="text-xs font-semibold">{row.title}</p>
                    {row.body ? (
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                        {row.body}
                      </p>
                    ) : null}
                    <p className="mt-1.5 text-[10px] text-muted-foreground">
                      {formatRelative(row.created_at)}
                    </p>
                  </div>
                );

                return (
                  <li key={row.id}>
                    {row.link ? (
                      <Link to={row.link} onClick={() => setOpen(false)} className="block hover:bg-muted/50">
                        {content}
                      </Link>
                    ) : (
                      content
                    )}
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
