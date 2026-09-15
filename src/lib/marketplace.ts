import { demoCategories, demoListings, demoProfiles } from "./demo-data";
import { isSupabaseConfigured, requireSupabase, supabase } from "./supabase";
import type { Category, Listing, ListingFilters, Profile } from "./types";

const LISTING_SELECT =
  "id, seller_id, title, description, price, currency, category_slug, condition, quantity, status, location, created_at, listing_images(url, position), seller:profiles(id, username, display_name, avatar_url, bio, location, created_at)";

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapListing(row: any): Listing {
  const images = ((row.listing_images ?? []) as { url: string; position: number }[])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((i) => i.url);
  return {
    id: row.id,
    seller_id: row.seller_id,
    title: row.title,
    description: row.description,
    price: Number(row.price),
    currency: row.currency ?? "USD",
    category_slug: row.category_slug,
    condition: row.condition,
    quantity: row.quantity ?? 1,
    status: row.status,
    location: row.location,
    created_at: row.created_at,
    images: images.length ? images : [],
    seller: Array.isArray(row.seller) ? (row.seller[0] ?? null) : (row.seller ?? null),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function applyDemoFilters(filters: ListingFilters): Listing[] {
  let rows = demoListings.filter((l) => l.status !== "draft");
  if (filters.q) {
    const q = filters.q.toLowerCase();
    rows = rows.filter(
      (l) => l.title.toLowerCase().includes(q) || (l.description ?? "").toLowerCase().includes(q),
    );
  }
  if (filters.category && filters.category !== "all") {
    rows = rows.filter((l) => l.category_slug === filters.category);
  }
  if (filters.condition && filters.condition !== "all") {
    rows = rows.filter((l) => l.condition === filters.condition);
  }
  if (typeof filters.min === "number") rows = rows.filter((l) => l.price >= filters.min!);
  if (typeof filters.max === "number") rows = rows.filter((l) => l.price <= filters.max!);
  if (filters.sort === "price_asc") rows = rows.slice().sort((a, b) => a.price - b.price);
  else if (filters.sort === "price_desc") rows = rows.slice().sort((a, b) => b.price - a.price);
  else rows = rows.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
  return rows;
}

export async function fetchCategories(): Promise<Category[]> {
  if (!isSupabaseConfigured) return demoCategories;
  const { data, error } = await requireSupabase()
    .from("categories")
    .select("id, name, slug, icon")
    .order("name");
  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function fetchListings(filters: ListingFilters = {}): Promise<Listing[]> {
  if (!isSupabaseConfigured) return applyDemoFilters(filters);
  let query = requireSupabase().from("listings").select(LISTING_SELECT).neq("status", "draft");

  if (filters.q) query = query.ilike("title", `%${filters.q}%`);
  if (filters.category && filters.category !== "all")
    query = query.eq("category_slug", filters.category);
  if (filters.condition && filters.condition !== "all")
    query = query.eq("condition", filters.condition);
  if (typeof filters.min === "number") query = query.gte("price", filters.min);
  if (typeof filters.max === "number") query = query.lte("price", filters.max);

  if (filters.sort === "price_asc") query = query.order("price", { ascending: true });
  else if (filters.sort === "price_desc") query = query.order("price", { ascending: false });
  else query = query.order("created_at", { ascending: false });

  const { data, error } = await query.limit(60);
  if (error) throw error;
  return (data ?? []).map(mapListing);
}

export async function fetchListing(id: string): Promise<Listing | null> {
  if (!isSupabaseConfigured) return demoListings.find((l) => l.id === id) ?? null;
  const { data, error } = await requireSupabase()
    .from("listings")
    .select(LISTING_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapListing(data) : null;
}

export async function fetchProfileByUsername(username: string): Promise<Profile | null> {
  if (!isSupabaseConfigured)
    return demoProfiles.find((p) => p.username === username) ?? null;
  const { data, error } = await requireSupabase()
    .from("profiles")
    .select("id, username, display_name, avatar_url, bio, location, created_at")
    .eq("username", username)
    .maybeSingle();
  if (error) throw error;
  return (data as Profile) ?? null;
}

export async function fetchSellerListings(
  sellerId: string,
  includeAll = false,
): Promise<Listing[]> {
  if (!isSupabaseConfigured)
    return demoListings.filter(
      (l) => l.seller_id === sellerId && (includeAll || l.status !== "draft"),
    );
  let query = requireSupabase()
    .from("listings")
    .select(LISTING_SELECT)
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false });
  if (!includeAll) query = query.neq("status", "draft");
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapListing);
}

/* ---------------- wishlist ---------------- */

const localKey = (name: string) => `snapsell-${name}`;

function readLocal(name: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(localKey(name)) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function writeLocal(name: string, ids: string[]) {
  try {
    localStorage.setItem(localKey(name), JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

export async function fetchWishlistIds(userId: string | null): Promise<string[]> {
  if (!isSupabaseConfigured || !userId) return readLocal("wishlist");
  const { data, error } = await requireSupabase()
    .from("wishlists")
    .select("listing_id")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((r: { listing_id: string }) => r.listing_id);
}

export async function toggleWishlist(
  userId: string | null,
  listingId: string,
  saved: boolean,
): Promise<void> {
  if (!isSupabaseConfigured || !userId) {
    const ids = readLocal("wishlist");
    writeLocal("wishlist", saved ? ids.filter((i) => i !== listingId) : [...new Set([...ids, listingId])]);
    return;
  }
  const client = requireSupabase();
  if (saved) {
    const { error } = await client
      .from("wishlists")
      .delete()
      .eq("user_id", userId)
      .eq("listing_id", listingId);
    if (error) throw error;
  } else {
    const { error } = await client
      .from("wishlists")
      .upsert({ user_id: userId, listing_id: listingId }, { onConflict: "user_id,listing_id" });
    if (error) throw error;
  }
}

export async function fetchListingsByIds(ids: string[]): Promise<Listing[]> {
  if (!ids.length) return [];
  if (!isSupabaseConfigured) {
    return ids
      .map((id) => demoListings.find((l) => l.id === id))
      .filter((l): l is Listing => Boolean(l));
  }
  const { data, error } = await requireSupabase()
    .from("listings")
    .select(LISTING_SELECT)
    .in("id", ids);
  if (error) throw error;
  const rows = (data ?? []).map(mapListing);
  return ids.map((id) => rows.find((r) => r.id === id)).filter((l): l is Listing => Boolean(l));
}

/* ------------- recently viewed ------------- */

export async function recordView(userId: string | null, listingId: string): Promise<void> {
  const ids = [listingId, ...readLocal("recent").filter((i) => i !== listingId)].slice(0, 12);
  writeLocal("recent", ids);
  if (!isSupabaseConfigured || !userId) return;
  await requireSupabase()
    .from("recently_viewed")
    .upsert(
      { user_id: userId, listing_id: listingId, viewed_at: new Date().toISOString() },
      { onConflict: "user_id,listing_id" },
    );
}

export async function fetchRecentlyViewed(userId: string | null): Promise<Listing[]> {
  if (!isSupabaseConfigured || !userId) return fetchListingsByIds(readLocal("recent"));
  const { data, error } = await requireSupabase()
    .from("recently_viewed")
    .select("listing_id")
    .eq("user_id", userId)
    .order("viewed_at", { ascending: false })
    .limit(12);
  if (error) throw error;
  return fetchListingsByIds((data ?? []).map((r: { listing_id: string }) => r.listing_id));
}

/* --------------- seller actions --------------- */

export interface NewListingInput {
  title: string;
  description: string;
  price: number;
  category_slug: string;
  condition: string;
  quantity: number;
  location: string | null;
  images: File[];
}

export async function uploadListingImages(
  userId: string,
  listingId: string,
  files: File[],
): Promise<string[]> {
  const client = requireSupabase();
  const urls: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i]!;
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${userId}/${listingId}/${i}-${Date.now()}.${ext}`;
    const { error } = await client.storage.from("listing-images").upload(path, file, {
      upsert: true,
      contentType: file.type,
    });
    if (error) throw error;
    urls.push(client.storage.from("listing-images").getPublicUrl(path).data.publicUrl);
  }
  return urls;
}

export async function createListing(userId: string, input: NewListingInput): Promise<string> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("listings")
    .insert({
      seller_id: userId,
      title: input.title,
      description: input.description,
      price: input.price,
      category_slug: input.category_slug,
      condition: input.condition,
      quantity: input.quantity,
      location: input.location,
      status: "available",
    })
    .select("id")
    .single();
  if (error) throw error;
  const listingId = (data as { id: string }).id;

  if (input.images.length) {
    const urls = await uploadListingImages(userId, listingId, input.images);
    const { error: imgError } = await client
      .from("listing_images")
      .insert(urls.map((url, position) => ({ listing_id: listingId, url, position })));
    if (imgError) throw imgError;
  }
  return listingId;
}

export async function updateListingStatus(id: string, status: string): Promise<void> {
  const { error } = await requireSupabase().from("listings").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function deleteListing(id: string): Promise<void> {
  const { error } = await requireSupabase().from("listings").delete().eq("id", id);
  if (error) throw error;
}

export async function updateProfile(
  userId: string,
  values: Partial<Pick<Profile, "username" | "display_name" | "bio" | "location" | "avatar_url">>,
): Promise<void> {
  const { error } = await requireSupabase()
    .from("profiles")
    .update(values)
    .eq("id", userId);
  if (error) throw error;
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const client = requireSupabase();
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${userId}/avatar-${Date.now()}.${ext}`;
  const { error } = await client.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  return client.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}

export { supabase };
