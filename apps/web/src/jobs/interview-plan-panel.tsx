import type { InterviewPlan } from "@jobpilot/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { ActivityCloseButton } from "@/jobs/activity-close";
import { jobsQueryKey, requestErrorMessage } from "@/jobs/requests";
import {
  generateInterviewPlan,
  interviewPlanQueryKey,
  readInterviewPlan,
} from "@/jobs/interview-plan";

function PlanDocument({ plan }: { plan: InterviewPlan }) {
  return (
    <div className="grid gap-4">
      <section className="grid gap-2">
        <h4>Categories</h4>
        <ul className="grid gap-2">
          {plan.categories.map((category) => (
            <li key={category} data-testid="plan-category">
              {category}
            </li>
          ))}
        </ul>
      </section>
      <section className="grid gap-2">
        <h4>Interview topics</h4>
        {plan.interviewTopics.length === 0 ? (
          <p>None</p>
        ) : (
          <ul className="grid gap-2">
            {plan.interviewTopics.map((topic, index) => (
              <li key={`${index}-${topic}`} data-testid="plan-topic">
                {topic}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function InterviewPlanPanel({
  userId,
  jobId,
  accessToken,
  onClose,
}: {
  userId: string;
  jobId: string;
  accessToken: string | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const accessTokenRef = useRef(accessToken);
  accessTokenRef.current = accessToken;
  const queryKey = interviewPlanQueryKey(userId, jobId);

  const query = useQuery({
    queryKey,
    enabled: accessToken !== null && accessToken.length > 0,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: () => {
      const token = accessTokenRef.current;
      if (token === null || token.length === 0) {
        throw new Error("Request failed");
      }
      return readInterviewPlan(token, jobId);
    },
  });

  const generate = useMutation({
    mutationFn: () => {
      const token = accessTokenRef.current;
      if (token === null || token.length === 0) {
        throw new Error("Request failed");
      }
      return generateInterviewPlan(token, jobId);
    },
    onSuccess: async (plan) => {
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData(queryKey, plan);
      await queryClient.refetchQueries({ queryKey: jobsQueryKey(userId) });
    },
  });

  const showLoading = query.isPending && query.isFetching;
  const showEmpty = query.isSuccess && query.data === null;
  const plan = query.isSuccess && query.data !== null ? query.data : null;
  const showGenerate = showEmpty || plan !== null;

  return (
    <div data-testid="interview-plan-panel" className="grid gap-3">
      <ActivityCloseButton testId="close-interview-plan" onClick={onClose} />
      <h2 className="pr-10 text-lg font-semibold text-[var(--jp-ink)]">Interview plan</h2>
      {showLoading ? <p data-testid="interview-plan-loading">Loading plan…</p> : null}
      {query.isError ? <p>{requestErrorMessage(query.error)}</p> : null}
      {showEmpty ? <p data-testid="interview-plan-empty">No interview plan yet.</p> : null}
      {plan !== null ? <PlanDocument plan={plan} /> : null}
      {showGenerate ? (
        <Button
          type="button"
          data-testid="generate-interview-plan"
          disabled={generate.isPending}
          onClick={() => {
            generate.mutate();
          }}
        >
          Generate plan
        </Button>
      ) : null}
      {generate.isError ? <p>{requestErrorMessage(generate.error)}</p> : null}
    </div>
  );
}
