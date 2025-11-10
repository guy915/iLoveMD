# GitHub Actions CI/CD Workflows

This directory contains automated workflows for the AI-Doc-Prep project, optimized for speed.

## Workflows Overview

### 1. CI/CD Pipeline (`ci.yml`)

Fast continuous integration pipeline optimized to run in under 30 seconds (with cache).

**Jobs:**

**Main CI Check (Required)**
- Checkout code
- Setup Node.js 20.x with npm caching
- Install dependencies with `--prefer-offline --no-audit`
- Run ESLint
- Run security audit (non-blocking, informational only)
- Build project
- Verify build artifacts
- Upload artifacts (PRs only, 3-day retention)

**Extended Analysis (Optional, Parallel)**
- Runs only on PRs
- Checks for console.log statements
- Checks for TODO comments
- Analyzes bundle size
- Does NOT block merge if it fails

**Triggers:**
- All pull requests to any branch
- Pushes to `main` or `master` branches

**Duration:**
- First run: ~45-60 seconds (no cache)
- Cached runs: ~20-30 seconds
- Target: Sub-30 seconds with cache

**Key Optimizations:**
- Single job instead of multiple sequential jobs
- Only tests on Node 20.x (latest LTS)
- Uses `--prefer-offline` and `--no-audit` for faster npm ci
- Security audit is non-blocking
- Extended checks run in parallel
- Aggressive npm caching

### 2. PR Labeler (`pr-labeler.yml`)

Automatically labels pull requests based on changed files and PR size.

**Features:**
- Adds category labels based on file patterns
- Adds size labels (XS, S, M, L, XL)
- Helps with PR organization

**Triggers:**
- When PR is opened
- When new commits are pushed
- When PR is reopened

**Duration:** ~5-10 seconds

### 3. Stale Issues & PRs (`stale.yml`)

Automatically manages inactive issues and pull requests.

**Configuration:**
- Issues: Stale after 60 days, closed after 14 more
- PRs: Stale after 30 days, closed after 7 more
- Exempt labels: pinned, security, bug, help-wanted, work-in-progress, blocked

**Triggers:**
- Daily at midnight UTC
- Manual trigger via workflow dispatch

**Duration:** ~10-30 seconds (depending on repo size)

## Dependabot Configuration

Located at `.github/dependabot.yml`

**Features:**
- Weekly npm dependency checks
- Weekly GitHub Actions updates
- Groups minor/patch updates
- Automatic PR creation
- Limits: 5 npm PRs, 3 Actions PRs

**Schedule:** Every Monday at 9:00 AM

## Label System

### Automatic Labels

**File-based:**
- `documentation` - Changes to .md files
- `dependencies` - Changes to package files
- `ci/cd` - Changes to .github/
- `components` - Changes to src/components/
- `ui` - Changes to UI files
- `tools` - Changes to tool implementations
- `hooks` - Changes to React hooks
- `api` - Changes to API routes
- `configuration` - Changes to config files

**Size-based:**
- `size/XS` - Less than 10 lines
- `size/S` - 10-49 lines
- `size/M` - 50-199 lines
- `size/L` - 200-499 lines
- `size/XL` - 500+ lines

**Manual labels:**
- `pinned` - Never marked stale
- `security` - Security issues
- `bug` - Bug reports
- `help-wanted` - Looking for contributors
- `work-in-progress` - WIP PRs
- `blocked` - Blocked by dependencies

## Caching Strategy

Aggressive caching for maximum speed:

**npm cache:**
- Managed by `actions/setup-node@v4`
- Keyed by `package-lock.json` hash
- Automatically restored on cache hit
- First run: Downloads all dependencies
- Cached runs: Only validates cache

**Additional optimizations:**
- `--prefer-offline`: Use cache even if not expired
- `--no-audit`: Skip security audit during install
- Separate security audit step (non-blocking)

## Status Checks

**Required (blocks merge):**
- CI Check must pass (lint + build)

**Optional (informational):**
- Extended Analysis (doesn't block)
- Security audit (warnings only)

## Performance Metrics

**Target times:**
- Main CI: 20-30 seconds (with cache)
- Extended checks: 30-45 seconds (parallel, doesn't block)
- PR Labeler: 5-10 seconds
- Stale management: 10-30 seconds

**Breakdown (cached run):**
- Checkout: ~2 seconds
- Setup Node + restore cache: ~5 seconds
- npm ci (with cache): ~8 seconds
- Lint: ~2 seconds
- Build: ~8 seconds
- Verify + upload: ~3 seconds
- **Total: ~28 seconds**

## Best Practices

### For Contributors

1. **Before creating PR:**
   - Run `npm run lint` locally
   - Run `npm run build` locally
   - Fix errors before pushing

2. **During PR review:**
   - CI should pass in under 30 seconds (after first run)
   - If CI fails, check logs and fix promptly
   - Extended checks are optional

3. **Keep PRs active:**
   - Respond within 30 days
   - Update if marked stale

### For Maintainers

1. **Merging PRs:**
   - Wait for required CI check to pass
   - Review extended analysis warnings
   - Check security audit results

2. **Managing dependencies:**
   - Review Dependabot PRs weekly
   - Test before merging
   - Group related updates

3. **Monitoring performance:**
   - Check workflow run times
   - Optimize if consistently over 30 seconds
   - Clear cache if corrupted

## Troubleshooting

### CI taking too long?
- First run without cache: 45-60 seconds (normal)
- With cache: Should be under 30 seconds
- If consistently slow: Check for large dependencies or network issues
- Try re-running workflow to rebuild cache

### Build failing?
- Check ESLint errors first
- Then check build errors
- Run same commands locally
- Ensure dependencies are up to date

### Cache issues?
- Cache automatically refreshes when package-lock.json changes
- If corrupted: Close and re-open PR to trigger fresh run
- Cache expires after 7 days of no use

### Labels not applying?
- Check `.github/labeler.yml` patterns
- Ensure workflow has write permissions
- Manually add if automation fails

## Why This Design?

**Speed is the priority:**
- Single job eliminates inter-job delays
- Only one Node version (20.x is latest LTS)
- Parallel optional checks don't block merge
- Aggressive caching strategies
- Minimal artifact retention (3 days)

**Trade-offs:**
- Don't test on Node 18.x (if needed, add matrix back)
- Extended analysis is optional (doesn't block PRs)
- Security audit is informational only
- Shorter artifact retention

**Benefits:**
- Sub-30 second CI checks
- Fast feedback for developers
- Reduced GitHub Actions minutes
- Better developer experience

## Future Enhancements

Consider adding (with performance impact):
- E2E testing (adds ~60-90 seconds)
- Visual regression testing (adds ~30-45 seconds)
- Code coverage (adds ~15-30 seconds)
- Deploy previews (separate workflow)

If adding features, consider:
- Keep them optional (non-blocking)
- Run in parallel where possible
- Use separate workflows for slow checks
- Maintain <30 second core CI time

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [actions/setup-node caching](https://github.com/actions/setup-node#caching-global-packages-data)
- [npm ci flags](https://docs.npmjs.com/cli/v10/commands/npm-ci)
- [Optimizing GitHub Actions](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows)

---

**Last Updated:** 2025-11-10
**Performance Target:** Sub-30 seconds with cache
**Maintained by:** @guy915
