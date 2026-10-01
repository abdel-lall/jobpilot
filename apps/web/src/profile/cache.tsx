import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useSession } from "@/auth/session";
import { isProfileQuery } from "@/profile/requests";

export function ProfileQueryCache() {
  const session = useSession();
  const queryClient = useQueryClient();
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    if (session.status === "loading") {
      return;
    }

    if (session.status === "signed-out") {
      queryClient.removeQueries({ predicate: isProfileQuery });
      previousUserId.current = null;
      return;
    }

    const userId = session.user?.id ?? null;
    const previousId = previousUserId.current;
    if (userId !== null && previousId !== null && previousId !== userId) {
      queryClient.removeQueries({
        predicate: (query) => isProfileQuery(query) && query.queryKey[1] === previousId,
      });
    }
    previousUserId.current = userId;
  }, [queryClient, session.status, session.user]);

  return null;
}
