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
  /**
   * The branch is checked out in a different worktree. Git would refuse, and
   * the caller has no business dragging it away from wherever it is being used.
   */
  | { kind: "in-other-worktree"; branch: string; path: string }
  /** No local branch by that name. */
  | { kind: "missing"; branch: string }
  /** A checkout was attempted and git refused — a dirty tree, most likely. */
  | { kind: "checkout-failed"; branch: string; error: string }
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
export function parseWorktreeBranches(porcelain: string): Map<string, string> {
  const byBranch = new Map<string, string>();
  let currentPath: string | undefined;
  for (const line of porcelain.split("\n")) {
    if (line.startsWith("worktree ")) {
      currentPath = line.slice("worktree ".length).trim();
    } else if (line.startsWith("branch ") && currentPath) {
      const ref = line.slice("branch ".length).trim();
      const name = ref.startsWith("refs/heads/") ? ref.slice("refs/heads/".length) : ref;
      byBranch.set(name, currentPath);
    } else if (line.trim() === "") {
      currentPath = undefined;
    }
  }
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

  const current = git(cwd, "rev-parse", "--abbrev-ref", "HEAD");
  if (current.out === undefined) {
    return { kind: "not-a-repo", branch };
  }
  if (current.out === branch) {
    return { kind: "already-on", branch };
  }

  // `refs/heads/<name>`, not the bare name. The previous implementation ran
  // `git rev-parse --verify -- <branch>`, where `--` tells git everything after
  // it is a **path** — so it answered "Needed a single revision" for every
  // branch that has ever existed, the catch-all turned that into "Branch does
  // not exist locally", and the gatekeeper's auto-checkout has never once run.
  // The fully-qualified ref is both unambiguous and injection-safe here: it is
  // one argv element, and a name that is not a ref simply does not resolve.
  const exists = git(cwd, "rev-parse", "--verify", "--quiet", `refs/heads/${branch}`);
  if (exists.out === undefined || exists.out === "") {
    return { kind: "missing", branch };
  }

  // Ask before acting. Git would refuse the checkout anyway, but the point is
  // to say *why* rather than report the refusal as a missing branch.
  const worktrees = git(cwd, "worktree", "list", "--porcelain");
  if (worktrees.out) {
    const path = parseWorktreeBranches(worktrees.out).get(branch);
    // A path equal to `cwd` would already have matched `already-on` above, so
    // anything found here is genuinely elsewhere.
    if (path) {
      return { kind: "in-other-worktree", branch, path };
    }
  }

  if (opts.performCheckout === false) {
    return { kind: "checked-out", branch };
  }

  // Same reason: `git checkout -- <branch>` is a file checkout, not a branch
  // switch. `--` is dropped and the name is passed as the single argument it is.
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
    case "in-other-worktree":
      return `\n🔀 Branch '${outcome.branch}' is checked out in another worktree (${outcome.path}). Work there, or create a worktree of your own — do not check it out here.`;
    case "missing":
      return `\n⚠️ Branch '${outcome.branch}' does not exist locally. Work on the current branch or ask the user to create it.`;
    case "checkout-failed":
      return `\n⚠️ Branch '${outcome.branch}' exists but could not be checked out: ${outcome.error}`;
    case "not-a-repo":
      return `\n⚠️ Not a git repository here, so branch '${outcome.branch}' could not be checked.`;
  }
}
