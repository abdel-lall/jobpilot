---
name: start-phase
description: Start the next JobPilot development phase and prepare its specifications
---

# Start Phase

Read:

- `specs/status.md`
- `specs/requirements.md`
- `specs/tech-stack.md`
- `specs/roadmap.md`

Determine the next incomplete phase from `specs/status.md`.

Before making changes, verify:

- current branch is `main`
- working tree is clean
- the previous phase is merged into `main`

If any condition fails, stop and report it.

If they pass:

1. Determine the phase number and roadmap title.
2. Create and switch to a branch named:
   `phase/NN-short-name`
3. Read that phase's section in `specs/roadmap.md`.
4. Update only:
   - `specs/phases/NN/spec.md`
   - `specs/phases/NN/validation.md`

## spec.md must contain

- objective
- scope
- affected subsystems
- explicit out-of-scope work
- dependencies
- implementation constraints

## validation.md must contain

- acceptance criteria
- required automated tests
- manual verification steps
- exact validation commands where appropriate
- completion checklist

Do not implement the phase.

Do not modify:

- requirements.md
- tech-stack.md
- roadmap.md

Do not include future-phase work.

After editing, report:

- branch created
- phase selected
- files changed
- concise summary of the phase specification
- any ambiguity that requires human review

Stop and wait for human approval.