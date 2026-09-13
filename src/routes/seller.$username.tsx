import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, MapPin } from "lucide-react";

import { ProductGrid } from "@/components/product-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchProfileByUsername, fetchSellerListings } from "@/lib/marketplace";

export const Route = createFileRoute("/seller/$username")({
  head: () => ({
    meta: [
      { title: "Seller profile — Snap & Sell" },
      {
        name: "description",
        content: "See this seller's bio, location and everything they currently have for sale.",
      },
      { property: "og:title", content: "Seller profile — Snap & Sell" },
      {
        property: "og:description",
        content: "Bio, location and active listings from this Snap & Sell seller.",
      },
    ],
  }),
  component: SellerPage,
});

function SellerPage() {
  const { username } = Route.useParams();
  const profile = useQuery({
    queryKey: ["profile", username],
    queryFn: () => fetchProfileByUsername(username),
  });
  const listings = useQuery({
    queryKey: ["seller-listings", profile.data?.id],
    queryFn: () => fetchSellerListings(profile.data!.id),
    enabled: Boolean(profile.data?.id),
  });

  if (profile.isPending) {
    return (
      <div className="container-page py-12">
        <Skeleton className="h-32 w-full rounded-3xl" />
      </div>
    );
  }

  if (!profile.data) {
    return (
      <div className="container-page py-24 text-center">
        <h1 className="font-display text-3xl font-extrabold">Seller not found</h1>
        <Button className="mt-6 rounded-full" asChild>
          <Link to="/browse">Browse listings</Link>
        </Button>
      </div>
    );
  }

  const p = profile.data;
  const items = listings.data ?? [];

  return (
    <div className="container-page py-10">
      <header className="flex flex-col gap-5 rounded-3xl border bg-card p-6 sm:flex-row sm:items-center">
        <Avatar className="size-20">
          <AvatarImage src={p.avatar_url ?? undefined} alt="" />
          <AvatarFallback className="text-2xl">
            {(p.display_name ?? p.username).slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-extrabold">{p.display_name ?? p.username}</h1>
          <p className="text-sm text-muted-foreground">@{p.username}</p>
          {p.bio && <p className="mt-3 max-w-2xl text-sm">{p.bio}</p>}
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
            {p.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-4" /> {p.location}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-4" /> Joined{" "}
              {new Date(p.created_at).toLocaleDateString(undefined, {
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
        </div>
      </header>

      <section className="mt-10">
        <h2 className="mb-5 font-display text-2xl font-extrabold">
          {items.length} active listing{items.length === 1 ? "" : "s"}
        </h2>
        {items.length ? (
          <ProductGrid listings={items} />
        ) : (
          <p className="text-muted-foreground">This seller has nothing listed right now.</p>
        )}
      </section>
    </div>
  );
}
