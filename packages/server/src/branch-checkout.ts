/**
 * The gatekeeper's branch check, made worktree-aware.
 *
 * The gatekeeper checks out an item's `branchName` before the agent's first
 * edit, so that nobody codes on the wrong branch. It did that by running
 * `git rev-parse --verify` and then `git checkout`, catching **every** failure
 * as "Branch does not exist locally".
 *
 * That message is false in the case the delivery plan now makes routine. Git
 * refuses to check out a branch that is already checked out in another
 * worktree, so with one worktree per task the branch exists, the checkout
 * fails, and the agent is told the branch is missing — and would helpfully
 * create a second one. Once `branchName` is allowed on leaf items (C11) every
 * gatekeeper call from a worktree hits this.
 *
 * So the decision and the action are separated. {@link resolveBranchCheckout}
 * looks at the repository and returns what is true; the caller renders it and
 * decides whether to act. Nothing here guesses: a checkout that fails reports
 * git's own words.
 */

import { execFileSync } from "child_process";

export type BranchCheckoutOutcome =
  /** The item's branch is already the current one. Nothing to do. */
  | { kind: "already-on"; branch: string }
  /** The branch was checked out into the current worktree just now. */
  | { kind: "checked-out"; branch: string }
  /** The branch could be checked out, but the caller asked not to act. */
  | { kind: "would-check-out"; branch: string }
  /**
   * The branch is checked out in a different worktree. Git would refuse, and
   * the caller has no business dragging it away from wherever it is being used.
   * `prunable` means that worktree's directory is gone and the record is stale.
   */
  | { kind: "in-other-worktree"; branch: string; path: string; prunable?: boolean }
  /** No local branch by that name. `remote` names a remote-tracking one if found. */
  | { kind: "missing"; branch: string; remote?: string }
  /**
   * The branch is free, but the working tree has uncommitted changes. Switching
   * branches under an agent that is mid-edit is how work gets lost, so this
   * refuses rather than gambles.
   */
  | { kind: "refused-dirty"; branch: string }
  /**
   * Not a legal branch name. `git branch` rejects a leading dash, but
   * `git update-ref` does not, and `branchName` is stored unvalidated — so a
   * ref named `-f` would reach `git checkout` as the **option** `-f` and discard
   * the working tree. Refused before any git command sees it.
   */
  | { kind: "invalid-name"; branch: string }
  /** A checkout was attempted and git refused. Carries git's own words. */
  | { kind: "checkout-failed"; branch: string; error: string }
  /** A repository with no commits yet: HEAD points at an unborn branch. */
  | { kind: "unborn"; branch: string }
  /** Not a git repository at all, or `git` is unavailable. */
  | { kind: "not-a-repo"; branch: string };

export interface BranchCheckoutOptions {
  /** Where to run git. Defaults to the process's own directory. */
  cwd?: string;
  /**
   * Whether a free branch may actually be checked out. `false` reports what
   * *would* happen and touches nothing — which is what a test, or a read-only
   * caller, wants.
   */
  performCheckout?: boolean;
}

interface GitResult {
  out?: string;
  error?: string;
}

function git(cwd: string, ...args: string[]): GitResult {
  try {
    const out = execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      // This runs implicitly on every gatekeeper call. A git command against a
      // stale network mount must not block it indefinitely.
      timeout: 5000,
      windowsHide: true,
    });
    return { out: out.trim() };
  } catch (e: any) {
    const raw = String(e?.stderr || e?.message || e).trim();
    return { error: raw.split("\n")[0] || "git failed" };
  }
}

/**
 * Parse `git worktree list --porcelain` into branch → worktree path.
 *
 * The porcelain format is a stable contract: blank-line-separated records whose
 * `worktree <path>` line is followed, for a normal checkout, by
 * `branch refs/heads/<name>`. A detached worktree has no `branch` line and
 * simply does not appear in the map.
 */
export interface WorktreeEntry {
  path: string;
  /** The worktree's directory is gone; git still holds the record. */
  prunable: boolean;
}

export function parseWorktreeBranches(porcelain: string): Map<string, WorktreeEntry> {
  const byBranch = new Map<string, WorktreeEntry>();
  let currentPath: string | undefined;
  let prunable = false;
  let branch: string | undefined;
  const flush = () => {
    if (currentPath && branch) byBranch.set(branch, { path: currentPath, prunable });
    currentPath = undefined;
    branch = undefined;
    prunable = false;
  };
  for (const raw of porcelain.split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (line.startsWith("worktree ")) {
      flush();
      currentPath = line.slice("worktree ".length).trim();
    } else if (line.startsWith("branch ") && currentPath) {
      const ref = line.slice("branch ".length).trim();
      branch = ref.startsWith("refs/heads/") ? ref.slice("refs/heads/".length) : ref;
    } else if (line.startsWith("prunable")) {
      prunable = true;
    } else if (line.trim() === "") {
      flush();
    }
  }
  flush();
  return byBranch;
}

/**
 * Decide what should happen to `branch` in the repository at `cwd`, and — when
 * `performCheckout` is set and the branch is genuinely free — do it.
 */
export function resolveBranchCheckout(
  branch: string,
  opts: BranchCheckoutOptions = {},
): BranchCheckoutOutcome {
  const cwd = opts.cwd ?? process.cwd();

  // Before any git command sees it. `git branch` refuses a name starting with a
  // dash, but `git update-ref refs/heads/-f HEAD` creates one happily, and
  // `PUT /items/:id` stores `branchName` with no format check. Such a name is an
  // *option* to `git checkout`, and `git checkout -f` discards the working tree
  // and reports success — verified, and it is the reason this guard exists.
  if (branch.startsWith("-")) {
    return { kind: "invalid-name", branch };
  }

  const current = git(cwd, "rev-parse", "--abbrev-ref", "HEAD");
  if (current.out === undefined) {
    // A repository with no commits fails here too. Distinguish it: telling
    // someone their freshly-initialised project is not a repository is wrong.
    const inside = git(cwd, "rev-parse", "--is-inside-work-tree");
    return inside.out === "true"
      ? { kind: "unborn", branch }
      : { kind: "not-a-repo", branch };
  }
  // On a detached HEAD `--abbrev-ref HEAD` returns the literal string "HEAD",
  // which must not be mistaken for being on a branch called HEAD.
  const detached = current.out === "HEAD";
  if (!detached && current.out === branch) {
    return { kind: "already-on", branch };
  }

  // `refs/heads/<name>`, not the bare name. The previous implementation ran
  // `git rev-parse --verify -- <branch>`, where `--` tells git everything after
  // it is a **path** — so it answered "Needed a single revision" for every
  // branch that has ever existed, the catch-all turned that into "Branch does
  // not exist locally", and the gatekeeper's auto-checkout has never once run.
  const exists = git(cwd, "rev-parse", "--verify", "--quiet", `refs/heads/${branch}`);
  if (exists.out === undefined || exists.out === "") {
    // It may exist on a remote, which is a different piece of advice.
    const remote = git(cwd, "rev-parse", "--verify", "--quiet", `refs/remotes/origin/${branch}`);
    return remote.out
      ? { kind: "missing", branch, remote: `origin/${branch}` }
      : { kind: "missing", branch };
  }

  // Ask before acting. Git would refuse the checkout anyway, but the point is
  // to say *why* rather than report the refusal as a missing branch.
  const worktrees = git(cwd, "worktree", "list", "--porcelain");
  if (worktrees.out) {
    const entry = parseWorktreeBranches(worktrees.out).get(branch);
    // A path equal to `cwd` would already have matched `already-on` above, so
    // anything found here is genuinely elsewhere.
    if (entry) {
      return { kind: "in-other-worktree", branch, path: entry.path, prunable: entry.prunable };
    }
  }

  if (opts.performCheckout === false) {
    return { kind: "would-check-out", branch };
  }

  // Owner decision: act, but only on a clean tree. Switching branches under an
  // agent that is mid-edit is how work gets lost, and refusing here makes that
  // impossible by construction rather than by trusting the name validation
  // above to be exhaustive.
  const status = git(cwd, "status", "--porcelain");
  if (status.out === undefined) {
    return { kind: "checkout-failed", branch, error: status.error ?? "could not read the working tree" };
  }
  if (status.out !== "") {
    return { kind: "refused-dirty", branch };
  }

  // `git switch --end-of-options` is the form that cannot mistake a branch name
  // for an option; `git checkout` accepts no such terminator. `switch` needs
  // git >= 2.23, so an older git falls back to `checkout`, which the leading-dash
  // guard above has already made safe.
  const switched = git(cwd, "switch", "--end-of-options", branch);
  if (switched.out !== undefined) {
    return { kind: "checked-out", branch };
  }
  if (!/is not a git command|unknown option|usage: git/i.test(switched.error ?? "")) {
    return { kind: "checkout-failed", branch, error: switched.error ?? "git switch failed" };
  }
  const checkout = git(cwd, "checkout", branch);
  if (checkout.out === undefined) {
    return { kind: "checkout-failed", branch, error: checkout.error ?? "git checkout failed" };
  }
  return { kind: "checked-out", branch };
}

/** The one-line hint the gatekeeper appends to its authorization message. */
export function renderBranchCheckout(outcome: BranchCheckoutOutcome): string {
  switch (outcome.kind) {
    case "already-on":
      return `\n🔀 Already on branch '${outcome.branch}'.`;
    case "checked-out":
      return `\n🔀 Switched to branch '${outcome.branch}'.`;
    case "would-check-out":
      return `\n🔀 Branch '${outcome.branch}' is free — check it out before editing.`;
    case "in-other-worktree":
      return outcome.prunable
        ? `\n⚠️ Branch '${outcome.branch}' is held by a worktree whose directory is gone (${outcome.path}). Run \`git worktree prune\`, then check it out.`
        : `\n🔀 Branch '${outcome.branch}' is checked out in another worktree (${outcome.path}). Work there, or create a worktree of your own — do not check it out here.`;
    case "missing":
      return outcome.remote
        ? `\n⚠️ Branch '${outcome.branch}' exists only on the remote. Run \`git checkout -b ${outcome.branch} ${outcome.remote}\`.`
        : `\n⚠️ Branch '${outcome.branch}' does not exist locally. Work on the current branch or ask the user to create it.`;
    case "refused-dirty":
      return `\n⚠️ Branch '${outcome.branch}' was NOT checked out: the working tree has uncommitted changes. Commit or stash them, then switch — the server will not do it for you and risk your work.`;
    case "invalid-name":
      return `\n⚠️ '${outcome.branch}' is not a valid branch name (it starts with a dash) and was refused. Fix the item's branchName.`;
    case "checkout-failed":
      return `\n⚠️ Branch '${outcome.branch}' exists but could not be checked out: ${outcome.error}`;
    case "unborn":
      return `\n⚠️ This repository has no commits yet, so branch '${outcome.branch}' could not be checked.`;
    case "not-a-repo":
      return `\n⚠️ Not a git repository here, so branch '${outcome.branch}' could not be checked.`;
  }
}
