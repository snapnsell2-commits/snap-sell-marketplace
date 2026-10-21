import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ProductGrid } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchCategories, fetchListings } from "@/lib/marketplace";
import { CONDITIONS, type Condition } from "@/lib/types";

interface BrowseSearch {
  q?: string | undefined;
  category?: string | undefined;
  condition?: Condition | "all" | undefined;
  min?: number | undefined;
  max?: number | undefined;
  sort?: "new" | "price_asc" | "price_desc" | undefined;
}

export const Route = createFileRoute("/browse")({
  validateSearch: (search: Record<string, unknown>): BrowseSearch => ({
    q: typeof search['q'] === "string" && search['q'] ? search['q'] : undefined,
    category: typeof search['category'] === "string" ? search['category'] : undefined,
    condition: typeof search['condition'] === "string" ? (search['condition'] as Condition) : undefined,
    min: search['min'] != null && !Number.isNaN(Number(search['min'])) ? Number(search['min']) : undefined,
    max: search['max'] != null && !Number.isNaN(Number(search['max'])) ? Number(search['max']) : undefined,
    sort:
      search['sort'] === "price_asc" || search['sort'] === "price_desc" || search['sort'] === "new"
        ? search['sort']
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Browse listings — Snap & Sell" },
      {
        name: "description",
        content:
          "Search every Snap & Sell listing and filter by category, condition and price to find exactly what you want.",
      },
      { property: "og:title", content: "Browse listings — Snap & Sell" },
      {
        property: "og:description",
        content: "Filter secondhand listings by category, condition and price on Snap & Sell.",
      },
    ],
  }),
  component: BrowsePage,
});

function BrowsePage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/browse" });
  const categories = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const listings = useQuery({
    queryKey: ["listings", search],
    queryFn: () => fetchListings(search),
  });

  const update = (patch: Partial<BrowseSearch>) =>
    void navigate({ search: (prev) => ({ ...prev, ...patch }) });

  // Typing in the keyword box shouldn't fire a search on every keystroke.
  const [keyword, setKeyword] = useState(search.q ?? "");
  const lastSent = useRef(search.q ?? "");
  useEffect(() => {
    // The URL changed from somewhere else (Clear button, header search): mirror it.
    if ((search.q ?? "") !== lastSent.current) {
      lastSent.current = search.q ?? "";
      setKeyword(search.q ?? "");
    }
  }, [search.q]);
  useEffect(() => {
    const wanted = keyword.trim();
    if (wanted === lastSent.current) return;
    const timer = window.setTimeout(() => {
      lastSent.current = wanted;
      update({ q: wanted || undefined });
    }, 350);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword]);

  const hasFilters = Boolean(
    search.q || search.category || (search.condition && search.condition !== "all") || search.min || search.max,
  );

  const items = listings.data ?? [];

  return (
    <div className="container-page py-8">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
          {search.q ? `Results for “${search.q}”` : "Browse everything"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {listings.isPending ? "Loading listings…" : `${items.length} listing${items.length === 1 ? "" : "s"} available`}
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside className="h-max rounded-2xl border bg-card p-5 lg:sticky lg:top-24">
          <div className="mb-4 flex items-center justify-between">
            <p className="flex items-center gap-2 font-semibold">
              <SlidersHorizontal className="size-4" /> Filters
            </p>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  void navigate({ search: { sort: search.sort } })
                }
              >
                <X className="size-3.5" /> Clear
              </Button>
            )}
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="keyword">Keyword</Label>
              <Input
                id="keyword"
                value={keyword}
                placeholder="e.g. camera"
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={search.category ?? "all"}
                onValueChange={(v) => update({ category: v === "all" ? undefined : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {(categories.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.slug}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Condition</Label>
              <Select
                value={search.condition ?? "all"}
                onValueChange={(v) =>
                  update({ condition: v === "all" ? undefined : (v as Condition) })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any condition" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any condition</SelectItem>
                  {CONDITIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="min">Min price</Label>
                <Input
                  id="min"
                  type="number"
                  min={0}
                  value={search.min ?? ""}
                  onChange={(e) => update({ min: e.target.value ? Number(e.target.value) : undefined })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max">Max price</Label>
                <Input
                  id="max"
                  type="number"
                  min={0}
                  value={search.max ?? ""}
                  onChange={(e) => update({ max: e.target.value ? Number(e.target.value) : undefined })}
                />
              </div>
            </div>
          </div>
        </aside>

        <section>
          <div className="mb-4 flex justify-end">
            <Select
              value={search.sort ?? "new"}
              onValueChange={(v) => update({ sort: v as BrowseSearch["sort"] })}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Newest first</SelectItem>
                <SelectItem value="price_asc">Price: low to high</SelectItem>
                <SelectItem value="price_desc">Price: high to low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {listings.isPending ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
              ))}
            </div>
          ) : items.length ? (
            <ProductGrid listings={items} />
          ) : (
            <div className="rounded-2xl border border-dashed p-12 text-center">
              <p className="font-display text-lg font-bold">Nothing matched those filters</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try widening your price range or clearing the category.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
