import { extensionFor } from "./images";
import { requireSupabase } from "./supabase";
import type { Conversation, Message, MessageKind } from "./types";

const PROFILE_SELECT = "id, username, display_name, avatar_url, bio, location, created_at";
const MESSAGE_SELECT =
  "id, conversation_id, sender_id, kind, body, attachment_url, duration_ms, read_at, created_at";
const CONVERSATION_SELECT = `id, listing_id, buyer_id, seller_id, last_message_at, created_at,
  buyer:profiles!conversations_buyer_id_fkey(${PROFILE_SELECT}),
  seller:profiles!conversations_seller_id_fkey(${PROFILE_SELECT}),
  listing:listings(id, title, price, status)`;

/* eslint-disable @typescript-eslint/no-explicit-any */
const one = <T,>(v: any): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

function mapConversation(row: any): Conversation {
  return {
    ...row,
    buyer: one(row.buyer),
    seller: one(row.seller),
    listing: one(row.listing),
  } as Conversation;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Finds the existing chat for this listing + pair of people, or creates it. */
export async function startConversation(input: {
  listingId: string | null;
  buyerId: string;
  sellerId: string;
}): Promise<string> {
  if (input.buyerId === input.sellerId) throw new Error("You can't message yourself.");
  const client = requireSupabase();

  const find = async (): Promise<string | null> => {
    let query = client
      .from("conversations")
      .select("id")
      .eq("buyer_id", input.buyerId)
      .eq("seller_id", input.sellerId);
    // `.eq(col, null)` never matches in SQL; a missing listing needs `.is(col, null)`.
    query = input.listingId ? query.eq("listing_id", input.listingId) : query.is("listing_id", null);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return (data as { id: string } | null)?.id ?? null;
  };

  const existing = await find();
  if (existing) return existing;

  const { data, error } = await client
    .from("conversations")
    .insert({ listing_id: input.listingId, buyer_id: input.buyerId, seller_id: input.sellerId })
    .select("id")
    .single();
  if (error) {
    // Two taps at once: the other request created it first, so just use that one.
    if (error.code === "23505") {
      const again = await find();
      if (again) return again;
    }
    throw error;
  }
  return (data as { id: string }).id;
}

export async function fetchConversations(userId: string): Promise<Conversation[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("conversations")
    .select(CONVERSATION_SELECT)
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order("last_message_at", { ascending: false });
  if (error) throw error;
  const conversations = (data ?? []).map(mapConversation);
  if (!conversations.length) return [];

  const ids = conversations.map((c) => c.id);
  const [latest, unread] = await Promise.all([
    client
      .from("messages")
      .select(MESSAGE_SELECT)
      .in("conversation_id", ids)
      .order("created_at", { ascending: false })
      .limit(Math.min(500, Math.max(60, ids.length * 20))),
    client
      .from("messages")
      .select("conversation_id")
      .in("conversation_id", ids)
      .neq("sender_id", userId)
      .is("read_at", null)
      .limit(2000),
  ]);

  const recent = (latest.data ?? []) as Message[];
  const unreadByConversation = new Map<string, number>();
  for (const row of (unread.data ?? []) as { conversation_id: string }[]) {
    unreadByConversation.set(row.conversation_id, (unreadByConversation.get(row.conversation_id) ?? 0) + 1);
  }

  return conversations.map((c) => ({
    ...c,
    last_message: recent.find((m) => m.conversation_id === c.id) ?? null,
    unread: unreadByConversation.get(c.id) ?? 0,
  }));
}

/** Total unread messages — a cheap count query, used by the header badge. */
export async function fetchUnreadCount(userId: string): Promise<number> {
  const { count, error } = await requireSupabase()
    .from("messages")
    .select("id", { count: "exact", head: true })
    .neq("sender_id", userId)
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await requireSupabase()
    .from("messages")
    .select(MESSAGE_SELECT)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Message[];
}

export async function sendMessage(input: {
  conversationId: string;
  senderId: string;
  kind?: MessageKind;
  body?: string | null;
  attachmentUrl?: string | null;
  durationMs?: number | null;
}): Promise<void> {
  const { error } = await requireSupabase().from("messages").insert({
    conversation_id: input.conversationId,
    sender_id: input.senderId,
    kind: input.kind ?? "text",
    body: input.body ?? null,
    attachment_url: input.attachmentUrl ?? null,
    duration_ms: input.durationMs ?? null,
  });
  if (error) throw error;
}

export async function markConversationRead(conversationId: string, userId: string): Promise<void> {
  const { error } = await requireSupabase()
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .neq("sender_id", userId)
    .is("read_at", null);
  if (error) throw error;
}

export async function uploadChatMedia(
  userId: string,
  conversationId: string,
  file: Blob,
  fileName?: string,
): Promise<string> {
  const client = requireSupabase();
  const path = `${userId}/${conversationId}/${Date.now()}.${extensionFor(file, fileName)}`;
  // Strip codec details ("audio/webm;codecs=opus" → "audio/webm") so storage accepts it.
  const contentType = (file.type || "").split(";")[0] || undefined;
  const { error } = await client.storage.from("chat-media").upload(path, file, {
    ...(contentType ? { contentType } : {}),
    upsert: true,
  });
  if (error) throw error;
  return client.storage.from("chat-media").getPublicUrl(path).data.publicUrl;
}
