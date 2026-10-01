---
name: implement-phase
description: Plan or implement the current JobPilot phase with human approval gates
---

# Implement Current Phase

Read:

- `specs/requirements.md`
- `specs/tech-stack.md`
- `specs/roadmap.md`
- `specs/status.md`
- the current phase `spec.md`
- the current phase `validation.md`

Determine the current phase from the active `phase/NN-*` Git branch.

## If implementation has not started

Do not modify files yet.

Inspect the repository and produce a concise implementation plan covering:

- files to create
- files to modify
- dependencies to add or change
- configuration changes
- implementation structure
- tests to add
- validation commands that will run

For each item, explain why it is required by the current phase specification.

Check specifically that the plan includes no future-phase work.

Stop and wait for explicit human approval.

## If the human explicitly approves implementation

Implement exactly the approved plan.

Rules:

- current phase only
- no future-phase functionality
- no speculative abstractions
- do not modify approved specification files
- preserve existing passing behavior unless the phase explicitly changes it

After implementation, run all required commands from the current phase `validation.md`.

Report:

- files created or changed
- dependencies added or changed
- commands executed
- command results
- PASS/FAIL for each acceptance criterion
- deviations from the approved plan
- any item that could not be verified

Do not commit.

Stop for human review.