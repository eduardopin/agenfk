/**
 * Repository-bounded project-root resolution.
 *
 * The previous implementation walked up from the caller's directory looking for
 * any `.agenfk` directory and returned the first ancestor that had one, with no
 * repository boundary and no exclusion for the framework's own configuration
 * directory. From inside a git worktree — which has no `.agenfk`, because the
 * directory is gitignored and never checked out — that walk escapes past the
 * worktree, finds `~/.agenfk`, and returns the user's **home directory**.
 *
 * The server then persists that as `project.projectRoot` and runs the project's
 * `verifyCommand` there, and on the DONE transition `git add -A && git commit`
 * as well. On a machine whose home is a dotfiles repository that commits the
 * entire home directory. See BUG `37660bd2-a249-4e0e-977c-ace47df65fc3`.
 *
 * The fix is a boundary, not a wider search: a `.agenfk` marker only counts when
 * it sits at or below the git toplevel of the caller's own directory, and
 * `os.homedir()` never counts at all. When there is no marker but the caller is
 * inside a repository, the toplevel itself is the answer — for a worktree that
 * is the worktree root, which is exactly what is wanted.
 *
 * This module is the single implementation **inside `packages/server`**. The walk
 * previously existed twice there, in `server.ts` and in `index.ts`, and the two
 * had drifted: only the MCP entry point honoured `AGENFK_PROJECT_ROOT` and
 * `AGENFK_DB_PATH`. Those short-circuits are now options rather than a second
 * copy of the walk.
 *
 * A third copy lives in `packages/cli/src/index.ts` (`findProjectJsonPath`),
 * looking for `.agenfk/project.json` rather than the directory. It carries the
 * same two rules, duplicated rather than imported: the CLI depends only on
 * `@agenfk/core` — deliberately dependency-free and Node-free, ADR-0001 D2/D5 —
 * and `@agenfk/telemetry`, and neither is a legal home for a resolver that needs
 * `fs` and `child_process`. Recorded as debt.
 */

import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { execFileSync } from "child_process";

/** Where a resolved root came from. Reported so a repoint is never silent. */
export type ProjectRootSource =
  /** `AGENFK_PROJECT_ROOT` was set. */
  | "env"
  /** Derived from `AGENFK_DB_PATH`. */
  | "db-path"
  /** A `.agenfk` marker at or below the caller's repository toplevel. */
  | "marker"
  /** No marker, but the caller is inside a repository — its toplevel. */
  | "git-toplevel"
  /** No marker and no repository: the caller's own directory, unchanged. */
  | "fallback";

export interface ProjectRootResult {
  root: string;
  source: ProjectRootSource;
}

export interface ResolveProjectRootOptions {
  /** Usually `process.env.AGENFK_PROJECT_ROOT`. Wins over everything else. */
  envRoot?: string;
  /** Usually `process.env.AGENFK_DB_PATH`. The root is its grandparent directory. */
  dbPath?: string;
}

/**
 * Resolve a path without throwing when it does not exist.
 *
 * `realpath` matters on macOS, where `os.tmpdir()` is `/var/folders/…` but the
 * git toplevel of a repository created there comes back as `/private/var/…`.
 * Comparing the two without normalising makes {@link isRepoToplevel} return
 * `false` for a directory that plainly is one.
 */
export function safeRealpath(p: string): string {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

/**
 * The git toplevel of `dir`, or `undefined` when `dir` is not inside a
 * repository, does not exist, or `git` is unavailable.
 *
 * For a linked worktree this returns the worktree's own root, not the root of
 * the repository it was created from — which is the property the whole fix
 * rests on.
 */
function git(dir: string, ...args: string[]): { out?: string; error?: string } {
  try {
    const out = execFileSync("git", args, {
      cwd: dir,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      // `execFileSync` blocks the event loop, and this runs on the validate
      // path. A `git` call against a stale network mount would otherwise wedge
      // the whole daemon.
      timeout: 5000,
      windowsHide: true,
    }).trim();
    return { out };
  } catch (e: any) {
    // Four very different conditions land here — not a repository, `git` missing
    // from PATH, dubious ownership, a directory that does not exist — and every
    // caller's fail-closed answer is the same. But the *message* a caller shows
    // must not be: telling someone their healthy repository "is not a git
    // repository" because the daemon runs as another uid sends them hunting the
    // wrong problem. The ordinary "not a repository" case is not worth
    // reporting; anything else is.
    const raw = String(e?.stderr || e?.message || e).trim();
    if (!raw || /not a git repository/i.test(raw)) return {};
    const error = raw.split("\n")[0];
    // An abnormal git failure means the repository boundary this module rests on
    // is gone for every resolution — `git` off the daemon's PATH, dubious
    // ownership, a wedged mount. That must never pass unremarked.
    console.warn(`[PROJECT_ROOT] git failed in ${dir}: ${error}`);
    return { error };
  }
}

export function resolveRepoToplevelDetailed(dir: string): { top?: string; error?: string } {
  const { out, error } = git(dir, "rev-parse", "--show-toplevel");
  if (!out) return { error };
  const top = safeRealpath(out);
  // A submodule's toplevel is the submodule, not the project it belongs to.
  // Without this, `agenfk verify` from inside a submodule repoints the project
  // to the submodule and runs the superproject's verifyCommand there. Climb to
  // the outermost superproject so the boundary is the project the caller is
  // actually in. An unrelated nested clone reports no superproject and keeps
  // its own boundary, which is right — it is a different project.
  let outermost = top;
  for (let i = 0; i < 16; i++) {
    const { out: superOut } = git(outermost, "rev-parse", "--show-superproject-working-tree");
    if (!superOut) break;
    outermost = safeRealpath(superOut);
  }
  return { top: outermost };
}

export function resolveRepoToplevel(dir: string): string | undefined {
  return resolveRepoToplevelDetailed(dir).top;
}

/** True when `dir` is itself the toplevel of a git repository or worktree. */
export function isRepoToplevel(dir: string): boolean {
  const top = resolveRepoToplevel(dir);
  return top !== undefined && top === safeRealpath(dir);
}

/**
 * Resolve the project root for `startDir`, reporting where the answer came from.
 *
 * The marker walk is bounded twice over: it stops once it has passed the
 * repository toplevel, and it refuses `os.homedir()` outright. The home
 * exclusion is not redundant with the boundary — a caller outside any
 * repository has no toplevel to stop at, and would otherwise still climb into
 * `~/.agenfk`.
 */
export function resolveProjectRoot(
  startDir: string,
  opts: ResolveProjectRootOptions = {},
): ProjectRootResult {
  if (opts.envRoot) {
    return { root: opts.envRoot, source: "env" };
  }
  if (opts.dbPath) {
    return { root: path.dirname(path.dirname(opts.dbPath)), source: "db-path" };
  }

  const home = safeRealpath(os.homedir());
  const toplevel = resolveRepoToplevel(startDir);

  let currentDir = path.resolve(startDir);
  while (currentDir !== path.parse(currentDir).root) {
    const resolved = safeRealpath(currentDir);
    // The framework's own `~/.agenfk` config directory is not a project marker.
    if (resolved !== home && fs.existsSync(path.join(currentDir, ".agenfk"))) {
      return { root: resolved, source: "marker" };
    }
    // Stop at the repository boundary: an ancestor above the toplevel belongs
    // to a different project, or to no project at all.
    if (toplevel !== undefined && resolved === toplevel) break;
    currentDir = path.dirname(currentDir);
  }

  // The home exclusion has to cover this branch too, not just the marker walk:
  // when the user's home directory *is* a git repository — a dotfiles repo, the
  // exact setup this whole fix exists for — its toplevel is `$HOME`, and
  // returning it would send `verifyCommand` there all the same.
  if (toplevel !== undefined && toplevel !== home) {
    return { root: toplevel, source: "git-toplevel" };
  }
  // Every branch returns a canonical absolute path. A relative `cwd` in the
  // validate body would otherwise be persisted as a relative `projectRoot` and
  // later resolved against the daemon's own directory.
  return { root: safeRealpath(startDir), source: "fallback" };
}

/**
 * {@link resolveProjectRoot} without the provenance — the shape the existing
 * call sites already expect.
 */
export function findProjectRoot(
  startDir: string,
  opts: ResolveProjectRootOptions = {},
): string {
  return resolveProjectRoot(startDir, opts).root;
}
