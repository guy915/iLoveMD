# GitHub Actions Workflows

## CI/CD Pipeline (`ci.yml`)

Runs on every pull request and on pushes to `main`. All jobs use Node 22 (the same version as Vercel).

| Job | What it checks |
| --- | --- |
| Build (Node 22.x) | `npm ci`, ESLint, unit tests (Vitest), production build, uploads `.next` |
| Security Audit | `npm audit --audit-level=high --omit=dev` (fails on high/critical advisories in production dependencies), `glob` version check, `npm outdated` (info only) |
| Code Quality | No `console.log` in source (blocking), TODO report and leaked-key check (info only), bundle size report |
| Test Coverage | `vitest run --coverage`, uploads the report |
| Verify Build Artifacts | Runs after the build job and checks the uploaded `.next` output |

## PR Labeler (`pr-labeler.yml`)

Labels pull requests by changed paths (see `.github/labeler.yml`) and by size (`size/XS` to `size/XL`).

## Stale Issues & PRs (`stale.yml`)

- Issues: stale after 60 days, closed 14 days later
- PRs: stale after 30 days, closed 7 days later
- Exempt labels: issues with pinned, security, bug, help-wanted; PRs with pinned, work-in-progress, blocked

## Dependabot (`../dependabot.yml`)

Weekly npm and GitHub Actions update PRs. Minor and patch updates are grouped into one PR per ecosystem.
