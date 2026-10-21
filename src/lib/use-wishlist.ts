import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "./auth";
import { fetchWishlistIds, toggleWishlist } from "./marketplace";
import { errorMessage } from "./utils";

const NO_IDS: string[] = [];

export function useWishlist() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;
  const queryKey = ["wishlist", userId] as const;

  const query = useQuery({
    queryKey,
    queryFn: () => fetchWishlistIds(userId),
  });
  const ids = query.data ?? NO_IDS;

  const mutation = useMutation({
    mutationFn: ({ listingId, saved }: { listingId: string; saved: boolean }) =>
      toggleWishlist(userId, listingId, saved),
    // Flip the heart immediately; roll back if the server refuses.
    onMutate: async ({ listingId, saved }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<string[]>(queryKey);
      queryClient.setQueryData<string[]>(queryKey, (old = []) =>
        saved ? old.filter((id) => id !== listingId) : [...old, listingId],
      );
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast.error(errorMessage(error, "Couldn't update your wishlist."));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["wishlist"] });
      void queryClient.invalidateQueries({ queryKey: ["wishlist-listings"] });
    },
  });

  return {
    ids,
    isLoading: query.isPending,
    isSaved: (id: string) => ids.includes(id),
    toggle: (id: string) => mutation.mutate({ listingId: id, saved: ids.includes(id) }),
    pending: mutation.isPending,
  };
}
