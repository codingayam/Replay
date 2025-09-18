# Repository Guidelines

## Project Structure & Module Organization
- `client/` React 19 + Vite app: `src/components/`, `src/pages/`, `src/contexts/`, `src/utils/`. Tests in `src/__tests__/`; E2E in `client/e2e/`.
- `server/` Express API: `server.js`, `middleware/`, runtime `logs/` and `temp/`. App data lives in `server/data/` (git-ignored).
- Config: `client/vite.config.ts`, `client/eslint.config.js`, `client/jest.config.js`, `nixpacks.toml`, `vercel.json`.

## Build, Test, and Development Commands
- Client dev: `cd client && npm run dev` (Vite at `http://localhost:5173`).
- Server dev: `cd server && npm run dev` (Nodemon on `http://localhost:3001`).
- Client build: `cd client && npm run build` or root `npm run build` (runs client build).
- Lint: `cd client && npm run lint`.
- Unit tests: `cd client && npm test` (Jest + Testing Library). Coverage: `npm run test:coverage`.
- E2E (optional): specs in `client/e2e/` (Playwright-style). Install Playwright before running.
- Deploy: root `npm run deploy` (Vercel).

## Coding Style & Naming Conventions
- TypeScript in client; ES modules everywhere. Indent 2 spaces.
- React: functional components with hooks; components in `PascalCase.tsx`; hooks `useX.ts`; utilities `camelCase.ts`.
- Keep files small and cohesive; colocate tests via `*.test.tsx` or under `__tests__`.
- Lint uses `client/eslint.config.js` (ESLint + TS + React hooks). Fix warnings before PR.

## Testing Guidelines
- Frameworks: Jest (`jsdom`) + @testing-library for unit/integration.
- Naming: `*.test.ts(x)`/`*.spec.ts(x)` or files in `src/__tests__/`.
- Aim to cover contexts, components with state, and critical utils; add regression tests for bug fixes.

## Commit & Pull Request Guidelines
- Commits: imperative, present tense; keep subjects concise. Common patterns in history: “Add…”, “Fix…”, “Implement…”, “Remove…”. Prefixes like `fix:` are acceptable but not required.
- PRs: clear description, linked issues, steps to verify locally, screenshots for UI, and notes on tests/coverage. Touch only related files.

## Security & Configuration Tips
- Do not commit secrets. Use `server/.env` (copy from `.env.example`): `GEMINI_API_KEY`, `OPENAI_API_KEY`, `PORT`.
- Node versions: root `"node": 22.x`; server supports `>=18`. Use a recent LTS.
- `server/data/`, media, and logs are ignored by git; keep them local.

## Agent-Specific Instructions
- Make minimal, focused changes; preserve structure and naming. Prefer adding tests alongside fixes. Avoid unrelated refactors and never commit credentials.
