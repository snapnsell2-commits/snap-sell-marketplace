import { requireSupabase } from "./supabase";
import type { Conversation, Message, MessageKind } from "./types";

const PROFILE_SELECT = "id, username, display_name, avatar_url, bio, location, created_at";
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

export async function startConversation(input: {
  listingId: string | null;
  buyerId: string;
  sellerId: string;
}): Promise<string> {
  const client = requireSupabase();
  const existing = await client
    .from("conversations")
    .select("id")
    .eq("buyer_id", input.buyerId)
    .eq("seller_id", input.sellerId)
    .eq("listing_id", input.listingId as string)
    .maybeSingle();
  if (existing.data) return (existing.data as { id: string }).id;

  const { data, error } = await client
    .from("conversations")
    .insert({ listing_id: input.listingId, buyer_id: input.buyerId, seller_id: input.sellerId })
    .select("id")
    .single();
  if (error) throw error;
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
  const { data: msgs } = await client
    .from("messages")
    .select("id, conversation_id, sender_id, kind, body, attachment_url, duration_ms, read_at, created_at")
    .in("conversation_id", ids)
    .order("created_at", { ascending: false });

  const all = (msgs ?? []) as Message[];
  return conversations.map((c) => {
    const mine = all.filter((m) => m.conversation_id === c.id);
    return {
      ...c,
      last_message: mine[0] ?? null,
      unread: mine.filter((m) => m.sender_id !== userId && !m.read_at).length,
    };
  });
}

export async function fetchUnreadCount(userId: string): Promise<number> {
  const rows = await fetchConversations(userId);
  return rows.reduce((total, c) => total + (c.unread ?? 0), 0);
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await requireSupabase()
    .from("messages")
    .select("id, conversation_id, sender_id, kind, body, attachment_url, duration_ms, read_at, created_at")
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
  extension: string,
): Promise<string> {
  const client = requireSupabase();
  const path = `${userId}/${conversationId}/${Date.now()}.${extension}`;
  const { error } = await client.storage.from("chat-media").upload(path, file, {
    contentType: file.type || undefined,
    upsert: true,
  });
  if (error) throw error;
  return client.storage.from("chat-media").getPublicUrl(path).data.publicUrl;
}
