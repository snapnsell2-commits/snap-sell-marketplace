import type { Category, Listing, Profile } from "./types";

const img = (seed: string) => `https://picsum.photos/seed/${seed}/900/900`;

export const demoCategories: Category[] = [
  { id: "1", name: "Electronics", slug: "electronics", icon: "Smartphone" },
  { id: "2", name: "Fashion", slug: "fashion", icon: "Shirt" },
  { id: "3", name: "Home & Garden", slug: "home-garden", icon: "Lamp" },
  { id: "4", name: "Sports & Outdoors", slug: "sports-outdoors", icon: "Bike" },
  { id: "5", name: "Books & Media", slug: "books-media", icon: "BookOpen" },
  { id: "6", name: "Toys & Games", slug: "toys-games", icon: "Gamepad2" },
  { id: "7", name: "Collectibles", slug: "collectibles", icon: "Gem" },
  { id: "8", name: "Vehicles", slug: "vehicles", icon: "Car" },
];

export const demoProfiles: Profile[] = [
  {
    id: "u1",
    username: "mayaflips",
    display_name: "Maya Ortiz",
    avatar_url: img("maya-avatar"),
    bio: "Thrift hunter with a weakness for film cameras. Ships within 24h.",
    location: "Austin, TX",
    created_at: "2025-11-02T10:00:00Z",
  },
  {
    id: "u2",
    username: "northloop",
    display_name: "North Loop Goods",
    avatar_url: img("north-avatar"),
    bio: "Small shop clearing out studio gear and mid-century finds.",
    location: "Minneapolis, MN",
    created_at: "2026-01-14T10:00:00Z",
  },
  {
    id: "u3",
    username: "tidalcrate",
    display_name: "Sam Whitfield",
    avatar_url: img("sam-avatar"),
    bio: "Records, books, and the occasional bike part.",
    location: "Portland, OR",
    created_at: "2026-03-21T10:00:00Z",
  },
];

interface Seed {
  id: string;
  seller: string;
  title: string;
  description: string;
  price: number;
  category_slug: string;
  condition: Listing["condition"];
  quantity: number;
  days: number;
}

const seeds: Seed[] = [
  {
    id: "l1",
    seller: "u1",
    title: "Pentax K1000 35mm Film Camera",
    description:
      "Fully working mechanical SLR with 50mm f/2 lens. Light seals replaced last spring, meter reads accurately. Includes original strap and a padded case.",
    price: 189,
    category_slug: "electronics",
    condition: "good",
    quantity: 1,
    days: 1,
  },
  {
    id: "l2",
    seller: "u1",
    title: "Vintage Levi's Denim Trucker Jacket",
    description:
      "Classic medium wash, size M. Broken in perfectly with no rips or missing buttons. Runs slightly boxy.",
    price: 74,
    category_slug: "fashion",
    condition: "like_new",
    quantity: 1,
    days: 2,
  },
  {
    id: "l3",
    seller: "u2",
    title: "Walnut Mid-Century Side Table",
    description:
      "Solid walnut with tapered legs. One small ring mark on the top, shown in the last photo. Local pickup preferred.",
    price: 245,
    category_slug: "home-garden",
    condition: "good",
    quantity: 1,
    days: 3,
  },
  {
    id: "l4",
    seller: "u2",
    title: "Audio-Technica AT2020 Studio Mic",
    description:
      "Cardioid condenser mic, barely used in a home studio. Comes with shock mount and pouch.",
    price: 82,
    category_slug: "electronics",
    condition: "like_new",
    quantity: 2,
    days: 4,
  },
  {
    id: "l5",
    seller: "u3",
    title: "Blue Note Jazz Vinyl Bundle (6 LPs)",
    description:
      "Six original pressings, all VG+ or better. Sleeves have light shelf wear. Shipped double-boxed.",
    price: 130,
    category_slug: "books-media",
    condition: "good",
    quantity: 1,
    days: 5,
  },
  {
    id: "l6",
    seller: "u3",
    title: "Chrome Road Bike Wheelset 700c",
    description:
      "Lightly ridden wheelset, true and smooth. Includes rim tape, no tires.",
    price: 210,
    category_slug: "sports-outdoors",
    condition: "good",
    quantity: 1,
    days: 6,
  },
  {
    id: "l7",
    seller: "u1",
    title: "Ceramic Planter Set of 3",
    description:
      "Hand-glazed stoneware planters with drainage holes and matching saucers. Brand new, never potted.",
    price: 48,
    category_slug: "home-garden",
    condition: "new",
    quantity: 5,
    days: 7,
  },
  {
    id: "l8",
    seller: "u2",
    title: "Nintendo Game Boy Color — Teal",
    description:
      "Screen is bright with no dead pixels, battery contacts cleaned. Includes two cartridges.",
    price: 95,
    category_slug: "toys-games",
    condition: "good",
    quantity: 1,
    days: 8,
  },
  {
    id: "l9",
    seller: "u3",
    title: "Leather Weekender Duffel",
    description:
      "Full-grain leather with brass hardware. Some patina on the base corners, structurally perfect.",
    price: 160,
    category_slug: "fashion",
    condition: "good",
    quantity: 1,
    days: 9,
  },
  {
    id: "l10",
    seller: "u1",
    title: "Polaroid SX-70 Land Camera",
    description:
      "Folding classic, tested with fresh film. Leather is intact, bellows light-tight.",
    price: 320,
    category_slug: "collectibles",
    condition: "like_new",
    quantity: 1,
    days: 10,
  },
  {
    id: "l11",
    seller: "u2",
    title: "Adjustable Dumbbell Pair 5–52 lb",
    description:
      "Dial-style adjustable dumbbells with stands. Minor scuffs on the plates from normal use.",
    price: 289,
    category_slug: "sports-outdoors",
    condition: "good",
    quantity: 1,
    days: 11,
  },
  {
    id: "l12",
    seller: "u3",
    title: "Architecture Monograph Collection",
    description:
      "Twelve hardcover titles on modernist architecture. Dust jackets included, pages clean.",
    price: 115,
    category_slug: "books-media",
    condition: "like_new",
    quantity: 1,
    days: 12,
  },
];

export const demoListings: Listing[] = seeds.map((s) => {
  const seller = demoProfiles.find((p) => p.id === s.seller) ?? null;
  return {
    id: s.id,
    seller_id: s.seller,
    title: s.title,
    description: s.description,
    price: s.price,
    currency: "USD",
    category_slug: s.category_slug,
    condition: s.condition,
    quantity: s.quantity,
    status: "active",
    location: seller?.location ?? null,
    created_at: new Date(Date.now() - s.days * 86400000).toISOString(),
    images: [img(`${s.id}-a`), img(`${s.id}-b`), img(`${s.id}-c`)],
    seller,
  };
});
