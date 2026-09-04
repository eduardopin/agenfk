# Flow definition — `agenfk-delivery`

Adapted from `sharkverify-delivery` (`cfde9a06`) for this repository. Create it with
`agenfk flow create agenfk-delivery` (interactive — there is no non-interactive CLI
path) or in the flow editor at `agenfk ui`, then activate it with
`agenfk flow use <newFlowId> --project ef5f9e00-b80d-4f9a-9a82-846479156f2d`.

**Step names are deliberate.** `IN_PROGRESS` is kept rather than renamed to
sharkverify's `IMPLEMENT`: item `3d4988dc` (T02) is sitting on `IN_PROGRESS` right now,
and a flow without that step would park it on a step the flow does not contain, which
the gatekeeper reports as UNKNOWN. `MUTATE` is inserted between `TEST` and `DONE`, so
it becomes the final step and `agenfk verify` without a command runs the project's
`verifyCommand` there.

| Order | Step | Anchor |
|---|---|---|
| 0 | TODO | yes |
| 1 | IN_PROGRESS | no |
| 2 | REVIEW | no |
| 3 | TEST | no |
| 4 | MUTATE | no |
| 5 | DONE | yes |

---

## TODO
*(no exit criteria)*

## IN_PROGRESS

Work in this task's own git worktree on its `feature/<item-id>_t<nn>-<slug>` branch
(plan §2.3). Never commit to `main`, never `--force`, never `--no-verify`. Run `npm ci`
in a new worktree before anything else — `git worktree add` gives a checkout with no
`node_modules`. Create `.agenfk/project.json` in the worktree before running
`agenfk verify`: without it `findProjectRoot` walks up to `$HOME` and runs the
verify command there (BUG 37660bd2).

Explore before claiming anything exists — grep for the specific function, route or
config key rather than assuming. MEASURE the baseline suite on the branch point and
record the numbers; do not trust a count written in a document. For a defect, reproduce
it first, fix the root cause rather than the symptom, then look for the same pattern
elsewhere. Never mask a failing test with a threshold, a skip or a loosened assertion.
`npm run build` must pass and be reported. Record out-of-scope defects you find as new
AgEnFK items; do not fix them without approval.

## REVIEW

Get the review from an INDEPENDENT reviewer, not from yourself. This is not conditional
on the change being risky — the author is the worst judge of whether their own code is
correct, and the finder of a defect is the worst judge of whether the fix closed it.
Spawn a read-only reviewer and brief it to hunt for defects. Re-read every file you
changed: correctness, edge cases, error handling, input validation, authorization.
For any test you touched, confirm it still proves what its name claims. Verify each
finding against the code before acting on it, and state which findings you rejected and
why. If sub-agents cannot be spawned, say so plainly and ask for a review in a fresh
session — never claim an independent review you did not have.

## TEST

The full suite passes: `npm run build && npm test`. Report the ACTUAL numbers —
files, passed, skipped, failed — never "tests pass". Compare against the baseline you
measured at IN_PROGRESS: the count must not fall, and it must RISE by the tests this
change adds. Confirm no test was deleted, renamed away, skipped or had an assertion
weakened; a green suite with fewer tests than you started with is a regression, not a
pass. Name the specific tests that cover the new behaviour — you will have to make each
one fail at MUTATE.

Report per-file coverage for every file you added or changed; new code is held to ≥80%.
The global gate is NOT a usable pass/fail signal — branches sit at 74.63% against an 80%
threshold on an unmodified checkout (contradiction C20), so report the global figure as
unchanged rather than green, and never "fix" it by weakening a test.

## MUTATE

THIS IS THE GATE. A green suite is not evidence. Break the production code on purpose
and prove the tests notice.

For EVERY test named at TEST as covering the new behaviour: apply a mutation to the
production code that test claims to cover, run the suite, and confirm that test goes
RED. Mutate ONE thing at a time, restore between mutations (`git checkout -- <path>`),
and confirm `git status --porcelain` is clean before the next one. Report the mutation
list as a table: what you changed, and which tests failed. "Mutations applied, all
caught" without the per-mutation result is not evidence and does not pass this step.

Mutations must target the BEHAVIOUR, not merely any line — reverting a whole function
proves less than flipping the specific branch, boundary or constant the test names.
Include at least one wrong-but-plausible value (an off-by-one, a near-miss string) and
at least one boundary. If a test survives its mutation, that test is not coverage:
FIX THE TEST, never lower this bar and never delete the mutation.

Prefer a verifier who did not write the code; if that is impossible, say so explicitly
in the evidence — self-verification is weaker and the record must show it. Finally,
confirm the working tree is restored: no mutation may be committed.

Note: `@stryker-mutator/core` 10 is already a devDependency with no `stryker.conf`.
Automating this step with StrykerJS is a legitimate future option, but a mutation score
is not a substitute for naming which test caught which mutation.

## DONE
*(no exit criteria)*
