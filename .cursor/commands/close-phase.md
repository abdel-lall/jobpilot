---
name: close-phase
description: Document, commit, merge, and clean up a completed JobPilot phase with approval gates
---

# Close Current Phase

Read:

- `specs/status.md`
- current phase `spec.md`
- current phase `validation.md`
- current phase `notes.md`

Verify:

- current branch is `phase/NN-*`
- implementation review passed
- required validation passed
- working changes belong only to the current phase

## Step 1 — Update documentation

Update only:

- current phase `validation.md`
- current phase `notes.md`
- `specs/status.md`

### validation.md

Record:

- commands actually executed
- results
- PASS/FAIL status
- completed checklist
- any validation gaps

### notes.md

Record:

- accepted implementation deviations
- non-blocking review findings
- important implementation decisions
- unresolved issues, if any

Do not create mandatory future tasks for harmless observations.

### status.md

Mark:

- current phase complete
- next phase as next
- current branch

Then show the documentation diff summary.

Stop and wait for human approval before committing.

## Step 2 — Commit

Only after explicit human approval:

1. stop local runtime services if appropriate
2. stage the phase implementation and phase documentation
3. create a conventional commit:

   `feat: complete phase NN <phase short name>`

4. verify:
   - current branch
   - clean working tree
   - commit hash
   - commit message

Stop and wait for explicit human approval before merging.

## Step 3 — Merge and cleanup

Only after explicit human approval:

1. switch to `main`
2. verify working tree is clean
3. merge the phase branch using `--no-ff`
4. verify the phase commit is present in history
5. delete the completed local phase branch
6. verify:
   - current branch is `main`
   - working tree is clean
   - branch was deleted

Do not start the next phase automatically.

Report the final repository state.