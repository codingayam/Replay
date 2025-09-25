# Coding Conventions
- Language/style: TypeScript throughout the React client, modern ES modules on server; 2-space indentation.
- React: Functional components with hooks, PascalCase filenames for components, `useX.ts` hooks, camelCase utilities.
- Organization: Colocate logic within `client/src/{components,pages,contexts,hooks,utils}`; keep files focused and cohesive.
- Testing: Prefer colocated `*.test.ts(x)` or files under `src/__tests__/` using Jest + Testing Library; add regression tests for fixes.
- Linting: ESLint config at `client/eslint.config.js`; resolve warnings before PRs. Avoid introducing non-ASCII characters unless necessary.