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
      prunable: false,
    });
    // And the repository was left exactly as it was.
    expect(git(repo, "rev-parse", "--abbrev-ref", "HEAD").trim()).toBe("main");
  });

  it("sees the same thing from inside the other worktree, in reverse", () => {
    expect(resolveBranchCheckout("main", { cwd: worktree })).toEqual({
      kind: "in-other-worktree",
      branch: "main",
      path: repo,
      prunable: false,
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
    // A distinct kind: reporting "checked-out" for something it did not check
    // out would have the renderer print "Switched to branch" untruthfully.
    expect(outcome).toEqual({ kind: "would-check-out", branch: "free-branch" });
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

    // The tree is dirty, so the refusal now comes from this module rather than
    // from git — which is the point: nothing is attempted near uncommitted work.
    expect(resolveBranchCheckout("divergent", { cwd: other })).toEqual({
      kind: "refused-dirty",
      branch: "divergent",
    });
  });
});

describe("resolveBranchCheckout — the dash that ate the working tree", () => {
  it("refuses a branch name starting with a dash, before git ever sees it", () => {
    // `git branch` rejects such a name, but `git update-ref` creates it and
    // `PUT /items/:id` stores `branchName` with no format check. Passed as the
    // first positional argument, `-f` is the OPTION -f: `git checkout -f`
    // discards the working tree, reports success, and never moves HEAD.
    const dash = path.join(tmp, "dashrepo");
    fs.mkdirSync(dash);
    git(dash, "init", "-q", "-b", "main");
    git(dash, "config", "user.email", "test@example.com");
    git(dash, "config", "user.name", "Test");
    fs.writeFileSync(path.join(dash, "f.txt"), "committed\n");
    git(dash, "add", "-A");
    git(dash, "commit", "-qm", "initial");
    git(dash, "update-ref", "refs/heads/-f", "HEAD");
    fs.writeFileSync(path.join(dash, "f.txt"), "PRECIOUS UNCOMMITTED WORK\n");

    expect(resolveBranchCheckout("-f", { cwd: dash })).toEqual({
      kind: "invalid-name",
      branch: "-f",
    });
    // The whole point: the uncommitted work is still there.
    expect(fs.readFileSync(path.join(dash, "f.txt"), "utf8")).toContain("PRECIOUS");
  });

  it("refuses `--pathspec-from-file=...` the same way", () => {
    expect(resolveBranchCheckout("--pathspec-from-file=/etc/passwd", { cwd: repo }).kind).toBe(
      "invalid-name",
    );
  });
});

describe("resolveBranchCheckout — refuses to act near uncommitted work", () => {
  it("does not switch branches when the tree is dirty", () => {
    const dirty = path.join(tmp, "dirtyrepo");
    fs.mkdirSync(dirty);
    git(dirty, "init", "-q", "-b", "main");
    git(dirty, "config", "user.email", "test@example.com");
    git(dirty, "config", "user.name", "Test");
    fs.writeFileSync(path.join(dirty, "f.txt"), "one\n");
    git(dirty, "add", "-A");
    git(dirty, "commit", "-qm", "one");
    git(dirty, "branch", "target");
    fs.writeFileSync(path.join(dirty, "f.txt"), "work in progress\n");

    expect(resolveBranchCheckout("target", { cwd: dirty })).toEqual({
      kind: "refused-dirty",
      branch: "target",
    });
    expect(git(dirty, "rev-parse", "--abbrev-ref", "HEAD").trim()).toBe("main");
    expect(fs.readFileSync(path.join(dirty, "f.txt"), "utf8")).toContain("work in progress");
  });

  it("counts an untracked file as dirty too", () => {
    const dirty2 = path.join(tmp, "dirtyrepo2");
    fs.mkdirSync(dirty2);
    git(dirty2, "init", "-q", "-b", "main");
    git(dirty2, "config", "user.email", "test@example.com");
    git(dirty2, "config", "user.name", "Test");
    fs.writeFileSync(path.join(dirty2, "f.txt"), "one\n");
    git(dirty2, "add", "-A");
    git(dirty2, "commit", "-qm", "one");
    git(dirty2, "branch", "target");
    fs.writeFileSync(path.join(dirty2, "untracked.txt"), "new\n");

    expect(resolveBranchCheckout("target", { cwd: dirty2 }).kind).toBe("refused-dirty");
  });
});

describe("resolveBranchCheckout — repository states", () => {
  it("distinguishes a repository with no commits from a non-repository", () => {
    const unborn = path.join(tmp, "unborn");
    fs.mkdirSync(unborn);
    git(unborn, "init", "-q", "-b", "main");
    expect(resolveBranchCheckout("main", { cwd: unborn })).toEqual({
      kind: "unborn",
      branch: "main",
    });
  });

  it("does not mistake a detached HEAD for being on a branch called HEAD", () => {
    const det = path.join(tmp, "detached");
    fs.mkdirSync(det);
    git(det, "init", "-q", "-b", "main");
    git(det, "config", "user.email", "test@example.com");
    git(det, "config", "user.name", "Test");
    fs.writeFileSync(path.join(det, "f.txt"), "one\n");
    git(det, "add", "-A");
    git(det, "commit", "-qm", "one");
    git(det, "checkout", "-q", "--detach");
    // `git rev-parse --abbrev-ref HEAD` returns the literal "HEAD" here.
    expect(resolveBranchCheckout("HEAD", { cwd: det }).kind).not.toBe("already-on");
  });

  it("points at the remote when the branch exists only there", () => {
    const origin = path.join(tmp, "origin.git");
    git(tmp, "init", "-q", "--bare", origin);
    const clone = path.join(tmp, "clone");
    git(repo, "push", "-q", origin, "main:main");
    git(tmp, "clone", "-q", origin, clone);
    git(repo, "push", "-q", origin, "free-branch:remote-only");
    git(clone, "fetch", "-q", "origin");

    const outcome = resolveBranchCheckout("remote-only", { cwd: clone });
    expect(outcome.kind).toBe("missing");
    if (outcome.kind === "missing") expect(outcome.remote).toBe("origin/remote-only");
    expect(renderBranchCheckout(outcome)).toContain("git checkout -b remote-only origin/remote-only");
  });
});

describe("parseWorktreeBranches — prunable and spaced paths", () => {
  it("marks a worktree whose directory is gone as prunable", () => {
    const porcelain = [
      "worktree /home/u/repo",
      "HEAD abc123",
      "branch refs/heads/main",
      "",
      "worktree /home/u/wt/gone",
      "HEAD def456",
      "branch refs/heads/orphaned",
      "prunable gitdir file points to non-existent location",
      "",
    ].join("\n");
    const map = parseWorktreeBranches(porcelain);
    expect(map.get("orphaned")).toEqual({ path: "/home/u/wt/gone", prunable: true });
    expect(map.get("main")?.prunable).toBe(false);
    // And the agent is told to prune rather than sent to a directory that is gone.
    expect(
      renderBranchCheckout({ kind: "in-other-worktree", branch: "orphaned", path: "/home/u/wt/gone", prunable: true }),
    ).toContain("git worktree prune");
  });

  it("keeps a path containing spaces intact", () => {
    const porcelain = ["worktree /home/u/my space/wt", "HEAD abc", "branch refs/heads/spaced", ""].join("\n");
    expect(parseWorktreeBranches(porcelain).get("spaced")?.path).toBe("/home/u/my space/wt");
  });

  it("handles CRLF and a missing trailing blank line", () => {
    const porcelain = "worktree /home/u/repo\r\nHEAD abc\r\nbranch refs/heads/main";
    expect(parseWorktreeBranches(porcelain).get("main")?.path).toBe("/home/u/repo");
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
    expect(map.get("main")?.path).toBe("/home/u/repo");
    expect(map.get("feature/x")?.path).toBe("/home/u/wt/t01");
    expect(map.get("main")?.prunable).toBe(false);
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
    expect(map.get("main")?.path).toBe("/home/u/repo");
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
