import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeftRight, Check, HandCoins, LayoutGrid, MessageCircle, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
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
import {
  counterOffer,
  fetchOfferHistory,
  fetchOffersForListing,
  sendOffer,
  setOfferStatus,
} from "@/lib/offers";
import {
  formatPrice,
  OFFER_STATUS_LABELS,
  timeAgo,
  type Listing,
  type Offer,
} from "@/lib/types";
import { errorMessage } from "@/lib/utils";

const EVENT_LABELS: Record<string, string> = {
  offer: "made an offer",
  counter: "countered",
  accepted: "accepted the offer",
  rejected: "declined the offer",
  cancelled: "cancelled the offer",
  countered: "countered the offer",
};

/**
 * Everything a buyer or seller does about a price on the product page: make an
 * offer, message the other person, accept / decline / counter / cancel, and the
 * full negotiation history. `extraActions` lets the page add its own buttons
 * (like Save) to the same row.
 */
export function OfferPanel({
  listing,
  extraActions,
}: {
  listing: Listing;
  extraActions?: ReactNode;
}) {
  const { user, loading, configured } = useAuth();
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

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["offers"] });
    void queryClient.invalidateQueries({ queryKey: ["offer-history", listing.id] });
    void queryClient.invalidateQueries({ queryKey: ["listing", listing.id] });
  };

  const action = useMutation({
    mutationFn: async (fn: () => Promise<void>) => fn(),
    onSuccess: refresh,
    onError: (error: unknown) => toast.error(errorMessage(error)),
  });

  const openChat = useMutation({
    mutationFn: (buyerId: string) =>
      startConversation({ listingId: listing.id, buyerId, sellerId: listing.seller_id }),
    onSuccess: (conversationId) => {
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      void navigate({ to: "/messages", search: { c: conversationId } });
    },
    onError: (error: unknown) => toast.error(errorMessage(error, "Couldn't open the chat.")),
  });

  if (loading) {
    return <div className="h-12 animate-pulse rounded-full bg-muted" aria-hidden />;
  }

  if (!user) {
    return (
      <div className="space-y-4">
        {extraActions && <div className="flex flex-wrap gap-3">{extraActions}</div>}
        <div className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
          <Link
            to="/auth"
            search={{ redirect: `/product/${listing.id}` }}
            className="font-medium text-primary hover:underline"
          >
            Sign in
          </Link>{" "}
          to make an offer or message the seller.
        </div>
      </div>
    );
  }

  const rows = offers.data ?? [];
  const hasOpenOffer = rows.some((o) => o.status === "pending" && o.buyer_id === user.id);
  const canMakeOffer = !isSeller && listing.status === "available" && !hasOpenOffer;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        {canMakeOffer && (
          <OfferDialog
            title="Make an offer"
            description={`Listed at ${formatPrice(listing.price, listing.currency)}. Suggest a price and add a short note.`}
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
          <Button
            size="lg"
            variant="outline"
            className="rounded-full"
            disabled={openChat.isPending}
            onClick={() => openChat.mutate(user.id)}
          >
            <MessageCircle className="size-4" /> Message seller
          </Button>
        )}
        {isSeller && (
          <Button size="lg" variant="outline" className="rounded-full" asChild>
            <Link to="/dashboard">
              <LayoutGrid className="size-4" /> Manage this listing
            </Link>
          </Button>
        )}
        {extraActions}
      </div>

      {!isSeller && listing.status !== "available" && (
        <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
          {listing.status === "reserved"
            ? "This item is reserved for another buyer right now. You can still message the seller."
            : listing.status === "sold"
              ? "This item has been sold."
              : "This item isn't available right now."}
        </p>
      )}

      {!isSeller && hasOpenOffer && (
        <p className="rounded-2xl bg-secondary px-4 py-3 text-sm text-secondary-foreground">
          You have an open offer below. You can cancel it or wait for the seller to respond.
        </p>
      )}

      {rows.length > 0 && (
        <div className="rounded-3xl border bg-card p-5">
          <h3 className="font-display text-lg font-bold">{isSeller ? "Offers received" : "Your offers"}</h3>
          <ul className="mt-3 space-y-3">
            {rows.map((offer) => (
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
                  <Badge
                    variant={offer.status === "pending" ? "default" : "secondary"}
                    className="rounded-full"
                  >
                    {OFFER_STATUS_LABELS[offer.status]}
                  </Badge>
                </div>
                {offer.message && <p className="mt-2 text-sm text-muted-foreground">{offer.message}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {offer.status === "pending" && (
                    <OfferActions
                      offer={offer}
                      listing={listing}
                      onAction={(fn) => action.mutate(fn)}
                    />
                  )}
                  {isSeller && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-full"
                      disabled={openChat.isPending}
                      onClick={() => openChat.mutate(offer.buyer_id)}
                    >
                      <MessageCircle className="size-4" /> Message buyer
                    </Button>
                  )}
                </div>
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
  const canAccept = canRespond && listing.status === "available";

  return (
    <>
      {canAccept && (
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
      )}
      {canRespond && (
        <>
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
            description={`Their offer is ${formatPrice(offer.amount, listing.currency)}. Suggest a price in between.`}
            suggested={offer.amount}
            trigger={
              <Button size="sm" variant="outline" className="rounded-full">
                <ArrowLeftRight className="size-4" /> Counter
              </Button>
            }
            onSubmit={(amount, message) =>
              onAction(async () => {
                await counterOffer(offer, amount, message);
                toast.success("Counter offer sent.");
              })
            }
          />
        </>
      )}
      {!canRespond && (
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
    </>
  );
}

export function OfferDialog({
  title,
  description = "Suggest a price and add a short note.",
  suggested,
  trigger,
  onSubmit,
}: {
  title: string;
  description?: string;
  suggested: number;
  trigger: ReactNode;
  onSubmit: (amount: number, message: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(suggested));
  const [message, setMessage] = useState("");

  // Start from the current price every time the dialog opens.
  useEffect(() => {
    if (open) setAmount(String(suggested));
  }, [open, suggested]);

  const submit = () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return toast.error("Enter a valid amount.");
    if (value > 1_000_000_000) return toast.error("That amount is too large.");
    onSubmit(Math.round(value * 100) / 100, message.trim() || null);
    setOpen(false);
    setMessage("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="offer-amount">Your price</Label>
            <Input
              id="offer-amount"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="offer-note">Message (optional)</Label>
            <Textarea
              id="offer-note"
              rows={3}
              maxLength={500}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button className="rounded-full" onClick={submit}>
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
