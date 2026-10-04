import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useSession } from "@/auth/session";
import { isJobsQuery } from "@/jobs/requests";
import { isTailoredResumeQuery } from "@/jobs/tailored-resume";

export function JobsQueryCache() {
  const session = useSession();
  const queryClient = useQueryClient();
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    if (session.status === "loading") {
      return;
    }

    if (session.status === "signed-out") {
      queryClient.removeQueries({ predicate: isJobsQuery });
      queryClient.removeQueries({ predicate: isTailoredResumeQuery });
      previousUserId.current = null;
      return;
    }

    const userId = session.user?.id ?? null;
    const previousId = previousUserId.current;
    if (userId !== null && previousId !== null && previousId !== userId) {
      queryClient.removeQueries({
        predicate: (query) => isJobsQuery(query) && query.queryKey[1] === previousId,
      });
      queryClient.removeQueries({
        predicate: (query) => isTailoredResumeQuery(query) && query.queryKey[1] === previousId,
      });
    }
    previousUserId.current = userId;
  }, [queryClient, session.status, session.user]);

  return null;
}
