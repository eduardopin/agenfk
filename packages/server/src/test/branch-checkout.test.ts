/**
 * Tests for the gatekeeper's worktree-aware branch check (C11).
 *
 * The case that matters is a branch checked out in another worktree: the
 * previous code ran `git checkout`, git refused, and the catch-all reported
 * "Branch does not exist locally" — telling an agent to create a branch that
 * already exists. These build real repositories and real worktrees rather than
 * faking git, because the refusal is git's own behaviour and a mock would just
 * encode the assumption under test.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execFileSync } from "child_process";
import {
  resolveBranchCheckout,
  renderBranchCheckout,
  parseWorktreeBranches,
} from "../branch-checkout";

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });

let tmp: string;
let repo: string;
let worktree: string;

beforeAll(() => {
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "agenfk-branchco-")));
  repo = path.join(tmp, "repo");
  fs.mkdirSync(repo);
  git(repo, "init", "-q", "-b", "main");
  git(repo, "config", "user.email", "test@example.com");
  git(repo, "config", "user.name", "Test");
  fs.writeFileSync(path.join(repo, "README.md"), "# fixture\n");
  git(repo, "add", "-A");
  git(repo, "commit", "-qm", "initial");

  // A free branch, and a branch occupied by a worktree — the two states the
  // gatekeeper has to tell apart.
  git(repo, "branch", "free-branch");
  worktree = path.join(tmp, "wt");
  git(repo, "worktree", "add", "-q", worktree, "-b", "busy-branch");
  worktree = fs.realpathSync(worktree);
});

afterAll(() => {
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
});

describe("resolveBranchCheckout", () => {
  it("reports being already on the branch without touching anything", () => {
    expect(resolveBranchCheckout("main", { cwd: repo })).toEqual({
      kind: "already-on",
      branch: "main",
    });
  });

  it("reports a branch held by another worktree, and never checks it out", () => {
    // The regression. `busy-branch` exists and is checked out at `worktree`;
    // the old code ran `git checkout`, git refused, and the agent was told the
    // branch did not exist.
    const outcome = resolveBranchCheckout("busy-branch", { cwd: repo });
    expect(outcome).toEqual({
      kind: "in-other-worktree",
      branch: "busy-branch",
      path: worktree,
    });
    // And the repository was left exactly as it was.
    expect(git(repo, "rev-parse", "--abbrev-ref", "HEAD").trim()).toBe("main");
  });

  it("sees the same thing from inside the other worktree, in reverse", () => {
    expect(resolveBranchCheckout("main", { cwd: worktree })).toEqual({
      kind: "in-other-worktree",
      branch: "main",
      path: repo,
    });
    expect(resolveBranchCheckout("busy-branch", { cwd: worktree })).toEqual({
      kind: "already-on",
      branch: "busy-branch",
    });
  });

  it("reports a missing branch as missing", () => {
    expect(resolveBranchCheckout("no-such-branch", { cwd: repo })).toEqual({
      kind: "missing",
      branch: "no-such-branch",
    });
  });

  it("reports what would happen without acting when performCheckout is false", () => {
    const outcome = resolveBranchCheckout("free-branch", { cwd: repo, performCheckout: false });
    expect(outcome).toEqual({ kind: "checked-out", branch: "free-branch" });
    expect(git(repo, "rev-parse", "--abbrev-ref", "HEAD").trim()).toBe("main");
  });

  it("checks out a free branch and comes back to main", () => {
    // Ordered last of the acting cases so it cannot disturb the others.
    expect(resolveBranchCheckout("free-branch", { cwd: repo })).toEqual({
      kind: "checked-out",
      branch: "free-branch",
    });
    expect(git(repo, "rev-parse", "--abbrev-ref", "HEAD").trim()).toBe("free-branch");
    git(repo, "checkout", "-q", "main");
  });

  it("reports a directory that is not a repository", () => {
    const plain = path.join(tmp, "not-a-repo");
    fs.mkdirSync(plain, { recursive: true });
    expect(resolveBranchCheckout("main", { cwd: plain })).toEqual({
      kind: "not-a-repo",
      branch: "main",
    });
  });

  it("reports git's own words when a checkout is refused", () => {
    // A local modification that the target branch would overwrite: git refuses,
    // and the message must be git's rather than a guess.
    const other = path.join(tmp, "repo2");
    fs.mkdirSync(other);
    git(other, "init", "-q", "-b", "main");
    git(other, "config", "user.email", "test@example.com");
    git(other, "config", "user.name", "Test");
    fs.writeFileSync(path.join(other, "f.txt"), "one\n");
    git(other, "add", "-A");
    git(other, "commit", "-qm", "one");
    git(other, "checkout", "-q", "-b", "divergent");
    fs.writeFileSync(path.join(other, "f.txt"), "two\n");
    git(other, "add", "-A");
    git(other, "commit", "-qm", "two");
    git(other, "checkout", "-q", "main");
    // Uncommitted change that switching would clobber.
    fs.writeFileSync(path.join(other, "f.txt"), "dirty\n");

    const outcome = resolveBranchCheckout("divergent", { cwd: other });
    expect(outcome.kind).toBe("checkout-failed");
    if (outcome.kind === "checkout-failed") {
      expect(outcome.error).toBeTruthy();
      expect(outcome.error).not.toContain("does not exist");
    }
  });
});

describe("parseWorktreeBranches", () => {
  it("maps each branch to its worktree path", () => {
    const porcelain = [
      "worktree /home/u/repo",
      "HEAD abc123",
      "branch refs/heads/main",
      "",
      "worktree /home/u/wt/t01",
      "HEAD def456",
      "branch refs/heads/feature/x",
      "",
    ].join("\n");
    const map = parseWorktreeBranches(porcelain);
    expect(map.get("main")).toBe("/home/u/repo");
    expect(map.get("feature/x")).toBe("/home/u/wt/t01");
    expect(map.size).toBe(2);
  });

  it("omits a detached worktree, which has no branch line", () => {
    const porcelain = [
      "worktree /home/u/repo",
      "HEAD abc123",
      "branch refs/heads/main",
      "",
      "worktree /home/u/wt/detached",
      "HEAD def456",
      "detached",
      "",
    ].join("\n");
    const map = parseWorktreeBranches(porcelain);
    expect(map.size).toBe(1);
    expect(map.get("main")).toBe("/home/u/repo");
  });

  it("returns nothing for empty output", () => {
    expect(parseWorktreeBranches("").size).toBe(0);
  });
});

describe("renderBranchCheckout", () => {
  it("names the other worktree so the agent knows where the branch went", () => {
    const text = renderBranchCheckout({
      kind: "in-other-worktree",
      branch: "feature/x",
      path: "/home/u/wt/t01",
    });
    expect(text).toContain("feature/x");
    expect(text).toContain("/home/u/wt/t01");
    // The message this replaces. It must not come back.
    expect(text).not.toContain("does not exist locally");
  });

  it("still says plainly when a branch is genuinely missing", () => {
    expect(renderBranchCheckout({ kind: "missing", branch: "gone" })).toContain(
      "does not exist locally",
    );
  });

  it("carries git's own error when a checkout was refused", () => {
    expect(
      renderBranchCheckout({ kind: "checkout-failed", branch: "b", error: "local changes" }),
    ).toContain("local changes");
  });
});
