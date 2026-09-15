import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";

import { useAuth } from "./auth";
import { fetchNotifications } from "./notifications";
import { supabase } from "./supabase";

export function useNotifications() {
  const { user, configured } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => fetchNotifications(userId as string),
    enabled: Boolean(configured && userId),
  });

  useEffect(() => {
    if (!supabase || !userId) return;
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as { title: string; body: string | null };
          toast(row.title, { description: row.body ?? undefined });
          void queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
          void queryClient.invalidateQueries({ queryKey: ["conversations", userId] });
          void queryClient.invalidateQueries({ queryKey: ["offers"] });
        },
      )
      .subscribe();
    return () => {
      void supabase?.removeChannel(channel);
    };
  }, [userId, queryClient]);

  const items = query.data ?? [];
  return { items, unread: items.filter((n) => !n.read).length, isLoading: query.isPending };
}
