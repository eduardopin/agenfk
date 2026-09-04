/**
 * Regression tests for BUG `37660bd2-a249-4e0e-977c-ace47df65fc3`.
 *
 * The defect only reproduces from inside a **git worktree**, so these tests
 * build real repositories and real worktrees rather than faking the filesystem.
 * A test that only checked the marker walk would have passed against the broken
 * implementation.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import * as path from "path";
import * as fs from "fs";
import { execFileSync } from "child_process";

// `resolveProjectRoot` refuses to treat `os.homedir()` as a project marker.
// Proving that needs a home directory the test controls, so `os.homedir` is
// mocked to a temp directory. Hoisted because `vi.mock` runs before the module
// body.
const { fakeHome } = vi.hoisted(() => {
  // `vi.hoisted` runs before the module's own imports are initialised, so this
  // callback has to reach for its own.
  const nodeFs = require("fs") as typeof import("fs");
  const nodePath = require("path") as typeof import("path");
  const nodeOs = require("os") as typeof import("os");
  return {
    fakeHome: nodeFs.realpathSync(
      nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "agenfk-fakehome-")),
    ),
  };
});

vi.mock("os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("os")>();
  return { ...actual, default: actual, homedir: () => fakeHome };
});

import {
  resolveProjectRoot,
  findProjectRoot,
  resolveRepoToplevel,
  isRepoToplevel,
} from "../project-root";

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });

/** A repository with one commit — `git worktree add` refuses an unborn HEAD. */
function makeRepo(dir: string): string {
  fs.mkdirSync(dir, { recursive: true });
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "test@example.com");
  git(dir, "config", "user.name", "Test");
  fs.writeFileSync(path.join(dir, "README.md"), "# fixture\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "initial");
  return fs.realpathSync(dir);
}

let tmp: string;
let repo: string;
let worktree: string;

beforeAll(() => {
  // Everything lives *under* the fake home. That placement is the fixture: the
  // bug is that the marker walk escapes a worktree and keeps climbing until it
  // reaches `~/.agenfk`, so a temp tree outside the home directory would not
  // reproduce it and these tests would pass against the broken implementation.
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(fakeHome, "projects-")));

  // The framework's own config directory, the thing the walk used to mistake
  // for a project marker.
  fs.mkdirSync(path.join(fakeHome, ".agenfk"), { recursive: true });

  repo = makeRepo(path.join(tmp, "repo"));
  fs.mkdirSync(path.join(repo, ".agenfk"));
  fs.mkdirSync(path.join(repo, "packages", "server"), { recursive: true });

  worktree = path.join(tmp, "wt", "t99");
  git(repo, "worktree", "add", "-q", worktree, "-b", "fixture-branch");
  worktree = fs.realpathSync(worktree);
});

afterAll(() => {
  for (const dir of [tmp, fakeHome]) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* best effort — a leftover temp dir must not fail the suite */
    }
  }
});

describe("resolveProjectRoot", () => {
  it("returns the repository root when a .agenfk marker is there", () => {
    expect(resolveProjectRoot(repo)).toEqual({ root: repo, source: "marker" });
  });

  it("walks up to the marker from a subdirectory of the repository", () => {
    const sub = path.join(repo, "packages", "server");
    expect(resolveProjectRoot(sub)).toEqual({ root: repo, source: "marker" });
  });

  it("resolves a worktree to the worktree root, never to the home directory", () => {
    // The regression itself. A worktree has no `.agenfk`, so the old walk
    // climbed until it found `~/.agenfk` and returned $HOME.
    const result = resolveProjectRoot(worktree);
    expect(result).toEqual({ root: worktree, source: "git-toplevel" });
    expect(result.root).not.toBe(fakeHome);
  });

  it("resolves a subdirectory of a worktree to the worktree root", () => {
    const sub = path.join(worktree, "packages", "server");
    fs.mkdirSync(sub, { recursive: true });
    expect(resolveProjectRoot(sub)).toEqual({ root: worktree, source: "git-toplevel" });
  });

  it("stops at the repository boundary and ignores a marker above it", () => {
    // A repository nested under a directory that has its own `.agenfk`: the
    // outer marker belongs to a different project and must not win.
    const outer = path.join(tmp, "outer");
    fs.mkdirSync(path.join(outer, ".agenfk"), { recursive: true });
    const inner = makeRepo(path.join(outer, "inner"));
    expect(resolveProjectRoot(inner)).toEqual({ root: inner, source: "git-toplevel" });
  });

  it("never treats the home directory's .agenfk as a project marker", () => {
    // Not inside any repository, so there is no boundary to stop the walk —
    // only the explicit home exclusion prevents returning $HOME here.
    const underHome = path.join(fakeHome, "scratch", "deep");
    fs.mkdirSync(underHome, { recursive: true });
    expect(resolveProjectRoot(underHome)).toEqual({
      root: underHome,
      source: "fallback",
    });
  });

  it("falls back to the caller's directory outside any repository", () => {
    const plain = path.join(tmp, "not-a-repo");
    fs.mkdirSync(plain, { recursive: true });
    expect(resolveProjectRoot(plain)).toEqual({ root: plain, source: "fallback" });
  });

  it("honours an explicit envRoot over everything else", () => {
    expect(resolveProjectRoot(worktree, { envRoot: "/explicit/root" })).toEqual({
      root: "/explicit/root",
      source: "env",
    });
  });

  it("derives the root from a dbPath when no envRoot is given", () => {
    expect(
      resolveProjectRoot(worktree, { dbPath: "/some/proj/.agenfk/db.sqlite" }),
    ).toEqual({ root: "/some/proj", source: "db-path" });
  });

  it("prefers envRoot over dbPath", () => {
    expect(
      resolveProjectRoot(worktree, {
        envRoot: "/explicit/root",
        dbPath: "/some/proj/.agenfk/db.sqlite",
      }).source,
    ).toBe("env");
  });
});

describe("findProjectRoot", () => {
  it("returns just the root", () => {
    expect(findProjectRoot(repo)).toBe(repo);
    expect(findProjectRoot(worktree)).toBe(worktree);
  });
});

describe("resolveRepoToplevel", () => {
  it("returns the repository root from a subdirectory", () => {
    expect(resolveRepoToplevel(path.join(repo, "packages", "server"))).toBe(repo);
  });

  it("returns the worktree root, not the repository it came from", () => {
    expect(resolveRepoToplevel(worktree)).toBe(worktree);
  });

  it("returns undefined outside a repository", () => {
    const plain = path.join(tmp, "outside");
    fs.mkdirSync(plain, { recursive: true });
    expect(resolveRepoToplevel(plain)).toBeUndefined();
  });

  it("returns undefined for a directory that does not exist", () => {
    expect(resolveRepoToplevel(path.join(tmp, "missing"))).toBeUndefined();
  });
});

describe("isRepoToplevel", () => {
  it("is true at a repository root", () => {
    expect(isRepoToplevel(repo)).toBe(true);
  });

  it("is true at a worktree root", () => {
    expect(isRepoToplevel(worktree)).toBe(true);
  });

  it("is false in a subdirectory of a repository", () => {
    expect(isRepoToplevel(path.join(repo, "packages"))).toBe(false);
  });

  it("is false outside a repository", () => {
    expect(isRepoToplevel(fakeHome)).toBe(false);
  });
});
