# Group 01 — Monorepo & Shared Module (@replay/shared)

Effort: L

Overview
- Establish a monorepo with workspaces and create a shared TypeScript package (`@replay/shared`) to maximize code reuse across web and iOS (RN).
- Extract types, API client, validators, non-UI utils, and DOM-free hooks/contexts from `client/` into the shared module.
- Provide build, lint, and test pipelines for the shared package to enable fast feedback while mobile work progresses in parallel.

Deliverables
- Monorepo workspace config (npm/yarn/pnpm) with `packages/shared`, existing `client/` and `server/` kept working.
- `packages/shared` with folders: `src/types`, `src/api`, `src/utils`, `src/validation`, `src/hooks`.
- Build setup (`tsc` or `tsup`) producing CJS + ESM outputs, and type declarations.
- Jest/Vitest unit tests for shared code and CI job executing them.
- Published/linked package resolution from both web and mobile apps.

Tasks
- Workspace setup
  - Convert repo to a workspace monorepo (root `package.json` workspaces; keep existing scripts unaffected).
  - Add root `tsconfig.base.json` and references; enable path aliases where helpful.
  - Ensure `client/` and `server/` continue to run via existing commands.
- Shared package scaffolding
  - Create `packages/shared/{package.json,tsconfig.json}`; mark `"type": "module"` and proper `exports` map for ESM/CJS.
  - Add build scripts: `build`, `clean`, `typecheck`; configure `tsup` or `tsc -b`.
- Code extraction
  - Move reusable items from `client/src/types.ts*` → `packages/shared/src/types/`.
  - Move API client and endpoint helpers from `client/src/utils/api.ts*` → `packages/shared/src/api/` (support env-specific base URLs).
  - Move general-purpose utils from `client/src/utils/*` → `packages/shared/src/utils/` (date/category/text helpers, etc.).
  - Extract DOM-free hooks/contexts logic to `packages/shared/src/hooks/` or `src/contexts/` as appropriate.
  - Leave UI components and DOM-specific logic in `client/`.
- Testing & linting
  - Configure Jest (or Vitest) for `packages/shared` with `ts-jest`/`esbuild-jest`.
  - Add unit tests for api/utils/validation and type-level tests where useful.
  - Ensure `npm test -w packages/shared` runs locally and in CI.
- Consumption
  - Update `client/` imports to use `@replay/shared` where appropriate.
  - Draft usage docs for `mobile/` to consume `@replay/shared` once created.

Acceptance Criteria
- `packages/shared` builds to `dist/` with ESM + CJS + types.
- Unit tests pass locally and in CI; coverage collected for shared.
- `client/` compiles and runs without regressions using the shared package.
- A sample RN app (placeholder) can import at least one function/type from `@replay/shared`.

Dependencies
- None. This is foundational; it unblocks Groups 02, 04, 05, 06, 07, 08, 09, 10, 11.

External Dependencies / Blockers
- None beyond Node.js and TypeScript toolchain.

Integration Points
- Web (`client/`) and mobile (`mobile/`) import shared types, utils, API client.

Notes
- Keep APIs DOM-agnostic. Avoid any `window`/`document` assumptions in shared code.

