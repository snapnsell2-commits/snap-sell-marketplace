import { requireSupabase } from "./supabase";
import type { AppNotification } from "./types";

export async function fetchNotifications(userId: string): Promise<AppNotification[]> {
  const { data, error } = await requireSupabase()
    .from("notifications")
    .select("id, user_id, type, title, body, link, read, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) throw error;
  return (data ?? []) as AppNotification[];
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await requireSupabase().from("notifications").update({ read: true }).eq("id", id);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await requireSupabase()
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);
  if (error) throw error;
}
