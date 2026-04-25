# .claude/

This directory contains [Claude Code](https://claude.com/claude-code) configuration for developer automation. It is **optional** — you do not need Claude Code to build, test, or contribute to SupaProxy.

## What's in here

- **skills/** — Automation scripts for common dev tasks (code auditing, refactoring, scaffolding). Run via `/skill-name` in Claude Code.
- **hooks/** — Pre-commit checks that block hardcoded URLs, provider leaks, and committed secrets.
- **settings.json** — Claude Code project settings (permissions, env vars).

## Can I delete this?

Yes. Nothing in this directory affects the build, tests, or runtime behavior of SupaProxy. It only enhances the experience if you use Claude Code as your editor.
