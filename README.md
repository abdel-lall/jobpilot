# JobPilot AI

JobPilot AI is a full-stack AI-powered job preparation platform that helps candidates organize job applications, generate grounded tailored resumes, create interview plans, practice interview questions, and track interview readiness.

The application combines a React/TypeScript frontend, Node.js/Express API, PostgreSQL with Prisma, an MCP server for candidate-data access, and LangChain/LangGraph workflows powered by Gemini.

## Screenshots
<img width="3071" height="1680" alt="Screenshot 2026-10-05 220029" src="https://github.com/user-attachments/assets/e0f93203-ab2c-456e-acf0-4df8e37e305c" />
<img width="3071" height="1685" alt="Screenshot 2026-10-05 215932" src="https://github.com/user-attachments/assets/b895b676-eff6-42b5-a3d0-4019028dbd62" />
<img width="3071" height="1687" alt="Screenshot 2026-10-05 220011" src="https://github.com/user-attachments/assets/7a492799-3c6c-49f4-a57f-4121e6462a27" />


---

## Features

### Candidate Profile

Create and manage reusable career information:

- Work experience
- Education
- Skills
- Projects
- Certifications
- Resume uploads

The profile acts as the source of truth for AI-generated job-preparation content.

### Job Workspace

Each saved job appears in the Dashboard workspace with actions for:

- **Details** — review the job description, analysis, and current preparation status
- **Resume** — generate and preview a tailored resume
- **Plan** — generate an interview preparation plan
- **Interview** — practice job-specific interview questions and receive scored feedback

The Dashboard uses a persistent jobs menu and a focused active-work area so only one workflow is shown at a time.

### AI Job Analysis

When a job is created or its description changes, JobPilot analyzes the posting and extracts structured information such as:

- Required skills
- Preferred skills
- Responsibilities
- Experience requirements
- Technologies
- Interview topics
- Keywords

This analysis is reused by downstream resume and interview workflows.

### Grounded Tailored Resumes

Generate a job-specific resume using only information stored in the candidate profile.

The resume workflow is designed to prevent unsupported AI-generated experience:

- Resume content references candidate profile records through internal source IDs
- Generated data is validated before persistence
- Grounding checks ensure generated content corresponds to real profile data
- Internal IDs are never displayed to the user
- Nullable profile values must remain null rather than being invented

The UI renders the result as a professional resume document with:

- Contact header
- Skills
- Experience
- Projects
- Education
- Certifications
- Human-readable dates
- PDF download

Resume freshness is also shown in the UI:

- **Up to date** — a current tailored resume exists
- **Needs regeneration** — the job changed and a new resume is required

### Interview Plans

Generate a structured interview preparation plan based on the analyzed job.

Plans include:

- Interview categories
- Job-specific preparation topics
- Areas derived from the job analysis

### Interview Practice

Start an interview attempt with eight generated questions.

Questions are tailored to the job and avoid previously used question text across retakes.

For each question, the user can:

- Submit an answer
- Receive AI-generated feedback
- Receive a score from 0–100

Questions are displayed as `Question 1`, `Question 2`, and so on for a clearer interview flow.

### Interview Readiness

A completed attempt is evaluated using deterministic readiness rules.

A candidate is marked **Interview Ready** when:

- The total score across 8 questions is at least 640
- Each interview category averages at least 70

Retakes preserve history while generating new questions.

---

## Tech Stack

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- TanStack Query
- React Hook Form
- Zod

### Backend

- Node.js
- Express
- TypeScript
- Zod
- JWT authentication
- Argon2id password hashing

### Database

- PostgreSQL
- Prisma
- pgvector

### AI

- Google Gemini
- LangChain
- LangGraph

Current model configuration uses Gemini for generative workflows and Gemini embeddings for semantic search.

### MCP

JobPilot includes a dedicated MCP server used as the AI-facing boundary for candidate data.

The AI layer retrieves candidate information through controlled MCP tools rather than directly querying arbitrary database records.

### Infrastructure & Tooling

- pnpm workspaces
- Docker Compose
- Vitest
- Supertest
- Playwright
- GitHub Actions

---

## Monorepo Structure

```text
jobpilot/
├── apps/
│   ├── web/               # React frontend
│   ├── api/               # Express REST API
│   └── portfolio-mcp/     # MCP server
│
├── packages/
│   ├── ai/                # LangChain / LangGraph AI workflows
│   ├── database/          # Prisma schema, migrations, database client
│   └── shared/            # Shared schemas and TypeScript types
│
├── specs/
│   ├── phases/            # Functional implementation specifications
│   └── ui-improvements/   # UI refinement specifications
│
├── docker-compose.yml
├── pnpm-workspace.yaml
└── package.json
```

---

## Architecture

```text
┌──────────────────────┐
│      React Web       │
│  Vite / TypeScript   │
└──────────┬───────────┘
           │ REST
           ▼
┌──────────────────────┐
│     Express API      │
│ Auth / Jobs / Resume │
│ Interview Workflows  │
└───────┬────────┬─────┘
        │        │
        │        └──────────────┐
        ▼                       ▼
┌───────────────┐      ┌──────────────────┐
│  PostgreSQL   │      │    AI Package    │
│ Prisma /      │      │ LangChain /      │
│ pgvector      │      │ LangGraph        │
└───────────────┘      └────────┬─────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   MCP Server     │
                       │ Candidate Data   │
                       └────────┬─────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │ Google Gemini    │
                       └──────────────────┘
```

---

## Authentication

JobPilot uses:

- Short-lived JWT access tokens
- Refresh sessions stored server-side
- HttpOnly refresh cookies
- Argon2id password hashing
- Credentialed CORS
- Secure cookies in production

The frontend keeps the access token in memory rather than persistent browser storage.

---

## AI Workflow Design

JobPilot separates AI generation from application validation.

A typical workflow looks like:

```text
Job Description
      │
      ▼
Structured Job Analysis
      │
      ├──────────────► Tailored Resume
      │
      └──────────────► Interview Plan
                              │
                              ▼
                       Interview Questions
                              │
                              ▼
                        Answer Evaluation
                              │
                              ▼
                       Readiness Decision
```

Structured outputs are validated with Zod before application logic uses them.

For tailored resumes, an additional grounding layer verifies generated data against the candidate's stored profile before persistence.

---

## Local Development

### Prerequisites

Install:

- Node.js
- pnpm
- Docker
- Docker Compose

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd jobpilot
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment variables

Copy the example environment file:

```bash
cp .env.example .env
```

Fill in the required values, including your Gemini API key and local database configuration.

Do not expose Gemini keys or database credentials in the frontend.

### 4. Start PostgreSQL

Use the project's Docker Compose configuration:

```bash
docker compose up -d
```

### 5. Generate the Prisma client

```bash
pnpm --filter @jobpilot/database prisma generate
```

### 6. Apply database migrations

```bash
pnpm --filter @jobpilot/database prisma migrate deploy
```

### 7. Start the application

Run the development services using the scripts defined in the root workspace.

```bash
pnpm dev
```

Refer to the root `package.json` if you want to run individual workspace applications separately.

---

## Environment Variables

The project uses environment variables for values such as:

```text
DATABASE_URL
JWT_SECRET
GEMINI_API_KEY
GEMINI_MODEL
GEMINI_EMBEDDING_MODEL
PORTFOLIO_MCP_URL
```

See `.env.example` for the current required configuration.

Never commit `.env`.

---

## Testing

### Type checking

```bash
pnpm typecheck
```

### Unit and integration tests

```bash
pnpm test
```

### End-to-end tests

The web application uses Playwright for end-to-end coverage.

```bash
pnpm --filter web exec playwright test
```

Coverage includes workflows such as:

- Authentication
- Profile management
- Job creation, editing, and deletion
- Job analysis
- Tailored resume generation
- Interview-plan generation
- Interview attempts
- Answer evaluation
- Readiness
- Retakes
- User-specific query-cache isolation

---

## Key Engineering Decisions

### Candidate data is the source of truth

AI workflows are not allowed to invent professional history for the candidate.

Generated resumes are validated against profile data before persistence.

### MCP as the AI data boundary

The AI workflow accesses candidate data through explicit MCP tools rather than receiving unrestricted database access.

### Strict structured outputs

AI responses are parsed through shared Zod schemas before entering application logic.

### Server-side resume freshness

Changing a job description invalidates the existing tailored resume and interview plan. The frontend reflects this state instead of pretending stale generated content is still current.

### Deterministic readiness

AI evaluates individual answers, but the final interview-readiness decision is deterministic application logic.

### User-isolated query caches

React Query keys include the authenticated user ID, and relevant cached data is cleared when users sign out or accounts change.

---

## UI

JobPilot uses a custom visual system built around:

```text
#80A8FF
#8EC1DE
#CEB5FF
#D3D3FF
#3F5F9A
```

The signed-in application includes:

- Fixed header
- Desktop sidebar / compact mobile navigation
- Profile card layout
- Dashboard workspace
- Persistent jobs menu
- Resume document preview
- Responsive layouts for smaller screens

---

## Project Development

The application was built incrementally using specification-driven development.

The main functional roadmap consists of **18 completed phases**, covering:

1. Monorepo and local runtime
2. Database foundation
3. Authentication API
4. Authentication UI
5. Candidate profile API
6. Candidate profile UI
7. Resume file storage
8. Jobs API
9. Jobs UI
10. Job analysis
11. MCP tools
12. Embeddings and semantic search
13. Tailored resume generation
14. Tailored resume UI
15. Interview plans
16. Interview questions
17. Answer evaluation
18. Retakes and interview readiness

Additional UI improvements were implemented separately from the functional roadmap.

---

## Screenshots

Add screenshots here once the project is deployed or when preparing the repository for portfolio use.

Suggested screenshots:

- Login
- Profile
- Dashboard workspace
- Job details
- Tailored resume preview
- Interview plan
- Interview attempt
- Interview readiness result

---

## Future Ideas

The current project intentionally focuses on the core candidate-preparation workflow.

Possible future extensions could include:

- Candidate profile contact fields
- Deployment
- Resume templates
- Additional AI providers
- Application-status tracking
- Analytics across interview attempts

These are not required for the current MVP.

---

## License

Add the license you want to use for this repository.

If the project is currently private, this section can be removed until you choose one.

---

## Author

**Abdelmounaim Lallouache**

Software Engineer focused on full-stack development, AI/ML systems, and AI-powered applications.
