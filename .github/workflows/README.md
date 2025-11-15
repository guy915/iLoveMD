# GitHub Actions CI/CD Workflows

This directory contains automated workflows for the iLoveLLM project, optimized for comprehensive checks with maximum speed through parallelization.

## Workflows Overview

### 1. CI/CD Pipeline (`ci.yml`)

Comprehensive CI pipeline that runs all checks in parallel, completing in ~35-40 seconds (with cache).

**Architecture: Maximum Parallelization**

The pipeline runs 4 independent jobs simultaneously, then sequentially runs verification and status checks.

**Parallel Jobs (all run at the same time):**

1. **Build on Node 20.x** (~27 seconds)
   - Checkout code
   - Setup Node.js 20.x with npm caching
   - Install dependencies with `--prefer-offline --no-audit`
   - Run ESLint
   - Build project
   - Verify build output
   - Upload artifacts

2. **Build on Node 18.x** (~27 seconds)
   - Same as Node 20.x
   - Ensures compatibility with Node 18.x LTS
   - No artifacts uploaded (Node 20.x is primary)

3. **Security Audit** (~15-20 seconds)
   - npm audit (blocks on moderate+ vulnerabilities)
   - Check for outdated dependencies (informational)
   - Runs independently, doesn't need full build

4. **Code Quality** (~28-30 seconds)
   - Check for console.log statements (blocks if found)
   - Check for TODO comments (informational)
   - Build project for bundle size analysis
   - Report largest JavaScript files

**Sequential Jobs (run after parallel jobs):**

5. **Verify Build Artifacts** (~5 seconds)
   - Waits for both build jobs to complete
   - Downloads Node 20.x artifacts
   - Verifies artifact integrity
   - Reports size and file count

6. **All Checks Passed** (~2 seconds)
   - Waits for all jobs to complete
   - Reports comprehensive status
   - Fails if any required check failed

**Triggers:**
- All pull requests to any branch
- Pushes to `main` or `master` branches

**Duration:**
- Parallel phase: ~28-30 seconds (slowest job wins)
- Sequential phase: ~7 seconds (verify + status)
- **Total: ~35-40 seconds** (with cache)
- First run (no cache): ~60-75 seconds

**All Checks Are Required:**
- Build must pass on Node 18.x AND 20.x
- ESLint must pass
- Security audit must pass (no moderate+ vulnerabilities)
- No console.log statements allowed
- Build artifacts must verify successfully

### 2. PR Labeler (`pr-labeler.yml`)

Automatically labels pull requests based on changed files and PR size.

**Features:**
- Adds category labels based on file patterns
- Adds size labels (XS, S, M, L, XL)
- Helps with PR organization

**Duration:** ~5-10 seconds

### 3. Stale Issues & PRs (`stale.yml`)

Automatically manages inactive issues and pull requests.

**Configuration:**
- Issues: Stale after 60 days, closed after 14 more
- PRs: Stale after 30 days, closed after 7 more
- Exempt labels: pinned, security, bug, help-wanted, work-in-progress, blocked

**Duration:** ~10-30 seconds

## Dependabot Configuration

Located at `.github/dependabot.yml`

**Features:**
- Weekly npm dependency checks
- Weekly GitHub Actions updates
- Groups minor/patch updates
- Automatic PR creation

## Performance Metrics

**Target: Sub-40 seconds with full coverage**

**Breakdown (with cache):**

Parallel phase (all at once):
- Build Node 20.x: ~27s (checkout 2s + setup 5s + install 8s + lint 2s + build 8s + verify 2s)
- Build Node 18.x: ~27s (same as above)
- Security: ~18s (checkout 2s + setup 5s + install 8s + audit 3s)
- Code Quality: ~28s (checkout 2s + setup 5s + install 8s + checks 3s + build 8s)

Slowest parallel job: ~28 seconds

Sequential phase:
- Verify artifacts: ~5s (download 3s + verify 2s)
- Status check: ~2s (echo results)

**Total: ~35 seconds**

## Why This Design?

**Maximum Parallelization:**
- 4 independent jobs run simultaneously
- Total time = slowest job (~28s) + sequential steps (~7s)
- No job waits for another unnecessarily
- GitHub Actions runners handle parallel jobs efficiently

**Comprehensive Coverage:**
- Tests on Node 18.x AND 20.x
- Security audit blocks on vulnerabilities
- Code quality checks are mandatory
- Build artifacts are verified
- No compromises on quality

**Speed Optimizations:**
- Aggressive npm caching
- `--prefer-offline` and `--no-audit` flags
- Only Node 20.x uploads artifacts
- Minimal but thorough verification
- Short artifact retention (3 days)

## Status Checks

**All checks are required and block merge:**
- ✅ Build (Node 20.x)
- ✅ Build (Node 18.x)
- ✅ Security Audit
- ✅ Code Quality
- ✅ Verify Build Artifacts
- ✅ All Checks Passed

## Caching Strategy

Aggressive caching for maximum speed:

**npm cache:**
- Managed by `actions/setup-node@v4`
- Keyed by `package-lock.json` hash
- Shared across all jobs
- First run: Downloads dependencies (~30-40s per job)
- Cached runs: Validates cache only (~8s per job)

**Additional optimizations:**
- `--prefer-offline`: Use cache aggressively
- `--no-audit`: Skip audit during install (separate audit job)
- Parallel jobs share cache warmup

## Best Practices

### For Contributors

1. **Before creating PR:**
   - Run `npm run lint` locally
   - Run `npm run build` locally
   - Remove any console.log statements
   - Fix errors before pushing

2. **During PR review:**
   - CI should complete in ~35-40 seconds (after first run)
   - All checks must pass to merge
   - Check the status of each job
   - Fix failures promptly

3. **Common failures:**
   - ESLint errors: Check both Node 18.x and 20.x builds
   - console.log found: Remove debugging statements
   - Security vulnerabilities: Update dependencies
   - Build errors: Test locally first

### For Maintainers

1. **Merging PRs:**
   - All 6 jobs must pass (no exceptions)
   - Review security audit results
   - Check bundle size changes
   - Verify both Node versions pass

2. **Monitoring performance:**
   - Check workflow run times
   - Should stay under 45 seconds
   - If slower: Check for cache issues or large dependencies
   - First run on PR is always slower (no cache)

3. **Managing dependencies:**
   - Review Dependabot PRs weekly
   - Security updates are blocked by CI if vulnerable
   - Test before merging

## Troubleshooting

### CI taking too long?
- First run: 60-75 seconds (normal, no cache)
- Cached runs: Should be 35-40 seconds
- If consistently slow: Check for network issues or large dependencies
- All 4 parallel jobs should start immediately

### Which job failed?
- Check the "All Checks Passed" job for summary
- Each job reports its own status
- Click "Details" on failed job to see logs
- Common culprits:
  - Node 18.x compatibility issues
  - console.log statements
  - Security vulnerabilities

### Cache not working?
- Cache is automatically refreshed when package-lock.json changes
- Cache expires after 7 days of no use
- If corrupted: Re-run workflow
- Each job gets its own cache restore

### Why test on both Node versions?
- Node 18.x: Current LTS (active until April 2025)
- Node 20.x: Active LTS (primary target)
- Ensures compatibility across supported versions
- Catches version-specific issues early

## Comparison: Before vs After

**Sequential (original):**
- 5 jobs running one after another
- Each job waits for previous to complete
- Total time: Sum of all jobs (~4-5 minutes)
- Inter-job delays add overhead

**Parallel (current):**
- 4 jobs running simultaneously
- Only verification waits for builds
- Total time: Slowest job + verification (~35-40 seconds)
- 85% faster with full coverage

**Coverage comparison:**
- ✅ Multi-version testing (both have it)
- ✅ Security audit (both have it)
- ✅ Code quality checks (both have it)
- ✅ Build verification (both have it)
- ✅ Blocking on failures (both have it)
- **Speed: 5 minutes → 35 seconds**

## Label System

### Automatic Labels

**File-based:**
- `documentation` - .md files
- `dependencies` - package files
- `ci/cd` - .github/ files
- `components` - src/components/
- `ui` - UI files
- `tools` - Tool implementations
- `hooks` - React hooks
- `api` - API routes
- `configuration` - Config files

**Size-based:**
- `size/XS` - <10 lines
- `size/S` - 10-49 lines
- `size/M` - 50-199 lines
- `size/L` - 200-499 lines
- `size/XL` - 500+ lines

## Future Enhancements

Potential additions (each would run in parallel):
- E2E testing job (~60-90 seconds)
- Visual regression testing (~30-45 seconds)
- Code coverage job (~20-30 seconds)
- Deploy preview (separate workflow)

**Note:** Total time remains = slowest job time

## Resources

- [GitHub Actions Parallel Jobs](https://docs.github.com/en/actions/using-jobs/using-jobs-in-a-workflow)
- [actions/setup-node caching](https://github.com/actions/setup-node#caching-global-packages-data)
- [npm ci optimization](https://docs.npmjs.com/cli/v10/commands/npm-ci)
- [Workflow visualization](https://docs.github.com/en/actions/monitoring-and-troubleshooting-workflows/using-the-visualization-graph)

---

**Last Updated:** 2025-11-10
**Performance Target:** Sub-40 seconds with full coverage
**Architecture:** Maximum parallelization
**Maintained by:** @guy915
