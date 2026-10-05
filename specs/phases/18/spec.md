# Phase 18 — Retakes and readiness

## Objective

Award a per-job readiness badge from the latest completed attempt, let the user start another attempt after a pass or a fail, and show the latest completed overall score and badge on the dashboard.

## Scope

This phase adds only the retake and readiness behavior described in the Phase 18 section of `specs/roadmap.md`:

- The overall score is the arithmetic mean of the 8 question scores.
- A category score is the arithmetic mean of that category's question scores. Categories with no questions on the attempt are ignored.
- The attempt passes only when the overall score is at least 80 and every tested category is at least 70.
- A passing latest completed attempt awards `Interview Ready` for that job only.
- A missing or failing latest completed attempt leaves the job without the badge.
- The user can start another attempt after a pass or a fail. Previous attempts, questions, answers, and scores remain stored. The new attempt still follows the Phase 16 uniqueness rules.
- The dashboard shows the latest completed overall score and the badge. An in-progress attempt does not replace that score or badge.
- Deleting a job deletes its analysis, tailored resume, interview plan, attempts, and questions.

The roadmap names the means, the pass rule, the badge text, retakes, the dashboard freeze during an in-progress attempt, and job delete. It does not name the score representation, which attempt `current` returns, or how the attempt panel starts a retake. The contract below closes those gaps.

### Readiness rule

`assessInterviewReadiness` lives in `apps/api/src/interview-attempt/readiness.ts`. It is not a LangGraph workflow. It does not call a model, MCP, or the network.

```ts
type ScoredInterviewQuestion = {
  score: number;
  category: string;
};

type InterviewReadiness = {
  overallScore: number;
  passed: boolean;
};

assessInterviewReadiness(
  questions: readonly ScoredInterviewQuestion[],
): InterviewReadiness
```

The input is the 8 scored questions on one completed attempt. It does not include the plan, untested categories, profile records, or the job description. A category that does not appear in those 8 questions is ignored. The function throws if `questions` does not have length 8 or if any `score` is not an integer from 0 through 100.

Compare with integers. Do not round.

- The overall score passes when the sum of the 8 scores is greater than or equal to `80 * 8` (640).
- A tested category passes when the sum of its question scores is greater than or equal to `70 *` that category's question count.
- `passed` is true only when the overall score passes and every tested category passes.
- `overallScore` is `sum / 8`. It is not rounded to an integer. `639 / 8` is `79.875` and does not pass.

These inputs decide the result:

| Questions | `overallScore` | `passed` |
| --- | --- | --- |
| Eight Backend scores of 80 | 80 | true |
| Eight Backend scores of 100 | 100 | true |
| Eight Backend scores of 0 | 0 | false |
| Seven Backend scores of 80 and one Backend score of 79 | 79.875 | false |
| Four Frontend scores of 70 and four Backend scores of 90 | 80 | true |
| Four Frontend scores of 70 and four Backend scores of 89 | 79.5 | false |
| Four Frontend scores of 69 and four Backend scores of 91 | 80 | false |
| Six Backend scores of 100 and two Frontend scores of 69 | 92.25 | false |

The eight-Backend case is the untested-category case. Frontend, System design, and the other plan categories are absent, and their absence does not fail the attempt.

### Job status

Do not add a table or a column. Do not add a migration. `latestOverallScore` and `readinessBadge` are computed when a job response is built.

`jobStatusSchema` in `packages/shared` changes only these two fields:

| Field | Type |
| --- | --- |
| `latestOverallScore` | `null`, or a number from 0 through 100 |
| `readinessBadge` | `null`, or the literal `Interview Ready` |

`analysisCurrent`, `tailoredResumePresent`, and `interviewPlanPresent` stay as Phase 15 defined them. `interviewAttemptSchema` stays as Phase 17 defined it. The attempt JSON does not gain an overall score, category scores, or a badge.

Create, list, get, and update still return the Phase 15 job object, with those two status fields filled from the latest completed attempt:

- No completed attempt: `latestOverallScore` is `null` and `readinessBadge` is `null`.
- The latest completed attempt passed: `latestOverallScore` is that attempt's `overallScore`, and `readinessBadge` is `Interview Ready`.
- The latest completed attempt failed: `latestOverallScore` is that attempt's `overallScore`, and `readinessBadge` is `null`.

The latest completed attempt is the attempt with status `completed` and the greatest `createdAt`. If `createdAt` ties, use the greatest `id`. An `in_progress` attempt is not eligible, including one whose `createdAt` is later than a completed attempt.

A passing attempt on one job does not change another job. A description change, a title-only update, and replacing the interview plan do not delete attempts and do not clear a score or badge that the remaining completed attempts still produce. A failed analysis does not open that transaction.

`createJobBodySchema` and `updateJobBodySchema` stay as Phase 8 defined them.

### Current attempt

`GET /jobs/:id/interview-attempts/current` and the answer route use one current attempt:

- If the job has an `in_progress` attempt, that attempt is current. There is still at most one.
- Otherwise the latest completed attempt is current.
- If the job has no attempt, `GET` stays `404` with `{ "error": "Not found" }`.

`GET` still returns `200` and `{ "attempt": <interviewAttemptSchema> }`. It does not call a model. A missing job or another user's job stays `404`.

The answer route still scores one question on the current attempt. Checks stay in the Phase 17 order, applied to that attempt. A question id that belongs only to an older attempt, while an `in_progress` attempt is current, is `404` with `{ "error": "Not found" }`. A scored question on the current attempt is still `409` with `{ "error": "Question already answered" }`. The eighth stored score still sets that attempt to `completed` in the same transaction. The other attempt rows stay as they were.

### Retake

`POST /jobs/:id/interview-attempts` keeps the Phase 16 checks, in the same order, for a missing or stale analysis, a missing or invalid plan, and an existing `in_progress` attempt. Remove the Phase 17 rejection of a job that already has an attempt. A completed attempt is no longer a reason to return `409` or to skip the question model.

The start request still passes every stored question text for that job, from every attempt, into `generateInterviewQuestions`. Normalized-text rejection stays as Phase 16 defined it. A repeated normalized text is not stored. If 8 unique questions are not available after 3 rounds, the response stays `502` with `{ "error": "Interview question generation failed" }`, and no new attempt row is written. The completed attempt, its questions, answers, and scores stay.

On success, store a new `in_progress` attempt with 8 unanswered questions. The previous attempt remains stored. The response is that new attempt.

Inside the write transaction, reject a second `in_progress` attempt with `409` and `{ "error": "Interview attempt already in progress" }`. Do not reject because a completed attempt exists. A normalized-text collision still fails the request with `502` and `{ "error": "Interview question generation failed" }` and leaves the existing attempts unchanged.

The partial unique index `InterviewAttempt_one_in_progress_per_job` stays. Job delete still uses the existing foreign keys. `JobAnalysis`, `TailoredResume`, `InterviewPlan`, `InterviewAttempt`, and `InterviewQuestion` already cascade from `Job`. This phase does not add a migration and does not edit an earlier migration.

### Stub models

`createStubAnswerEvaluationModel()` still returns `{ "feedback": "stub-feedback", "score": 80 }` for every answer other than `fail`. When `answer` is exactly `fail`, it returns `{ "feedback": "stub-feedback", "score": 0 }`. This sentinel exists so a browser test can finish a failing retake against Compose. It is not a product scoring rule. Live Gemini is unchanged.

`createStubInterviewQuestionModel()` keeps the Phase 16 text `Stub ${category} question ${index}` when that normalized text is not in `avoidedQuestionTexts`. When it is, the text becomes `Stub ${category} question ${index} retake N`, where `N` starts at 2 and increases until the normalized text is absent from `avoidedQuestionTexts`. A first attempt with no stored questions still returns the Phase 16 texts. A later attempt does not repeat them.

Do not change the question-generation prompt, the evaluation prompt, or any other workflow.

### Dashboard

`job-analysis`, `job-tailored-resume`, and `job-interview-plan` stay as Phases 10, 14, and 15 defined them.

`job-score` shows `Not available` when `latestOverallScore` is `null`. Otherwise it shows `String(latestOverallScore)`. Score `80` is `80`. Score `0` is `0`. Score `79.875` is `79.875`.

`job-readiness` shows `Not available` when `readinessBadge` is `null`. It shows `Interview Ready` when the badge is `Interview Ready`.

The attempt panel does not show an overall score or a badge. Question text, category, expected concepts, rubric, answer, feedback, and per-question score stay as Phase 17 defined them.

When the visible attempt is `completed`, show the existing `Start attempt` button, `data-testid="start-interview-attempt"`. Hide that button while the visible attempt is `in_progress`. The empty state `No interview attempt yet.` still shows `Start attempt` when the job has no attempt. Do not add a second button label.

`Start attempt` still sends `POST /jobs/:id/interview-attempts` with `{}`. Disable that button while the POST is in flight. On success, parse the attempt with `interviewAttemptSchema` and show that attempt. The previous attempt leaves the panel. On failure, leave the completed attempt on screen and show the API `error` string.

A successful answer POST whose attempt `status` is `completed` refetches the jobs query `["jobs", userId]`, the same way the interview-plan panel refetches jobs after a successful generate. Do not change the jobs cache to `Not available` when a retake starts. An in-progress retake keeps showing the previous completed score and badge until a newer attempt is complete.

### Cache

Attempt requests keep the Phase 17 client rules. On a successful start or answer, write the parsed attempt into `["interview-attempt", userId, jobId]`. Signing out and a user-id change still remove that user's interview-attempt queries. Do not persist the query cache.

## Affected subsystems

- Interview assessment
- Readiness
- Dashboard
- Jobs
- `apps/api`
- `apps/web`
- `packages/database`
- `packages/shared`

`packages/ai` changes only the two stub models above. No workflow reads the profile or calls MCP. `apps/portfolio-mcp` stays as Phase 12 left it.

## Out of scope

The following are not part of Phase 18:

- A new LangGraph workflow, a sixth model call, or a prompt change for questions or evaluation.
- Semantic deduplication. A retake is unique by the Phase 16 normalized text rule.
- Replacing an answer that already has feedback and a score.
- Showing category scores, or showing the overall score and badge inside the attempt panel.
- Storing `latestOverallScore` or `readinessBadge` on a row.
- Clearing attempts, scores, or the badge when the job description changes or the plan is replaced.
- Deleting a user, or a new delete route.
- Calling Gemini or `@jobpilot/ai` from the web app.
- A routing library, a queue, a worker, or a job runner.
- A GitHub Actions PostgreSQL service or a Playwright job. `.github/workflows/ci.yml` stays typecheck plus `pnpm test`.
- Changing auth, profile, embeddings, MCP, resume grounding, job analysis, or the interview-plan workflow.

## Dependencies

Phases 14 and 17.

Phase 17 provides the completed attempt and the answer panel. Phase 16 provides question uniqueness and the one in-progress attempt rule. Phase 14 provides the tailored resume row that job delete must remove. Phase 9 provides the dashboard score and readiness lines.

The local validation URL is `postgresql://postgres:jobpilot@localhost:5432/postgres`.

## Implementation constraints

These constraints come from Phase 18, the roadmap rules that bind every phase, and the engineering rules in `specs/tech-stack.md`. They do not add behavior beyond the scope above.

### API

- Keep business logic outside the route handlers.
- Compute readiness in `assessInterviewReadiness`. The web app does not apply the 80 and 70 rule itself.
- The only new writes are the retake attempt and its eight questions, through the existing start path. Scoring still updates one question and, on the eighth score, that attempt's status.
- Job delete still cascades through the existing foreign keys. Do not add a migration.
- Enable TypeScript strict mode. Avoid `any` unless justified.
- Do not add a dependency. Do not add an environment variable.

### Web

- Keep the profile view, job forms, analysis label, tailored-resume panel, and interview-plan panel as Phases 9, 10, 14, and 15 left them.
- Parse job responses with `jobSchema` and attempt responses with `interviewAttemptSchema` from `@jobpilot/shared`.
- The web app still has no `JWT_SECRET`, `DATABASE_URL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `JOB_ANALYSIS_MODEL`, `EMBEDDING_MODEL`, `RESUME_MODEL`, `INTERVIEW_PLAN_MODEL`, `INTERVIEW_QUESTION_MODEL`, `ANSWER_EVALUATION_MODEL`, `MCP_SHARED_SECRET`, or `MCP_URL` in its source, environment, or bundle.
- Do not import `@jobpilot/ai`. Do not call Gemini or MCP from the browser.

### Tests

- Add `apps/api/src/readiness.test.ts`. It runs inside `pnpm --filter @jobpilot/api test` and root `pnpm test`. It does not need `DATABASE_URL`. It covers the table in the readiness rule, including an attempt whose questions use only Backend.
- Extend `packages/ai/src/answer-evaluation.test.ts`. The existing answer `I would add an index.` still returns score 80. The answer `fail` returns score 0 and feedback `stub-feedback`.
- Extend `packages/ai/src/interview-questions.test.ts`. A stub generation with no stored texts still returns the eight Phase 16 texts. A stub generation whose stored texts are those eight returns eight new texts, and none of their normalized forms match a stored text.
- Extend `apps/api/src/interview-attempt.integration.test.ts`. It keeps running under `pnpm --filter @jobpilot/api test:interview-attempt`. Root `pnpm test` still excludes `*.integration.test.ts`.
- Eight answers scored 80 store `latestOverallScore` 80 and `readinessBadge` `Interview Ready` on `GET /jobs/:id`. One scored answer, with no completed attempt, leaves both `null`.
- A model that returns 79 for one question and 80 for the other seven stores `latestOverallScore` `79.875` and `readinessBadge` `null`.
- After a passing attempt, `GET /jobs/:id/interview-attempts/current` returns that completed attempt. A second start whose model repeats those question texts returns `502` with `{ "error": "Interview question generation failed" }` and leaves the attempt count at 1.
- A second start whose model returns eight new texts stores a second `in_progress` attempt and keeps the completed attempt, its answers, and its scores. `GET /jobs/:id` still shows 80 and `Interview Ready`. `GET` current returns the in-progress attempt. Answering a question id from the completed attempt returns `404`.
- Completing that retake with eight answers of `fail` stores overall score 0 and `readinessBadge` `null`. The older attempt still has eight scores of 80. The attempt count is 2.
- A passing attempt on one job leaves a second job owned by the same user with both status fields `null`.
- Another user receives `404` on the start, read, and answer routes.
- The race that completes an attempt while another start is still generating no longer expects `409` with `Interview attempt already completed`. The late start repeats the stored texts, returns `502`, and leaves the completed attempt as the only attempt.
- Update the Phase 17 case that expected a completed attempt to keep a null score and reject a later start. Completion of eight 80s now sets the score and badge. The later repeated-text start is the `502` case above.
- Seed a tailored resume row, then `DELETE /jobs/:id`. The job, its analysis, tailored resume, interview plan, attempts, and questions are gone. Another user's job remains. Do not add a delete-user route.
- Existing `pnpm --filter @jobpilot/api test:jobs`, `test:tailored-resume`, and `test:interview-plan` expectations stay valid. Those cases do not complete an attempt, so `latestOverallScore` and `readinessBadge` remain `null`.
- Add `apps/web/e2e/interview-readiness.spec.ts`. Do not change the Phase 9 jobs case, the Phase 14 tailored-resume case, or the Phase 15 interview-plan case. Those cases still do not complete an attempt, so `job-score` and `job-readiness` stay `Not available`. The Phase 16 and Phase 17 browser cases stay valid: a started attempt and a single submitted answer still show `Not available`.
- Extend `pnpm --filter @jobpilot/web test:e2e`. Do not add the new browser test to root `pnpm test` or to GitHub Actions.
- Compose for that run uses `JOB_ANALYSIS_MODEL=stub`, `EMBEDDING_MODEL=stub`, `RESUME_MODEL=stub`, `INTERVIEW_PLAN_MODEL=stub`, `INTERVIEW_QUESTION_MODEL=stub`, and `ANSWER_EVALUATION_MODEL=stub`, and leaves `GEMINI_API_KEY` empty.
- The new case registers a unique `phase18-` email and logs in. It creates one job: company `Example Co`, title `Engineer`, description `Build APIs.`, location `Remote`, URL `https://example.com/jobs/engineer`. It generates the interview plan and starts the attempt.
- It submits `I would add an index.` on all 8 questions. The panel stays open. `job-score` is `80` and `job-readiness` is `Interview Ready`. The panel shows `Start attempt` and does not show an answer box.
- It starts the retake. The panel shows 8 unanswered questions whose texts were not on the first attempt. `job-score` stays `80` and `job-readiness` stays `Interview Ready`.
- It submits `fail` on all 8 retake questions. `job-score` is `0` and `job-readiness` is `Not available`.
- The test deletes the users it created through Prisma, using `DATABASE_URL`. Before that delete, two attempts exist for the job, and the older attempt's scores are 80. Cascade removes the job and its child rows.
- The Phase 4, Phase 6, Phase 7, Phase 9, Phase 14, Phase 15, Phase 16, and Phase 17 Playwright cases still pass in the same `test:e2e` run. `pnpm --filter @jobpilot/api test:auth`, `test:profile`, `test:resumes`, `test:jobs`, `test:tailored-resume`, `test:interview-plan`, and `test:interview-attempt` still pass. `pnpm --filter @jobpilot/portfolio-mcp test` still passes. `pnpm test` and `pnpm typecheck` still pass.
- Do not add PostgreSQL or Playwright to GitHub Actions. Do not change `.github/workflows/ci.yml`.
- Keep this phase one independently implementable, reviewable, testable, and committable slice.
