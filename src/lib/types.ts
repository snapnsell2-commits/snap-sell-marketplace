export type Condition = "new" | "like_new" | "good" | "fair";

export const CONDITIONS: { value: Condition; label: string }[] = [
  { value: "new", label: "New" },
  { value: "like_new", label: "Like new" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
];

export const conditionLabel = (c: string) =>
  CONDITIONS.find((x) => x.value === c)?.label ?? c;

export type ListingStatus = "available" | "reserved" | "sold" | "draft";

export const STATUS_LABELS: Record<string, string> = {
  available: "Available",
  reserved: "Reserved",
  sold: "Sold",
  draft: "Draft",
};

export const statusLabel = (s: string) => STATUS_LABELS[s] ?? s;

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
}

export interface ListingImage {
  id: string;
  listing_id: string;
  url: string;
  position: number;
}

export interface Listing {
  id: string;
  seller_id: string;
  title: string;
  description: string | null;
  price: number;
  currency: string;
  category_slug: string;
  condition: Condition;
  quantity: number;
  status: ListingStatus;
  location: string | null;
  created_at: string;
  images: string[];
  seller?: Profile | null;
}

export interface ListingFilters {
  q?: string;
  category?: string;
  condition?: Condition | "all";
  min?: number;
  max?: number;
  sort?: "new" | "price_asc" | "price_desc";
}

/* ----------------------------- offers ----------------------------- */

export type OfferStatus = "pending" | "accepted" | "rejected" | "cancelled" | "countered";

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  rejected: "Declined",
  cancelled: "Cancelled",
  countered: "Countered",
};

export interface Offer {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  message: string | null;
  status: OfferStatus;
  created_by: string;
  parent_offer_id: string | null;
  created_at: string;
  updated_at: string;
  buyer?: Profile | null;
  seller?: Profile | null;
  listing?: { id: string; title: string; price: number; status: ListingStatus } | null;
}

export interface OfferEvent {
  id: string;
  offer_id: string;
  listing_id: string;
  actor_id: string | null;
  type: string;
  amount: number | null;
  note: string | null;
  created_at: string;
  actor?: Profile | null;
}

/* ----------------------------- chat ----------------------------- */

export type MessageKind = "text" | "image" | "voice";

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  kind: MessageKind;
  body: string | null;
  attachment_url: string | null;
  duration_ms: number | null;
  read_at: string | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  listing_id: string | null;
  buyer_id: string;
  seller_id: string;
  last_message_at: string;
  created_at: string;
  buyer?: Profile | null;
  seller?: Profile | null;
  listing?: { id: string; title: string; price: number; status: ListingStatus } | null;
  last_message?: Message | null;
  unread?: number;
}

/* -------------------------- notifications -------------------------- */

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

export function formatPrice(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
