# Repository Guidelines

## Project Structure & Module Organization

This repository contains:

- `app/`: Next.js web/API application deployed to Cloudflare Workers with OpenNext. Routes are in `app/src/app`, UI in `app/src/components`, domain logic in modules such as `service.ts` and `library.ts`, and D1 migrations in `app/migrations`.
- `app/retention-worker/`: retention Queue consumer.
- `app/test/`: Vitest tests named `*.test.ts`.
- `minecraft/`: multi-version Fabric client mod. Shared code and language assets live in `common/`; version integrations live under `versions/`.

Keep cross-version behavior in `minecraft/common` unless it imports Minecraft classes.

## Build, Test, and Development Commands

Run web commands from `app/`:

- `npm run dev`: start the Next.js development server.
- `npm test`: run all Vitest tests once.
- `npm run typecheck` and `npm run typecheck:retention`: check TypeScript types.
- `npm run format` / `npm run format:check`: write or verify Prettier formatting.
- `npm run build:worker`: produce the OpenNext Worker bundle.
- `npm run d1:migrate:local`: apply D1 migrations locally.
- `npm run preview`: build and run the Worker locally with Wrangler.

Run `.\gradlew.bat build` from `minecraft/` to build every supported version. Use `:versions:mc1_21_11:build` for a targeted build. Automation agents must request approval before invoking the wrapper.

## Coding Style & Naming Conventions

Use Prettier for TypeScript, TSX, JSON, Markdown, and configuration files. TypeScript uses strict mode, two-space indentation, `camelCase` symbols, and `PascalCase` components/types. Keep both dictionaries in `src/i18n/messages.ts` aligned.

Java uses four-space indentation and package names under `moe.love.i`. Keep version-specific classes structurally aligned where practical.

## Testing Guidelines

Add focused Vitest tests under `app/test`. Before submitting, run tests, both type checks, `format:check`, and `build:worker`. Mod changes must build all targets; screenshot/Mixin changes also require an in-game F2 smoke test.

## Commit & Pull Request Guidelines

History uses short imperative subjects, often Conventional Commit prefixes such as `feat:` and `chore:`. Prefer `feat: add image filters` or `fix: preserve tag selection`. Keep commits scoped to one concern.

Pull requests should explain user-visible behavior, schema or configuration changes, and verification performed. Link relevant issues, include screenshots for UI changes, and call out required D1 migrations or Cloudflare binding changes.

## Security & Configuration

Never commit `.dev.vars`, Stripe secrets, tokens, or production data. Treat remote migrations and `npm run deploy` as explicit production operations. R2 lifecycle rules are managed outside this repository; application changes must preserve the `free/` and `plus/` key conventions.
