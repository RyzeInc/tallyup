# Repository Checks

This project uses a two-step approach to validate frontend (Next) and Convex server code.

Guiding principles
- Keep the Next.js frontend type-check fast by excluding `convex/` from the main `tsconfig`.
- Validate Convex server code with a focused TypeScript project and CI step.

Commands

- Dev (local):
  - Start Convex dev (regenerates `convex/_generated`):

    ```bash
    npx convex dev
    ```

  - Run frontend dev (separate terminal):

    ```bash
    npm run dev
    ```

- Quick local checks:
  - Run lint + Convex type-check:

    ```bash
    npm run check
    ```

  - Run only Convex type-check:

    ```bash
    npm run type:convex
    ```

CI

- The repository includes a GitHub Actions workflow at `.github/workflows/ci.yml` that:
  1. Installs dependencies
  2. Regenerates Convex generated client types (`npx convex generate`)
  3. Runs `npm run type:convex` (Convex TypeScript check)
  4. Runs `npm run lint`, `npm test`, and `npm run build`

Caching

- CI caches `/.convex-tsbuildinfo` (set in `convex/tsconfig.json`) to speed repeated Convex type-checks.
- Cache `node_modules` and `.next` in CI to speed frontend builds.

Notes

- `npx convex dev` is useful during development and will show runtime errors and regenerate typed client code.
- `npm run type:convex` is the authoritative TypeScript check for Convex server code and should run in CI.
