---
name: review-phase
description: Review the current phase implementation against its approved specifications
---

# Review Current Phase

Read:

- `specs/requirements.md`
- `specs/tech-stack.md`
- `specs/roadmap.md`
- `specs/status.md`
- current phase `spec.md`
- current phase `validation.md`

Inspect:

- current Git diff
- files changed in the current phase
- dependencies changed
- tests
- configuration
- runtime behavior already validated

Do not modify any files.

Review specifically for:

- missing acceptance criteria
- incorrect behavior
- accidental future-phase work
- security issues
- secret exposure
- TypeScript strictness problems
- unnecessary dependencies
- unnecessary abstractions
- duplicated logic
- architecture violations
- configuration mistakes
- tests that do not actually prove the required behavior
- runtime/build regressions
- inconsistencies between implementation and phase specs

Review any listed implementation deviations and state whether each is acceptable.

Return:

1. overall PASS or FAIL
2. issues ordered by severity:
   - blocking
   - high
   - medium
   - low
3. required changes before commit
4. accepted deviations
5. verification gaps
6. whether implementation matches `spec.md`
7. whether implementation matches `validation.md`

Do not fix anything.

Stop and wait for human approval or instructions.