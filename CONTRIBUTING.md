# Contributing to AgEnFK

Thank you for your interest in contributing to AgEnFK!

## Development Setup

**Requirements:** Node.js 18+, git, npm

```bash
git clone https://github.com/cglab-public/agenfk.git
cd agenfk
npm install
npm run build
npm test
```

## Project Structure

AgEnFK is a TypeScript monorepo with npm workspaces:

| Package | Description |
|---|---|
| `packages/core` | Shared types, interfaces, lifecycle logic |
| `packages/cli` | `agenfk` CLI binary |
| `packages/server` | Express API + WebSocket server + MCP server |
| `packages/storage-json` | JSON persistence layer |
| `packages/storage-sqlite` | SQLite persistence layer |
| `packages/ui` | React/Vite/Tailwind Kanban dashboard |
| `packages/create` | `npx` installer |

## Making Changes

1. Fork the repo and create a branch from `main`.
2. Make your changes and ensure tests pass: `npm run build && npm test`
3. Keep changes focused — one concern per PR.
4. Open a pull request against `main`.

## Commit Style

Use conventional commits:

```
feat: add X
fix: correct Y
chore: update Z
docs: improve README
```

Two commit forms exist in this repository, and only the first is yours to write:

- **Human and agent commits** use the conventional prefixes above.
- **Server auto-commits** are written by AgEnFK itself when an item reaches DONE,
  in the form `close(<type>): <title> [<id>]`. Do not reformat them and do not
  imitate the form by hand — it is how the audit trail distinguishes a verified
  workflow transition from an ordinary commit. They are **off by default**: a
  project opts in with `agenfk update-project <id> --auto-git-commit true`, and
  even then the server refuses to commit anywhere but a git toplevel.

Every functional change also updates `CHANGELOG.md` under `[Unreleased]`.

## Using AgEnFK to Build AgEnFK

AgEnFK uses itself for its own development workflow. If you have AgEnFK running locally, use it to track your work. If not, a standard PR workflow is fine.

## Reporting Issues

Use the GitHub issue tracker. Please include:
- AgEnFK version (`agenfk --version`)
- OS and Node.js version
- Steps to reproduce
- Expected vs actual behaviour

## Questions

Open a GitHub Discussion or an issue with the `question` label.
