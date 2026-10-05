import type { InterviewAttempt, InterviewQuestion } from "@jobpilot/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { requestErrorMessage } from "@/jobs/requests";
import {
  interviewAttemptQueryKey,
  readInterviewAttempt,
  startInterviewAttempt,
  submitInterviewAnswer,
} from "@/jobs/interview-attempt";

function AttemptQuestion({
  question,
  submitDisabled,
  onSubmit,
}: {
  question: InterviewQuestion;
  submitDisabled: boolean;
  onSubmit: (questionId: string, answer: string) => void;
}) {
  const [draft, setDraft] = useState("");
  return (
    <li data-testid="interview-question" className="grid gap-2">
      <p data-testid="interview-question-text">{question.text}</p>
      <p data-testid="interview-question-category">{question.category}</p>
      <ul className="grid gap-1">
        {question.expectedConcepts.map((concept, index) => (
          <li key={`${index}-${concept}`} data-testid="interview-question-concept">
            {concept}
          </li>
        ))}
      </ul>
      <p data-testid="interview-question-rubric">{question.rubric}</p>
      {question.score === null ? (
        <>
          <Textarea
            data-testid="interview-question-answer-input"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
            }}
          />
          <Button
            type="button"
            data-testid="interview-question-submit"
            disabled={submitDisabled}
            onClick={() => {
              onSubmit(question.id, draft);
            }}
          >
            Submit answer
          </Button>
        </>
      ) : (
        <>
          <p data-testid="interview-question-answer">{question.answer}</p>
          <p data-testid="interview-question-feedback">{question.feedback}</p>
          <p data-testid="interview-question-score">{String(question.score)}</p>
        </>
      )}
    </li>
  );
}

function AttemptQuestions({
  attempt,
  submitDisabled,
  onSubmit,
}: {
  attempt: InterviewAttempt;
  submitDisabled: boolean;
  onSubmit: (questionId: string, answer: string) => void;
}) {
  return (
    <ul className="grid gap-4">
      {attempt.questions.map((question) => (
        <AttemptQuestion
          key={question.id}
          question={question}
          submitDisabled={submitDisabled}
          onSubmit={onSubmit}
        />
      ))}
    </ul>
  );
}

export function InterviewAttemptPanel({
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
  const queryKey = interviewAttemptQueryKey(userId, jobId);

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
      return readInterviewAttempt(token, jobId);
    },
  });

  const start = useMutation({
    mutationFn: () => {
      const token = accessTokenRef.current;
      if (token === null || token.length === 0) {
        throw new Error("Request failed");
      }
      return startInterviewAttempt(token, jobId);
    },
    onSuccess: async (attempt) => {
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData(queryKey, attempt);
    },
  });

  const submit = useMutation({
    mutationFn: (input: { questionId: string; answer: string }) => {
      const token = accessTokenRef.current;
      if (token === null || token.length === 0) {
        throw new Error("Request failed");
      }
      return submitInterviewAnswer(token, jobId, input.questionId, input.answer);
    },
    onSuccess: async (attempt) => {
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData(queryKey, attempt);
    },
  });

  const showLoading = query.isPending && query.data === undefined;
  const showEmpty = query.isSuccess && query.data === null;
  const attempt = query.isSuccess && query.data !== null ? query.data : null;

  return (
    <div data-testid="interview-attempt-panel" className="grid gap-3">
      <h3>Interview attempt</h3>
      <Button type="button" data-testid="close-interview-attempt" onClick={onClose}>
        Close
      </Button>
      {showLoading ? <p data-testid="interview-attempt-loading">Loading attempt…</p> : null}
      {query.isError ? <p>{requestErrorMessage(query.error)}</p> : null}
      {showEmpty ? <p data-testid="interview-attempt-empty">No interview attempt yet.</p> : null}
      {attempt !== null ? (
        <AttemptQuestions
          attempt={attempt}
          submitDisabled={submit.isPending}
          onSubmit={(questionId, answer) => {
            submit.mutate({ questionId, answer });
          }}
        />
      ) : null}
      {showEmpty ? (
        <Button
          type="button"
          data-testid="start-interview-attempt"
          disabled={start.isPending}
          onClick={() => {
            start.mutate();
          }}
        >
          Start attempt
        </Button>
      ) : null}
      {start.isError ? <p>{requestErrorMessage(start.error)}</p> : null}
      {submit.isError ? <p>{requestErrorMessage(submit.error)}</p> : null}
    </div>
  );
}
