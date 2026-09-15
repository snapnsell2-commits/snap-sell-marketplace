import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/notifications";
import { timeAgo } from "@/lib/types";
import { useNotifications } from "@/lib/use-notifications";

export function NotificationBell() {
  const { user } = useAuth();
  const { items, unread } = useNotifications();
  const queryClient = useQueryClient();
  const router = useRouter();

  if (!user) return null;

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full" aria-label="Notifications">
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          Notifications
          {unread > 0 && (
            <button
              className="text-xs font-medium text-primary hover:underline"
              onClick={async () => {
                await markAllNotificationsRead(user.id);
                void refresh();
              }}
            >
              Mark all read
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            No notifications yet.
          </p>
        )}
        <div className="max-h-96 overflow-y-auto">
          {items.map((n) => (
            <DropdownMenuItem
              key={n.id}
              className="flex flex-col items-start gap-0.5 whitespace-normal py-2.5"
              onSelect={async () => {
                if (!n.read) await markNotificationRead(n.id);
                void refresh();
                if (n.link) void router.navigate({ to: n.link });
              }}
            >
              <span className="flex w-full items-center gap-2">
                {!n.read && <span className="size-2 shrink-0 rounded-full bg-primary" />}
                <span className="font-medium">{n.title}</span>
              </span>
              {n.body && <span className="text-xs text-muted-foreground">{n.body}</span>}
              <span className="text-[11px] text-muted-foreground">{timeAgo(n.created_at)}</span>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
