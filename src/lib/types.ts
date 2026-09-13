export type Condition = "new" | "like_new" | "good" | "fair";

export const CONDITIONS: { value: Condition; label: string }[] = [
  { value: "new", label: "New" },
  { value: "like_new", label: "Like new" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
];

export const conditionLabel = (c: string) =>
  CONDITIONS.find((x) => x.value === c)?.label ?? c;

export type ListingStatus = "active" | "sold" | "draft";

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

export function formatPrice(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}
