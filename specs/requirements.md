# JobPilot AI — Product Requirements

## 1. Product Goal

Build an AI-powered job application assistant that helps users:

1. Analyze a job description.
2. Generate a tailored resume based only on the user's verified experience.
3. Prepare for interviews for that exact job.
4. Complete job-specific interview assessments.
5. Track readiness for each job.

The project should primarily demonstrate full-stack engineering, LangChain/LangGraph, MCP, RAG, authentication, databases, and AI-agent workflows.

---

## 2. Core Principles

- The AI must not invent candidate experience.
- Resume content must be grounded in stored user profile data.
- Candidate data may reach an AI workflow only through the MCP server. In the MVP, only the resume-tailoring workflow may access candidate data.
- Interview questions must be generated specifically for the selected job.
- Failed interview attempts must generate new questions.
- AI outputs should use structured schemas whenever possible.
- Each AI workflow has one purpose. Workflows do not call one another.
- The system should remain simple enough to understand and demonstrate during technical interviews.

---

## 3. Authentication

Users must be able to:

- Register.
- Log in.
- Log out.
- Refresh authentication sessions.

Authentication should use:

- Short-lived JWT access tokens sent as `Authorization` bearer tokens.
- Refresh tokens stored only in HttpOnly cookies.
- Server-side refresh sessions.
- Argon2id password hashing.

Logging out revokes the server-side refresh session. A revoked refresh token cannot be used again. Each user must only access their own data.

---

## 4. Candidate Profile

Users enter and maintain their own structured records:

- Skills.
- Education.
- Work experience.
- Projects.
- Certifications.

The owner can create, read, update, and delete these records. This structured profile is the only source of candidate facts.

Users may also upload resume files. In the MVP those files are stored only. They are not parsed, not embedded, and not passed to AI workflows.

---

## 5. Job Management

Users must be able to create, read, update, and delete their own job entries. A job contains:

- Company name.
- Job title.
- Job description.
- Job location.
- Job URL if available.

Creating a job runs job analysis in that same request. The analysis extracts and stores:

- Required skills.
- Preferred skills.
- Responsibilities.
- Experience requirements.
- Technologies.
- Interview topics, ordered by relevance to the description.
- Important keywords.

If the job description changes, the stored analysis, interview plan, and tailored resume are no longer current. Resume tailoring, interview planning, and new assessments require a current analysis. Existing attempts and scores stay stored. Deleting a job deletes its analysis, plan, tailored resume, and attempts.

Job analysis reads the job description only. It does not read the candidate profile.

---

## 6. Resume Tailoring

Users must be able to request a tailored resume for a selected job that already has a current analysis.

The resume-tailoring workflow must:

1. Read the stored job analysis.
2. Retrieve relevant experience and projects through `search_candidate_experience`.
3. Load supporting facts through the section MCP tools.
4. Select the strongest matching experience.
5. Rewrite bullet points for relevance.
6. Preserve factual accuracy.
7. Include appropriate job-description keywords.
8. Return one structured JSON resume.

The workflow must not receive the candidate profile in its prompt except as MCP tool results. It must not use `get_candidate_profile` as its retrieval step. It must not read uploaded resume files.

The AI must never create skills, jobs, projects, education, certifications, or accomplishments that are not present in the candidate profile. Every skill, experience item, project, education item, and certification in the JSON must reference the source profile record id.

A job has one current tailored resume. Generating again replaces that JSON. The MVP does not keep prior resume versions.

---

## 7. MCP Server

Create a custom MCP server that is the only AI-facing interface to candidate data.

Tools:

- get_candidate_profile
- get_skills
- get_experience
- get_projects
- get_project_details
- search_candidate_experience
- get_education
- get_certifications

The MCP server reads candidate data from the application database. `search_candidate_experience` is the only RAG path. It is the only tool that queries pgvector. Its corpus is stored work experience and projects, embedded when those records are created or updated. Skills, education, and certifications are returned by their section tools, not by vector search.

No tool accepts a user id or any other identity field. The API binds the authenticated user into the MCP request context. The model cannot choose or override that identity. The server must ignore any model-supplied identity.

Uploaded resume files are not MCP tools and are not part of retrieval.

For the MVP, only the resume-tailoring workflow may call these tools.

---

## 8. Interview Preparation

For a selected job with a current analysis, the system generates one interview preparation plan.

The plan workflow reads the stored job analysis only. It does not read the candidate profile.

It selects the relevant categories from:

- Data structures and algorithms.
- Frontend.
- Backend.
- System design.
- Machine learning.
- AI/LLM systems.
- Behavioral questions.

The plan stores those categories in relevance order, plus the interview topics from the analysis. A job has one current plan. Generating again replaces it. A later assessment uses this stored plan.

---

## 9. Interview Assessment

Users must be able to start an interview attempt for a job that has a current interview plan. A job may have only one in-progress attempt.

Question generation runs when the attempt starts. It reads the stored plan and the job's stored question history. It does not read the candidate profile.

Each attempt contains exactly 8 questions, distributed as evenly as possible across the plan's categories. If the counts cannot be equal, the extra questions go to the categories earlier in the plan's relevance order. If the plan has one category, all 8 questions use that category.

Each question must contain:

- Question text.
- Category.
- Expected concepts.
- Evaluation rubric.
- User answer.
- AI feedback.
- Integer score from 0 through 100.

An attempt is stored only after it has 8 questions. A question is rejected when its normalized text matches a question already stored for that user and job. Normalized text is trimmed, internal whitespace is collapsed, and comparison is case-insensitive. Semantic deduplication is not required.

Question generation retry rules:

- Question generation allows at most 3 generation rounds.
- A generation round requests only the questions still missing.
- If 8 unique questions are not produced after 3 rounds, the request fails and no attempt is saved.

The user answers one question at a time. Answer evaluation reads that question, its rubric, and the user's answer. It does not read the candidate profile. It returns structured feedback and an integer score from 0 through 100.

An attempt is complete when all 8 answers have scores.

Score rules for a completed attempt:

- The overall score is the arithmetic mean of the 8 question scores.
- A category score is the arithmetic mean of the question scores in that category.
- A tested category is a category that has at least one question on that attempt. Untested categories are ignored.

---

## 10. Interview Retakes

A completed attempt passes only when both of these are true:

- Overall score >= 80.
- Every tested category scores >= 70.

If the attempt does not pass, the user may start another attempt. The user may also start another attempt after a pass. The new attempt must not reuse a stored question for that user and job. New questions should test similar skills using different scenarios.

All attempts, questions, answers, and scores remain stored. Readiness always follows the latest completed attempt.

---

## 11. Interview Readiness

Readiness is calculated per job from the latest completed attempt, using the pass rule in section 10.

If that attempt passed, award:

"Interview Ready"

If there is no completed attempt, or the latest completed attempt did not pass, the job does not have the badge. The badge applies only to that specific job.

---

## 12. Dashboard

The dashboard should show each job and its current status:

- Company.
- Job title.
- Whether job analysis is current.
- Whether a current tailored resume exists.
- Whether a current interview plan exists.
- Latest completed attempt's overall score, if any.
- Interview readiness badge.

An in-progress attempt is not the latest score and cannot award the badge.

---

## 13. AI Architecture

AI workflows use:

- Gemini API.
- LangChain.js.
- LangGraph.js.
- MCP, for candidate data only.
- Structured outputs.
- RAG only inside `search_candidate_experience`.

LangGraph coordinates the steps inside a single workflow. The API invokes one workflow per user action, synchronously, in that request. The MVP has no queues and no background workers.

The workflows are:

1. Job analysis.
2. Resume tailoring.
3. Interview plan.
4. Interview question generation.
5. Answer evaluation.

Each workflow has the inputs and data boundaries defined in the sections above.

---

## 14. Data Storage

Use PostgreSQL for application data.

Store:

- Users.
- Authentication sessions.
- Candidate profile records.
- Uploaded resume files' storage metadata.
- Jobs.
- Job analyses.
- One current tailored resume JSON per job.
- One current interview plan per job.
- Interview attempts.
- Questions.
- Answers.
- Scores.
- Embeddings for work experience and projects.

pgvector is used only by `search_candidate_experience`.

Uploaded resume files are stored outside the database: local storage in development, and object storage in production. Only metadata and the storage location belong in PostgreSQL.

---

## 15. Non-Goals for Initial Version

The first version should not include:

- Automatic job applications.
- Browser automation.
- Job-board scraping.
- Email integrations.
- Complex social features.
- Payments.
- Mobile applications.
- Multi-agent systems.
- Automatic parsing of uploaded resumes.
- Semantic deduplication of interview questions.
- Queues or background workers.
- More than one current tailored resume per job.

Focus first on a reliable end-to-end workflow.
