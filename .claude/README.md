# .claude/

This directory contains [Claude Code](https://claude.com/claude-code) configuration for the SupaProxy engine. It is **optional** -- you do not need Claude Code to build, test, or contribute to SupaProxy.

## What's in here

- **skills/** -- Automation scripts for common server dev tasks: code auditing, route scaffolding, consumer setup, debugging. Run via `/skill-name` in Claude Code.
- **hooks/** -- Pre-commit checks that block hardcoded URLs, provider-specific token formats, and committed secrets in `.ts` files.
- **settings.json** -- Claude Code project settings (permissions, hook bindings).

## Can I delete this?

Yes. Nothing in this directory affects the build, tests, or runtime behavior of SupaProxy. It only enhances the developer experience if you use Claude Code as your editor.
