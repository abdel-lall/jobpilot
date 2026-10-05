# JobPilot live Gemini test

This file is a persistent checkpoint for the real-Gemini end-to-end test. Update it as the live test progresses so it always represents the latest continuation point.

## Configuration

The local app is configured to use real Gemini for:

- `JOB_ANALYSIS_MODEL=gemini`
- `EMBEDDING_MODEL=gemini`
- `RESUME_MODEL=gemini`
- `INTERVIEW_PLAN_MODEL=gemini`
- `INTERVIEW_QUESTION_MODEL=gemini`
- `ANSWER_EVALUATION_MODEL=gemini`

Gemini generative model:

- `gemini-3.8-flash`

Embedding model:

- `gemini-embedding-001`

Do not record `GEMINI_API_KEY`, `JWT_SECRET`, `MCP_SHARED_SECRET`, or any other secret.

## Existing test data

Test account:

- `e2e-live-1791180929122@example.com`

Existing job id:

- `9e204a76-bfb9-42df-b74e-e13fc07ca5cb`

Do not recreate the user, profile, or job unless they no longer exist.

## Completed successfully

- Sign up
- Login
- Candidate profile creation
  - skills
  - experience
  - projects
  - education
  - certification
- Gemini embeddings for experience/project
- Job creation
- Real Gemini job analysis
- MCP semantic search/query embedding reached successfully during resume generation
- Exact candidate profile MCP loads reached successfully

## Gemini compatibility fixes discovered

### Job analysis

Gemini rejected `response_schema` containing JSON Schema `$ref`.

Fix:

- `jobAnalysisSchema` now creates fresh Zod list schemas instead of reusing one schema object.

Result:

- live Gemini job analysis succeeds.

### Tailored resume

Gemini also rejected `$ref` generated from reused `sourceId` and calendar-date schemas.

Fix:

- `tailoredResumeSchema` now creates fresh Zod schema instances.
- regression test confirms the Gemini-facing JSON schema contains zero `$ref` entries.

Result after rebuilding:

- schema problem is resolved.
- live Gemini call now reaches the provider successfully.

## Current blocker

Tailored resume generation currently returns:

```text
502
{ "error": "Resume generation failed" }
```

Underlying provider response is Gemini 429 Too Many Requests.

Quota:

- `generativelanguage.googleapis.com/generate_content_free_tier_requests`
- limit observed: 20 requests
- model: `gemini-3.8-flash`

This is a free-tier quota exhaustion problem, not a JobPilot application failure.

Do not change application code to fix this 429.

## Next test action

After the Gemini quota resets:

1. Confirm the existing containers/config still use real Gemini.
2. Confirm `GET /health` returns 200.
3. Do not recreate the account/profile/job.
4. Retry tailored-resume generation for the existing job.
5. If successful:
   - verify grounding
   - verify persistence
   - verify rendered resume contains only supported candidate facts
6. Continue:
   - generate interview plan
   - start interview attempt
   - verify 8 unique questions
   - submit all 8 answers
   - verify feedback and scores
   - verify attempt completion
   - verify overall score/readiness
   - start retake
   - verify question texts do not repeat the first attempt

## Failure handling

If another stage fails:

- stop at that stage
- record HTTP status and response body
- identify the underlying provider/server error
- distinguish quota/provider issues from JobPilot bugs
- do not modify code until the root cause is understood
