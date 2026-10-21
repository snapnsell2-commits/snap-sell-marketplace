import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { ProductGrid } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchListingsByIds } from "@/lib/marketplace";
import { useWishlist } from "@/lib/use-wishlist";

export const Route = createFileRoute("/wishlist")({
  head: () => ({
    meta: [
      { title: "Your wishlist — Snap & Sell" },
      { name: "description", content: "Everything you've saved on Snap & Sell, in one place." },
      { property: "og:title", content: "Your wishlist — Snap & Sell" },
      { property: "og:description", content: "Keep track of the listings you love on Snap & Sell." },
    ],
  }),
  component: WishlistPage,
});

function WishlistPage() {
  const { ids, isLoading } = useWishlist();
  const listings = useQuery({
    queryKey: ["wishlist-listings", ids],
    queryFn: () => fetchListingsByIds(ids),
    enabled: !isLoading,
  });

  return (
    <div className="container-page py-10">
      <h1 className="font-display text-3xl font-extrabold">Your wishlist</h1>
      <p className="mt-2 text-muted-foreground">Saved listings you can come back to anytime.</p>

      {isLoading || listings.isPending ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/5] rounded-3xl" />
          ))}
        </div>
      ) : (listings.data ?? []).length === 0 ? (
        <div className="mt-12 rounded-3xl border border-dashed py-16 text-center">
          <p className="text-muted-foreground">Nothing saved yet.</p>
          <Button className="mt-5 rounded-full" asChild>
            <Link to="/browse">Find something you love</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-8">
          <ProductGrid listings={listings.data ?? []} />
        </div>
      )}
    </div>
  );
}
