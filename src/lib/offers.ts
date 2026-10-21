import { requireSupabase } from "./supabase";
import type { Offer, OfferEvent, OfferStatus } from "./types";

const PROFILE_SELECT = "id, username, display_name, avatar_url, bio, location, created_at";
const OFFER_SELECT = `id, listing_id, buyer_id, seller_id, amount, message, status, created_by, parent_offer_id, created_at, updated_at,
  buyer:profiles!offers_buyer_id_fkey(${PROFILE_SELECT}),
  seller:profiles!offers_seller_id_fkey(${PROFILE_SELECT}),
  listing:listings(id, title, price, status)`;

/* eslint-disable @typescript-eslint/no-explicit-any */
const one = <T,>(v: any): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

function mapOffer(row: any): Offer {
  return {
    ...row,
    amount: Number(row.amount),
    buyer: one(row.buyer),
    seller: one(row.seller),
    listing: one(row.listing),
  } as Offer;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function fetchOffersForListing(listingId: string): Promise<Offer[]> {
  const { data, error } = await requireSupabase()
    .from("offers")
    .select(OFFER_SELECT)
    .eq("listing_id", listingId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapOffer);
}

export async function fetchMyOffers(userId: string): Promise<Offer[]> {
  const { data, error } = await requireSupabase()
    .from("offers")
    .select(OFFER_SELECT)
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapOffer);
}

export async function fetchOfferHistory(listingId: string): Promise<OfferEvent[]> {
  const { data, error } = await requireSupabase()
    .from("offer_events")
    .select(`id, offer_id, listing_id, actor_id, type, amount, note, created_at, actor:profiles(${PROFILE_SELECT})`)
    .eq("listing_id", listingId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  return (data ?? []).map((r: any) => ({
    ...r,
    amount: r.amount === null ? null : Number(r.amount),
    actor: one(r.actor),
  })) as OfferEvent[];
}

export async function sendOffer(input: {
  listingId: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  message?: string | null;
  createdBy: string;
  parentOfferId?: string | null;
}): Promise<void> {
  const { error } = await requireSupabase().from("offers").insert({
    listing_id: input.listingId,
    buyer_id: input.buyerId,
    seller_id: input.sellerId,
    amount: input.amount,
    message: input.message ?? null,
    created_by: input.createdBy,
    parent_offer_id: input.parentOfferId ?? null,
  });
  if (error) throw error;
}

export async function setOfferStatus(offerId: string, status: OfferStatus): Promise<void> {
  const { error } = await requireSupabase().from("offers").update({ status }).eq("id", offerId);
  if (error) throw error;
}

/**
 * Counter an offer. The original is marked countered and the new offer is
 * created in one database step, so you can never end up with only half of it.
 */
export async function counterOffer(offer: Offer, amount: number, message?: string | null) {
  const { error } = await requireSupabase().rpc("counter_offer", {
    _offer: offer.id,
    _amount: amount,
    _message: message ?? null,
  });
  if (error) throw error;
}
