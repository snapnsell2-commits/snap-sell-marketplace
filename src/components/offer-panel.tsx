import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeftRight, Check, HandCoins, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { startConversation } from "@/lib/chat";
import { counterOffer, fetchOfferHistory, fetchOffersForListing, sendOffer, setOfferStatus } from "@/lib/offers";
import { supabase } from "@/lib/supabase";
import { formatPrice, OFFER_STATUS_LABELS, timeAgo, type Listing, type Offer } from "@/lib/types";

const EVENT_LABELS: Record<string, string> = {
  offer: "made an offer",
  counter: "countered",
  accepted: "accepted the offer",
  rejected: "declined the offer",
  cancelled: "cancelled the offer",
  countered: "countered the offer",
};

export function OfferPanel({ listing }: { listing: Listing }) {
  const { user, configured } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isSeller = user?.id === listing.seller_id;

  const offers = useQuery({
    queryKey: ["offers", listing.id],
    queryFn: () => fetchOffersForListing(listing.id),
    enabled: Boolean(configured && user),
  });
  const history = useQuery({
    queryKey: ["offer-history", listing.id],
    queryFn: () => fetchOfferHistory(listing.id),
    enabled: Boolean(configured && user),
  });

  useEffect(() => {
    if (!supabase || !user) return;
    const channel = supabase
      .channel(`offers:${listing.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "offers", filter: `listing_id=eq.${listing.id}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["offers", listing.id] });
          void queryClient.invalidateQueries({ queryKey: ["offer-history", listing.id] });
          void queryClient.invalidateQueries({ queryKey: ["listing", listing.id] });
        },
      )
      .subscribe();
    return () => {
      void supabase?.removeChannel(channel);
    };
  }, [listing.id, user, queryClient]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["offers", listing.id] });
    void queryClient.invalidateQueries({ queryKey: ["offer-history", listing.id] });
    void queryClient.invalidateQueries({ queryKey: ["listing", listing.id] });
  };

  const action = useMutation({
    mutationFn: async (fn: () => Promise<void>) => fn(),
    onSuccess: refresh,
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Something went wrong."),
  });

  const rows = offers.data ?? [];
  const mine = rows.filter((o) => (isSeller ? true : o.buyer_id === user?.id));
  const openOffer = mine.find((o) => o.status === "pending");

  const chat = async () => {
    if (!user) return void navigate({ to: "/auth" });
    const id = await startConversation({
      listingId: listing.id,
      buyerId: user.id,
      sellerId: listing.seller_id,
    });
    void navigate({ to: "/messages", search: { c: id } });
  };

  if (!user) {
    return (
      <div className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
        <Link to="/auth" className="font-medium text-primary hover:underline">Sign in</Link>{" "}
        to make an offer or message the seller.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        {!isSeller && listing.status === "available" && (
          <OfferDialog
            title="Make an offer"
            suggested={listing.price}
            trigger={
              <Button size="lg" className="rounded-full">
                <HandCoins className="size-4" /> Make an offer
              </Button>
            }
            onSubmit={(amount, message) =>
              action.mutate(async () => {
                await sendOffer({
                  listingId: listing.id,
                  buyerId: user.id,
                  sellerId: listing.seller_id,
                  amount,
                  message,
                  createdBy: user.id,
                });
                toast.success("Offer sent.");
              })
            }
          />
        )}
        {!isSeller && (
          <Button size="lg" variant="outline" className="rounded-full" onClick={() => void chat()}>
            Message seller
          </Button>
        )}
      </div>

      {mine.length > 0 && (
        <div className="rounded-3xl border bg-card p-5">
          <h3 className="font-display text-lg font-bold">Offers</h3>
          <ul className="mt-3 space-y-3">
            {mine.map((offer) => (
              <li key={offer.id} className="rounded-2xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-display text-xl font-extrabold">
                      {formatPrice(offer.amount, listing.currency)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {offer.created_by === offer.buyer_id ? "From buyer" : "From seller"}{" "}
                      {offer.buyer?.username && isSeller ? `@${offer.buyer.username} ` : ""}·{" "}
                      {timeAgo(offer.created_at)}
                    </p>
                  </div>
                  <Badge variant={offer.status === "pending" ? "default" : "secondary"} className="rounded-full">
                    {OFFER_STATUS_LABELS[offer.status]}
                  </Badge>
                </div>
                {offer.message && (
                  <p className="mt-2 text-sm text-muted-foreground">{offer.message}</p>
                )}
                {offer.status === "pending" && <OfferActions offer={offer} listing={listing} onAction={action.mutate} />}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(history.data ?? []).length > 0 && (
        <div className="rounded-3xl border bg-card p-5">
          <h3 className="font-display text-lg font-bold">Negotiation history</h3>
          <Separator className="my-3" />
          <ol className="space-y-3">
            {(history.data ?? []).map((event) => (
              <li key={event.id} className="flex items-start gap-3 text-sm">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                <span>
                  <span className="font-medium">
                    {event.actor?.display_name ?? event.actor?.username ?? "Someone"}
                  </span>{" "}
                  {EVENT_LABELS[event.type] ?? event.type}
                  {event.amount !== null && ` — ${formatPrice(event.amount, listing.currency)}`}
                  {event.note && <span className="block text-muted-foreground">“{event.note}”</span>}
                  <span className="block text-xs text-muted-foreground">{timeAgo(event.created_at)}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {openOffer && !isSeller && null}
    </div>
  );
}

function OfferActions({
  offer,
  listing,
  onAction,
}: {
  offer: Offer;
  listing: Listing;
  onAction: (fn: () => Promise<void>) => void;
}) {
  const { user } = useAuth();
  if (!user) return null;
  const canRespond = user.id !== offer.created_by;
  const isMine = user.id === offer.created_by;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {canRespond && (
        <>
          <Button
            size="sm"
            className="rounded-full"
            onClick={() =>
              onAction(async () => {
                await setOfferStatus(offer.id, "accepted");
                toast.success("Offer accepted — the item is now reserved.");
              })
            }
          >
            <Check className="size-4" /> Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={() =>
              onAction(async () => {
                await setOfferStatus(offer.id, "rejected");
                toast.success("Offer declined.");
              })
            }
          >
            <X className="size-4" /> Decline
          </Button>
          <OfferDialog
            title="Counter offer"
            suggested={offer.amount}
            trigger={
              <Button size="sm" variant="outline" className="rounded-full">
                <ArrowLeftRight className="size-4" /> Counter
              </Button>
            }
            onSubmit={(amount, message) =>
              onAction(async () => {
                await counterOffer(offer, amount, user.id, message);
                toast.success("Counter offer sent.");
              })
            }
          />
        </>
      )}
      {isMine && (
        <Button
          size="sm"
          variant="ghost"
          className="rounded-full"
          onClick={() =>
            onAction(async () => {
              await setOfferStatus(offer.id, "cancelled");
              toast.success("Offer cancelled.");
            })
          }
        >
          Cancel offer
        </Button>
      )}
      <span className="sr-only">{listing.title}</span>
    </div>
  );
}

export function OfferDialog({
  title,
  suggested,
  trigger,
  onSubmit,
}: {
  title: string;
  suggested: number;
  trigger: React.ReactNode;
  onSubmit: (amount: number, message: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(suggested));
  const [message, setMessage] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Suggest a price and add a short note.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="amount">Your price</Label>
            <Input
              id="amount"
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="note">Message (optional)</Label>
            <Textarea id="note" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button
            className="rounded-full"
            onClick={() => {
              const value = Number(amount);
              if (!value || value <= 0) return toast.error("Enter a valid amount.");
              onSubmit(value, message || null);
              setOpen(false);
              setMessage("");
            }}
          >
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
