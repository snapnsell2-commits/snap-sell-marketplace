import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, MapPin, Package, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { ProductGrid } from "@/components/product-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { fetchListing, fetchRecentlyViewed, fetchSellerListings, recordView } from "@/lib/marketplace";
import { conditionLabel, formatPrice } from "@/lib/types";
import { useWishlist } from "@/lib/use-wishlist";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/product/$id")({
  head: () => ({
    meta: [
      { title: "Listing details — Snap & Sell" },
      {
        name: "description",
        content:
          "See photos, price, condition, quantity and the seller behind this Snap & Sell listing.",
      },
      { property: "og:title", content: "Listing details — Snap & Sell" },
      {
        property: "og:description",
        content: "Photos, price, condition and seller details for this Snap & Sell listing.",
      },
    ],
  }),
  component: ProductPage,
});

function ProductPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { isSaved, toggle } = useWishlist();
  const [active, setActive] = useState(0);

  const listing = useQuery({ queryKey: ["listing", id], queryFn: () => fetchListing(id) });
  const sellerId = listing.data?.seller_id;
  const more = useQuery({
    queryKey: ["seller-listings", sellerId],
    queryFn: () => fetchSellerListings(sellerId as string),
    enabled: Boolean(sellerId),
  });
  const recent = useQuery({
    queryKey: ["recent", user?.id ?? null],
    queryFn: () => fetchRecentlyViewed(user?.id ?? null),
  });

  useEffect(() => {
    if (listing.data) void recordView(user?.id ?? null, listing.data.id);
  }, [listing.data, user?.id]);

  if (listing.isPending) {
    return (
      <div className="container-page grid gap-8 py-10 lg:grid-cols-2">
        <Skeleton className="aspect-square rounded-3xl" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  const item = listing.data;
  if (!item) {
    return (
      <div className="container-page py-24 text-center">
        <h1 className="font-display text-3xl font-extrabold">Listing not found</h1>
        <p className="mt-2 text-muted-foreground">It may have been sold or removed.</p>
        <Button className="mt-6 rounded-full" asChild>
          <Link to="/browse">Keep browsing</Link>
        </Button>
      </div>
    );
  }

  const saved = isSaved(item.id);
  const others = (more.data ?? []).filter((l) => l.id !== item.id).slice(0, 4);
  const recentOthers = (recent.data ?? []).filter((l) => l.id !== item.id).slice(0, 4);

  return (
    <div className="container-page py-8">
      <div className="grid gap-10 lg:grid-cols-2">
        <div>
          <div className="overflow-hidden rounded-3xl border bg-muted">
            {item.images[active] ? (
              <img
                src={item.images[active]}
                alt={item.title}
                className="aspect-square w-full object-cover"
              />
            ) : (
              <div className="grid aspect-square place-items-center text-muted-foreground">
                No photo
              </div>
            )}
          </div>
          {item.images.length > 1 && (
            <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
              {item.images.map((src, i) => (
                <button
                  key={src}
                  onClick={() => setActive(i)}
                  aria-label={`Show photo ${i + 1}`}
                  className={cn(
                    "size-20 shrink-0 overflow-hidden rounded-xl border-2 transition-colors",
                    i === active ? "border-primary" : "border-transparent",
                  )}
                >
                  <img src={src} alt="" loading="lazy" className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full">
              {conditionLabel(item.condition)}
            </Badge>
            <Badge variant="outline" className="rounded-full capitalize">
              {item.category_slug.replace(/-/g, " ")}
            </Badge>
          </div>
          <h1 className="mt-3 font-display text-3xl font-extrabold sm:text-4xl">{item.title}</h1>
          <p className="mt-3 font-display text-4xl font-extrabold text-primary">
            {formatPrice(item.price, item.currency)}
          </p>

          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Package className="size-4" /> {item.quantity} available
            </span>
            {item.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-4" /> {item.location}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-4" /> Listed{" "}
              {new Date(item.created_at).toLocaleDateString()}
            </span>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg" className="rounded-full">
              Contact seller
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="rounded-full"
              onClick={() => toggle(item.id)}
            >
              <Heart className={cn("size-4", saved && "fill-primary text-primary")} />
              {saved ? "Saved" : "Save"}
            </Button>
          </div>

          <Separator className="my-7" />

          <h2 className="font-display text-lg font-bold">Description</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {item.description || "The seller didn't add a description."}
          </p>

          {item.seller && (
            <>
              <Separator className="my-7" />
              <h2 className="font-display text-lg font-bold">Seller</h2>
              <Link
                to="/seller/$username"
                params={{ username: item.seller.username }}
                className="mt-3 flex items-center gap-4 rounded-2xl border bg-card p-4 transition-colors hover:border-primary"
              >
                <Avatar className="size-12">
                  <AvatarImage src={item.seller.avatar_url ?? undefined} alt="" />
                  <AvatarFallback>
                    {(item.seller.display_name ?? item.seller.username).slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-semibold">
                    {item.seller.display_name ?? item.seller.username}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    @{item.seller.username}
                    {item.seller.location ? ` · ${item.seller.location}` : ""}
                  </p>
                </div>
              </Link>
            </>
          )}
        </div>
      </div>

      {others.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-5 font-display text-2xl font-extrabold">More from this seller</h2>
          <ProductGrid listings={others} />
        </section>
      )}

      {recentOthers.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-5 font-display text-2xl font-extrabold">Recently viewed</h2>
          <ProductGrid listings={recentOthers} />
        </section>
      )}
    </div>
  );
}
