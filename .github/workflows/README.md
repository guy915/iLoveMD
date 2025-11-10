# GitHub Actions CI/CD Workflows

This directory contains automated workflows for the AI-Doc-Prep project.

## Workflows Overview

### 1. CI/CD Pipeline (`ci.yml`)

Comprehensive continuous integration pipeline that runs on all pull requests and pushes to main/master branches.

**Jobs:**

1. **Security Audit**
   - Runs `npm audit` to check for vulnerabilities
   - Checks for outdated dependencies
   - Continues even if issues are found (informational)

2. **Code Quality**
   - Runs ESLint to enforce code standards
   - Checks for common code issues (console.log statements)
   - Analyzes bundle size and reports largest files
   - Must pass for PR to be mergeable

3. **Build (Node 18.x & 20.x)**
   - Tests build on multiple Node.js versions
   - Ensures production build succeeds
   - Verifies build artifacts are created
   - Uploads artifacts from Node 20.x for inspection

4. **Verify Build**
   - Downloads and verifies build artifacts
   - Ensures build output is valid
   - Runs only on pull requests

5. **CI Success**
   - Final status check
   - Reports results of all previous jobs
   - Blocks merge if critical checks fail

**Triggers:**
- All pull requests to any branch
- Pushes to `main` or `master` branches

**Duration:** ~3-5 minutes (with cache)

### 2. PR Labeler (`pr-labeler.yml`)

Automatically labels pull requests based on changed files and PR size.

**Features:**
- Adds category labels based on file patterns (documentation, dependencies, components, etc.)
- Adds size labels (XS, S, M, L, XL) based on lines changed
- Helps with PR organization and review prioritization

**Triggers:**
- When PR is opened
- When new commits are pushed to PR
- When PR is reopened

**Configuration:** See `.github/labeler.yml` for label rules

### 3. Stale Issues & PRs (`stale.yml`)

Automatically manages inactive issues and pull requests.

**Configuration:**
- Issues: Marked stale after 60 days, closed after 14 more days
- PRs: Marked stale after 30 days, closed after 7 more days
- Exempt labels: pinned, security, bug, help-wanted, work-in-progress, blocked

**Triggers:**
- Runs daily at midnight UTC
- Can be manually triggered via workflow dispatch

**Purpose:** Keeps repository clean and focused on active work

## Dependabot Configuration

Located at `.github/dependabot.yml`

**Features:**
- Checks for npm dependency updates weekly
- Checks for GitHub Actions updates weekly
- Groups minor and patch updates together
- Limits open PRs to prevent spam
- Automatic PR creation with proper labels

**Schedule:** Every Monday at 9:00 AM

## Label System

### Automatic Labels

**File-based:**
- `documentation` - Changes to .md files or docs/
- `dependencies` - Changes to package.json or package-lock.json
- `ci/cd` - Changes to .github/ directory
- `components` - Changes to src/components/
- `ui` - Changes to components, CSS, or Tailwind config
- `tools` - Changes to tool implementations
- `hooks` - Changes to custom React hooks
- `api` - Changes to API routes
- `configuration` - Changes to config files

**Size-based:**
- `size/XS` - Less than 10 lines changed
- `size/S` - 10-49 lines changed
- `size/M` - 50-199 lines changed
- `size/L` - 200-499 lines changed
- `size/XL` - 500+ lines changed

**Manual labels:**
- `pinned` - Prevent from being marked stale
- `security` - Security-related issues
- `bug` - Bug reports
- `help-wanted` - Looking for contributors
- `work-in-progress` - PR still being worked on
- `blocked` - Blocked by external factors

## Caching Strategy

All workflows use npm caching to speed up dependency installation:
- First run: ~2-3 minutes to install dependencies
- Cached runs: ~30-60 seconds to restore and verify cache
- Cache is automatically invalidated when package-lock.json changes

## Artifact Retention

Build artifacts are kept for 7 days and include:
- `.next/` directory (production build)
- `package.json` and `package-lock.json`

Useful for debugging build issues and verifying production output.

## Status Checks

The following checks are required to pass before merging:

**Required:**
- Code Quality (ESLint must pass)
- Build on Node 18.x (must succeed)
- Build on Node 20.x (must succeed)
- Verify Build (must succeed on PRs)

**Optional (informational):**
- Security Audit (provides warnings but doesn't block)

## Monitoring CI/CD

### View Workflow Runs
1. Go to the "Actions" tab in GitHub
2. Select a workflow from the left sidebar
3. Click on a specific run to see details

### Check PR Status
- PR page shows status checks at the bottom
- Green checkmark = passed
- Red X = failed (click "Details" to see logs)
- Yellow circle = running

### Debug Failed Builds
1. Click "Details" next to failed check
2. Expand failed job to see error logs
3. Common issues:
   - ESLint errors: Fix code style issues
   - Build errors: Check for syntax errors or missing dependencies
   - Security issues: Update vulnerable dependencies

## Best Practices

### For Contributors

1. **Before creating PR:**
   - Run `npm run lint` locally
   - Run `npm run build` locally
   - Fix any errors before pushing

2. **During PR review:**
   - Check CI status and fix failures promptly
   - Review automated labels for accuracy
   - Address security warnings if any

3. **Keep PRs active:**
   - Respond to review comments within 30 days
   - Update PR if marked as stale
   - Close PR if no longer needed

### For Maintainers

1. **Merging PRs:**
   - Ensure all required checks pass
   - Review security audit results
   - Check bundle size changes

2. **Managing dependencies:**
   - Review Dependabot PRs weekly
   - Test automated updates before merging
   - Group related updates when possible

3. **Workflow maintenance:**
   - Update workflow files as needed
   - Keep GitHub Actions updated
   - Adjust stale timeframes based on project activity

## Troubleshooting

### Workflow not running?
- Ensure workflow file is in main/master branch
- Check workflow triggers match your event (push, PR, etc.)
- Verify you have necessary permissions

### Build failing randomly?
- Check if dependencies need updating
- Verify npm cache isn't corrupted (re-run workflow)
- Review recent changes to workflow files

### Labels not applying?
- Check `.github/labeler.yml` for correct patterns
- Ensure PR Labeler workflow has write permissions
- Manually add labels if automation fails

### Stale bot too aggressive?
- Adjust days-before-stale values in stale.yml
- Add exempt-labels to protect certain items
- Disable stale workflow temporarily if needed

## Performance Optimization

Current optimizations:
- Parallel job execution where possible
- npm package caching
- Concurrency limits (cancel old runs)
- Artifact compression
- Conditional job execution

Typical run times:
- Security: ~1 minute
- Code Quality: ~2 minutes
- Build (per version): ~1.5 minutes
- Verify: ~30 seconds
- **Total: ~4-5 minutes** (with caching)

## Future Enhancements

Potential additions:
- Visual regression testing (Percy, Chromatic)
- Performance testing (Lighthouse CI)
- E2E testing (Playwright, Cypress)
- Code coverage reporting
- Automated changelog generation
- Semantic release automation
- Deploy previews (Vercel integration)

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Dependabot Configuration](https://docs.github.com/en/code-security/dependabot)
- [Next.js CI/CD Best Practices](https://nextjs.org/docs/deployment)
- [Semantic Versioning](https://semver.org/)

---

**Last Updated:** 2025-11-10
**Maintained by:** @guy915
