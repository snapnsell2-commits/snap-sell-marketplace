import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ImageOff } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { deleteListing, fetchSellerListings, updateListingStatus } from "@/lib/marketplace";
import { fetchMyOffers, setOfferStatus } from "@/lib/offers";
import { formatPrice, OFFER_STATUS_LABELS, statusLabel, timeAgo } from "@/lib/types";
import { errorMessage } from "@/lib/utils";

export const Route = createFileRoute("/dashboard")({
  validateSearch: (search: Record<string, unknown>): { tab?: "listings" | "offers" | undefined } =>
    search["tab"] === "offers" ? { tab: "offers" } : {},
  head: () => ({
    meta: [
      { title: "Your listings and offers — Snap & Sell" },
      {
        name: "description",
        content: "Manage your listings, mark items reserved or sold and respond to offers.",
      },
      { property: "og:title", content: "Your listings and offers — Snap & Sell" },
      { property: "og:description", content: "Your Snap & Sell seller dashboard." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const { tab } = Route.useSearch();
  const navigate = useNavigate();

  const listings = useQuery({
    queryKey: ["my-listings", user?.id ?? null],
    queryFn: () => fetchSellerListings(user!.id, true),
    enabled: Boolean(user),
  });
  const offers = useQuery({
    queryKey: ["offers", "mine", user?.id ?? null],
    queryFn: () => fetchMyOffers(user!.id),
    enabled: Boolean(user),
  });

  const mutate = useMutation({
    mutationFn: async (fn: () => Promise<void>) => fn(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["my-listings"] });
      void queryClient.invalidateQueries({ queryKey: ["offers"] });
    },
    onError: (e: unknown) => toast.error(errorMessage(e)),
  });

  if (loading) {
    return <div className="container-page py-24 text-center text-muted-foreground">Loading…</div>;
  }

  if (!user) {
    return (
      <div className="container-page py-24 text-center">
        <h1 className="font-display text-3xl font-extrabold">Sign in to see your dashboard</h1>
        <Button className="mt-6 rounded-full" asChild>
          <Link to="/auth" search={{ redirect: "/dashboard" }}>Sign in</Link>
        </Button>
      </div>
    );
  }

  const rows = listings.data ?? [];
  const offerRows = offers.data ?? [];

  return (
    <div className="container-page py-10">
      <h1 className="font-display text-3xl font-extrabold">Your dashboard</h1>

      <Tabs
        value={tab ?? "listings"}
        onValueChange={(v) =>
          void navigate({ to: "/dashboard", search: v === "offers" ? { tab: "offers" } : {} })
        }
        className="mt-6"
      >
        <TabsList className="rounded-full">
          <TabsTrigger value="listings" className="rounded-full">Listings</TabsTrigger>
          <TabsTrigger value="offers" className="rounded-full">Offers</TabsTrigger>
        </TabsList>

        <TabsContent value="listings" className="pt-6">
          {rows.length === 0 ? (
            <div className="rounded-3xl border border-dashed py-16 text-center">
              <p className="text-muted-foreground">You haven't listed anything yet.</p>
              <Button className="mt-5 rounded-full" asChild><Link to="/sell">List an item</Link></Button>
            </div>
          ) : (
            <ul className="grid gap-4">
              {rows.map((listing) => (
                <li key={listing.id} className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-4">
                  {listing.images[0] ? (
                    <img
                      src={listing.images[0]}
                      alt=""
                      className="size-16 rounded-xl object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="grid size-16 place-items-center rounded-xl bg-muted text-muted-foreground">
                      <ImageOff className="size-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <Link to="/product/$id" params={{ id: listing.id }} className="font-semibold hover:underline">
                      {listing.title}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {formatPrice(listing.price, listing.currency)} · {timeAgo(listing.created_at)}
                    </p>
                  </div>
                  <Select
                    value={listing.status}
                    onValueChange={(status) =>
                      mutate.mutate(async () => {
                        await updateListingStatus(listing.id, status);
                        toast.success(`Marked ${statusLabel(status).toLowerCase()}.`);
                      })
                    }
                  >
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="reserved">Reserved</SelectItem>
                      <SelectItem value="sold">Sold</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    className="rounded-full"
                    onClick={() => {
                      if (!window.confirm(`Delete "${listing.title}"? This can't be undone.`)) return;
                      mutate.mutate(async () => {
                        await deleteListing(listing.id);
                        toast.success("Listing deleted.");
                      });
                    }}
                  >
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="offers" className="pt-6">
          {offerRows.length === 0 ? (
            <div className="rounded-3xl border border-dashed py-16 text-center text-muted-foreground">
              No offers yet.
            </div>
          ) : (
            <ul className="grid gap-4">
              {offerRows.map((offer) => {
                const iAmSeller = offer.seller_id === user.id;
                const counterpart = iAmSeller ? offer.buyer : offer.seller;
                return (
                  <li key={offer.id} className="rounded-2xl border bg-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <Link
                          to="/product/$id"
                          params={{ id: offer.listing_id }}
                          className="font-semibold hover:underline"
                        >
                          {offer.listing?.title ?? "Listing"}
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          {formatPrice(offer.amount)} · {iAmSeller ? "from" : "to"} @
                          {counterpart?.username ?? "user"} · {timeAgo(offer.created_at)}
                        </p>
                      </div>
                      <Badge variant={offer.status === "pending" ? "default" : "secondary"} className="rounded-full">
                        {OFFER_STATUS_LABELS[offer.status]}
                      </Badge>
                    </div>
                    {offer.status === "pending" && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {offer.created_by !== user.id ? (
                          <>
                            <Button
                              size="sm"
                              className="rounded-full"
                              disabled={offer.listing?.status !== "available"}
                              title={
                                offer.listing?.status !== "available"
                                  ? "This item isn't available, so the offer can't be accepted."
                                  : undefined
                              }
                              onClick={() =>
                                mutate.mutate(async () => {
                                  await setOfferStatus(offer.id, "accepted");
                                  toast.success("Offer accepted.");
                                })
                              }
                            >
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-full"
                              onClick={() =>
                                mutate.mutate(async () => {
                                  await setOfferStatus(offer.id, "rejected");
                                  toast.success("Offer declined.");
                                })
                              }
                            >
                              Decline
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-full"
                            onClick={() =>
                              mutate.mutate(async () => {
                                await setOfferStatus(offer.id, "cancelled");
                                toast.success("Offer cancelled.");
                              })
                            }
                          >
                            Cancel offer
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="rounded-full" asChild>
                          <Link to="/product/$id" params={{ id: offer.listing_id }}>View negotiation</Link>
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
