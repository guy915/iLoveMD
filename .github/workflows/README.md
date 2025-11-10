# GitHub Actions CI/CD Workflows

This directory contains automated workflows for the AI-Doc-Prep project.

## Workflows

### CI/CD Pipeline (`ci.yml`)

**Triggers:**
- All pull requests to any branch
- Pushes to `main` or `master` branches

**What it does:**
1. **Linting** - Runs ESLint to check code quality and style
2. **Build** - Builds the Next.js application to ensure no build errors
3. **Multi-version Testing** - Tests on Node.js 18.x and 20.x
4. **Artifact Upload** - Saves build artifacts for inspection

**Required Checks:**
- All linting must pass
- Build must complete successfully
- Tests run on both Node.js versions

**Status:**
- Pull requests cannot be merged until all checks pass
- Build artifacts are retained for 7 days

## How It Works

### For Pull Requests

1. When you open a PR, the workflow automatically starts
2. It checks out your code
3. Installs dependencies using `npm ci` (faster than `npm install`)
4. Runs `npm run lint` to check code style
5. Runs `npm run build` to ensure the app builds
6. Reports success/failure on the PR page

### Caching

The workflow uses npm caching to speed up dependency installation:
- First run: ~2-3 minutes
- Subsequent runs: ~1-2 minutes (with cache)

### Concurrency

Only one workflow runs per PR at a time. If you push new commits while a workflow is running, it will cancel the old run and start a new one.

## Adding More Checks

To add additional checks (tests, type checking, etc.):

1. Edit `.github/workflows/ci.yml`
2. Add new steps under the `steps:` section
3. Example:
   ```yaml
   - name: Run tests
     run: npm test
   ```

## Troubleshooting

**Workflow not running?**
- Check that the `.github/workflows/ci.yml` file is in the main branch
- Verify your PR is targeting the correct branch

**Build failing?**
- Check the workflow logs in the "Actions" tab on GitHub
- Fix any linting or build errors in your code
- Push the fixes - the workflow will run again automatically

**Need to skip CI?**
- Not recommended, but you can add `[skip ci]` to your commit message
- Only use this for documentation-only changes

## Status Badge

Add this to your README.md to show build status:

```markdown
![CI/CD Pipeline](https://github.com/YOUR_USERNAME/AI-Doc-Prep/workflows/CI%2FCD%20Pipeline/badge.svg)
```

Replace `YOUR_USERNAME` with your GitHub username.
