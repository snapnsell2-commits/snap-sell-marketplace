import { Link } from "@tanstack/react-router";
import { Heart, ImageOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { conditionLabel, formatPrice, type Listing } from "@/lib/types";
import { useWishlist } from "@/lib/use-wishlist";

export function ProductCard({ listing }: { listing: Listing }) {
  const { isSaved, toggle } = useWishlist();
  const saved = isSaved(listing.id);
  const cover = listing.images[0];

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lift">
      <Link
        to="/product/$id"
        params={{ id: listing.id }}
        className="relative block aspect-square overflow-hidden bg-muted"
      >
        {cover ? (
          <img
            src={cover}
            alt={listing.title}
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <ImageOff className="size-8" />
          </div>
        )}
        {listing.status === "sold" && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70">
            <Badge variant="secondary" className="text-sm">
              Sold
            </Badge>
          </div>
        )}
      </Link>

      <button
        type="button"
        onClick={() => toggle(listing.id)}
        aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
        aria-pressed={saved}
        className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-card/90 backdrop-blur transition-colors hover:bg-card"
      >
        <Heart
          className={cn(
            "size-4.5 transition-colors",
            saved ? "fill-primary text-primary" : "text-muted-foreground",
          )}
        />
      </button>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <Link
            to="/product/$id"
            params={{ id: listing.id }}
            className="line-clamp-2 text-sm font-semibold leading-snug hover:text-primary"
          >
            {listing.title}
          </Link>
          <span className="shrink-0 font-display text-base font-bold">
            {formatPrice(listing.price, listing.currency)}
          </span>
        </div>
        <div className="mt-auto flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="rounded-full font-normal">
            {conditionLabel(listing.condition)}
          </Badge>
          {listing.location && <span className="truncate">{listing.location}</span>}
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ listings }: { listings: Listing[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {listings.map((l) => (
        <ProductCard key={l.id} listing={l} />
      ))}
    </div>
  );
}
