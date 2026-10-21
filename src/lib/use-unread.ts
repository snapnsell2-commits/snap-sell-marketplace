import { useQuery } from "@tanstack/react-query";

import { useAuth } from "./auth";
import { fetchUnreadCount } from "./chat";

/** Number of unread chat messages for the header badge. Live-updated by <RealtimeBridge />. */
export function useUnreadMessages(): number {
  const { user, configured } = useAuth();
  const userId = user?.id ?? null;
  const query = useQuery({
    queryKey: ["unread", userId],
    queryFn: () => fetchUnreadCount(userId as string),
    enabled: Boolean(configured && userId),
    refetchInterval: 60_000, // safety net in case a realtime event is missed
  });
  return query.data ?? 0;
}
