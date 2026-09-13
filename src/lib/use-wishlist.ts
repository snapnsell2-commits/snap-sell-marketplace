import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "./auth";
import { fetchWishlistIds, toggleWishlist } from "./marketplace";

export function useWishlist() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;

  const { data: ids = [] } = useQuery({
    queryKey: ["wishlist", userId],
    queryFn: () => fetchWishlistIds(userId),
  });

  const mutation = useMutation({
    mutationFn: ({ listingId, saved }: { listingId: string; saved: boolean }) =>
      toggleWishlist(userId, listingId, saved),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["wishlist"] });
    },
  });

  return {
    ids,
    isSaved: (id: string) => ids.includes(id),
    toggle: (id: string) => mutation.mutate({ listingId: id, saved: ids.includes(id) }),
    pending: mutation.isPending,
  };
}
