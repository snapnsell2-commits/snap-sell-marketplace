import { useQuery } from "@tanstack/react-query";

import { useAuth } from "./auth";
import { fetchNotifications } from "./notifications";

/**
 * Notification list + unread count. Query only — the live updates and toasts
 * come from <RealtimeBridge /> (mounted once in the header), so this hook is
 * safe to use in as many components as you like.
 */
export function useNotifications() {
  const { user, configured } = useAuth();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => fetchNotifications(userId as string),
    enabled: Boolean(configured && userId),
  });

  const items = query.data ?? [];
  return { items, unread: items.filter((n) => !n.read).length, isLoading: query.isPending };
}
