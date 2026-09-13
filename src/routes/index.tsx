import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Camera, ShieldCheck, Sparkles, Tag } from "lucide-react";

import heroImage from "@/assets/hero.jpg";
import { ProductGrid } from "@/components/product-card";
import { SetupNotice } from "@/components/setup-notice";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { fetchCategories, fetchListings, fetchRecentlyViewed } from "@/lib/marketplace";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Snap & Sell — Buy and sell secondhand finds" },
      {
        name: "description",
        content:
          "Browse cameras, fashion, furniture and more from local sellers, or list your own item in minutes on Snap & Sell.",
      },
      { property: "og:title", content: "Snap & Sell — Buy and sell secondhand finds" },
      {
        property: "og:description",
        content: "A modern marketplace for preloved gear. Snap a photo, set a price, sell it today.",
      },
    ],
  }),
  component: HomePage,
});

function SectionHeading({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <h2 className="font-display text-2xl font-extrabold sm:text-3xl">{title}</h2>
      {action}
    </div>
  );
}

function HomePage() {
  const { user } = useAuth();
  const listings = useQuery({ queryKey: ["listings", "home"], queryFn: () => fetchListings() });
  const categories = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const recent = useQuery({
    queryKey: ["recent", user?.id ?? null],
    queryFn: () => fetchRecentlyViewed(user?.id ?? null),
  });

  const items = listings.data ?? [];

  return (
    <div className="pb-4">
      <section className="border-b bg-surface">
        <div className="container-page grid gap-10 py-12 lg:grid-cols-2 lg:items-center lg:py-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="size-3.5 text-primary" /> Preloved looks brighter
            </span>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] sm:text-5xl lg:text-6xl">
              Snap a photo.
              <br />
              Set a price.
              <br />
              <span className="text-primary">Sell it today.</span>
            </h1>
            <p className="mt-5 max-w-md text-base text-muted-foreground sm:text-lg">
              A marketplace built for quick listings and honest descriptions. Find cameras,
              furniture, records and everyday gear from people nearby.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button size="lg" className="rounded-full" asChild>
                <Link to="/sell">
                  <Camera className="size-4" /> Start selling
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="rounded-full" asChild>
                <Link to="/browse">
                  Browse listings <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
            <dl className="mt-9 grid max-w-md grid-cols-3 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Listing time</dt>
                <dd className="font-display text-xl font-bold">2 min</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Categories</dt>
                <dd className="font-display text-xl font-bold">{categories.data?.length ?? 8}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Seller fees</dt>
                <dd className="font-display text-xl font-bold">$0</dd>
              </div>
            </dl>
          </div>
          <div className="relative">
            <img
              src={heroImage}
              alt="Someone photographing a secondhand camera, sneakers and denim jacket to list for sale"
              width={1600}
              height={1200}
              className="aspect-[4/3] w-full rounded-3xl object-cover shadow-lift"
            />
            <div className="absolute -bottom-5 left-5 hidden items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-soft sm:flex">
              <ShieldCheck className="size-5 text-accent" />
              <div className="text-sm">
                <p className="font-semibold">Seller profiles</p>
                <p className="text-muted-foreground">See who you're buying from</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container-page mt-8">
        <SetupNotice />
      </div>

      <section className="container-page mt-12">
        <SectionHeading title="Shop by category" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(categories.data ?? []).map((c) => (
            <Link
              key={c.id}
              to="/browse"
              search={{ category: c.slug }}
              className="group flex items-center gap-3 rounded-2xl border bg-card p-4 transition-colors hover:border-primary"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-secondary text-secondary-foreground">
                <Tag className="size-4" />
              </span>
              <span className="text-sm font-semibold group-hover:text-primary">{c.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="container-page mt-14">
        <SectionHeading
          title="Fresh listings"
          action={
            <Button variant="ghost" asChild>
              <Link to="/browse">
                See all <ArrowRight className="size-4" />
              </Link>
            </Button>
          }
        />
        {listings.isPending ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
            ))}
          </div>
        ) : items.length ? (
          <ProductGrid listings={items.slice(0, 8)} />
        ) : (
          <p className="text-muted-foreground">No listings yet — be the first to post one.</p>
        )}
      </section>

      {(recent.data?.length ?? 0) > 0 && (
        <section className="container-page mt-14">
          <SectionHeading title="Recently viewed" />
          <ProductGrid listings={(recent.data ?? []).slice(0, 4)} />
        </section>
      )}
    </div>
  );
}
