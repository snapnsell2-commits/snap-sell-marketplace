import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth";
import { supabase, uniqueChannel } from "@/lib/supabase";

/**
 * The single live connection for the signed-in person. It shows a toast for new
 * notifications and keeps the notification bell, unread badge, inbox and offers
 * fresh. Render it exactly once (it lives in the site header).
 */
export function RealtimeBridge() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!supabase || !userId) return;

    const channel = uniqueChannel(`live:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as { title: string; body: string | null; link: string | null };
          const here = window.location.pathname + window.location.search;
          // Don't toast about the chat you are already looking at.
          if (!row.link || row.link !== here) {
            const link = row.link;
            toast(row.title, {
              ...(row.body ? { description: row.body } : {}),
              ...(link
                ? { action: { label: "View", onClick: () => void router.history.push(link) } }
                : {}),
            });
          }
          void queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
          void queryClient.invalidateQueries({ queryKey: ["offers"] });
          void queryClient.invalidateQueries({ queryKey: ["offer-history"] });
          void queryClient.invalidateQueries({ queryKey: ["listing"] });
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["unread", userId] });
        void queryClient.invalidateQueries({ queryKey: ["conversations", userId] });
      })
      .subscribe();

    return () => {
      void supabase?.removeChannel(channel);
    };
  }, [userId, queryClient, router]);

  return null;
}
