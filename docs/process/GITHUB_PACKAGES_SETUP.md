# GitHub Packages Setup Guide

Complete guide for publishing and consuming GitHub Packages in the @finografic ecosystem.

> **Note:** This guide documents the EXACT steps needed. GitHub's official docs and AI assistants often provide incomplete or incorrect instructions.

---

## Part 1: Publishing a Package to GitHub Packages

### Overview

Publishing to GitHub Packages requires:

1. Repository permissions configured
2. Personal Access Token (PAT) created
3. Local `.npmrc` configured
4. `package.json` publishConfig set
5. GitHub Actions workflow configured

---

### Step 1: Repository Settings

#### Actions Permissions

Go to: `https://github.com/finografic/{repo}/settings/actions`

**Required Settings:**

1. ✅ **Allow all actions and reusable workflows** (selected)
2. ✅ **Workflow permissions:**
   - Read and write permissions (selected)
   - Allow GitHub Actions to create and approve pull requests (checked)

These permissions allow the workflow to:

- Publish packages
- Create releases
- Read/write repository contents

---

### Step 2: Personal Access Token (PAT)

**Where to Create:**

1. Go to: <https://github.com/settings/tokens>
2. Click "Generate new token" → "Tokens (classic)"
3. Give it a descriptive name (e.g., "NPM Package Publishing")
4. Set expiration: **No expiration** (for persistent CI use)
5. Select scopes:
   - ✅ `repo` (Full control of private repositories)
   - ✅ `write:packages` (Upload packages to GitHub Package Registry)
   - ✅ `read:packages` (Download packages from GitHub Package Registry)
   - ✅ `workflow` (Update GitHub Action workflows)

**Important Notes:**

- ⚠️ GitHub **does NOT allow** `GITHUB_` prefix for custom secrets
- ✅ Name it `NPM_TOKEN` (not `GITHUB_TOKEN`)
- 💾 Save the token immediately - you can't see it again!

**Token Storage:**

1. Copy the generated token
2. Go to your repository: `https://github.com/finografic/{repo}/settings/secrets/actions`
3. Click "New repository secret"
4. Name: `NPM_TOKEN`
5. Value: Paste your token
6. Click "Add secret"

---

### Step 3: Local `.npmrc` Configuration

Create `.npmrc` in your home directory (`~/.npmrc`) for global auth:

```ini
@finografic:registry=https://npm.pkg.github.com
```

**For Local Development:**

Set environment variable:

```bash
export NPM_TOKEN=ghp_your_token_here
```

Add to your shell profile (`~/.zshrc` or `~/.bashrc`):

```bash
export NPM_TOKEN="ghp_your_token_here"
```

**Important:**

- ⚠️ **Never commit `.npmrc` with actual tokens** to git
- ✅ Token is provided via `NODE_AUTH_TOKEN` environment variable in CI/CD
- ✅ For local dev, export `NPM_TOKEN` in your shell
- ❌ **Do NOT add** `//npm.pkg.github.com/:_authToken=${NPM_TOKEN}` - causes GitHub build failures!

---

### Step 4: `package.json` Configuration

Required fields:

```json
{
  "name": "@finografic/package-name",
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/finografic/package-name.git"
  }
}
```

---

### Step 5: GitHub Actions Workflow

See `.github/workflows/release.yml`:

**Critical Configuration:**

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

# CRITICAL: These exact three permissions are required!
permissions:
  contents: write # Create releases
  packages: write # Publish packages
  actions: write # Update workflows

jobs:
  publish:
    runs-on: ubuntu-latest

    steps:
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          registry-url: https://npm.pkg.github.com
          scope: '@finografic'

      # CRITICAL: Use NPM_TOKEN for installing (if consuming other @finografic packages)
      - name: Install deps
        run: pnpm install --frozen-lockfile
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      # CRITICAL: Use NPM_TOKEN for publishing
      - name: Publish package
        run: pnpm publish --no-git-checks
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Secrets Required:**

- ✅ `NPM_TOKEN` - Your Personal Access Token (set in repository secrets)
- ❌ **NOT** `GITHUB_TOKEN` - This is unreliable and often fails

**Why NPM_TOKEN in Install Step?**

Include `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` in the install step even if you don't currently consume other @finografic packages. This ensures:

- Future-proof if you add dependencies later
- Consistent setup across all @finografic packages
- No errors if dependencies are added

---

### Step 6: Test the Release

```bash
pnpm release:github:patch
```

**Verify:**

1. [ ] Workflow runs successfully
2. [ ] Package appears in Packages tab
3. [ ] GitHub Release created

---

## Part 2: Consuming a GitHub Package

### Overview

To install a package from GitHub Packages in another project.

---

### Step 1: Authentication Setup

#### Recommended: User-level `.npmrc`

Create `~/.npmrc` (global) for all projects:

```ini
@finografic:registry=https://npm.pkg.github.com
```

Then set your environment variable:

```bash
# In ~/.zshrc or ~/.bashrc
export NPM_TOKEN="ghp_your_token_here"
```

Reload your shell:

```bash
source ~/.zshrc  # or source ~/.bashrc
```

#### Alternative: Project-level `.npmrc`

Create `.npmrc` in project root:

```ini
@finografic:registry=https://npm.pkg.github.com
```

**Security Best Practices:**

- ✅ Always use `NODE_AUTH_TOKEN` in CI/CD workflows
- ✅ Export `NPM_TOKEN` in your local shell environment
- ✅ Never commit actual tokens to git
- ✅ Use user-level `~/.npmrc` to avoid accidental commits
- ❌ **Do NOT add** `//npm.pkg.github.com/:_authToken=${NPM_TOKEN}` line - causes failures!

---

### Step 2: Install the Package

```bash
pnpm add @finografic/core
```

**Common Issues:**

- 404 errors → Check `.npmrc` registry configuration
- Auth failures → Verify `NPM_TOKEN` is set correctly
- Package not found → Ensure package was published successfully

---

### Step 3: Using the Package

```typescript
import { something } from '@finografic/core';
```

---

## Part 3: Common Issues & Solutions

### Issue: 404 Not Found

**Cause:**

- Package hasn't been published yet
- Wrong registry in `.npmrc`
- Package name mismatch in scope

**Solution:**

1. Verify package exists: `https://github.com/finografic/{package-name}/packages`
2. Check `.npmrc` has correct registry:

   ```ini
   @finografic:registry=https://npm.pkg.github.com
   ```

3. Verify package name in `package.json` matches exactly

---

### Issue: Unauthorized / 401

**Cause:**

- `NPM_TOKEN` not set or expired
- `.npmrc` not configured
- Token doesn't have required scopes

**Solution:**

1. Verify token is set:

   ```bash
   echo $NPM_TOKEN
   ```

2. Check `.npmrc` exists and has correct format
3. Regenerate token with correct scopes (see Step 2)
4. Update repository secret with new token

---

### Issue: Package Not Found in Registry

**Cause:**

- Using npm registry instead of GitHub Packages registry
- Scope not configured in `.npmrc`

**Solution:**

Ensure `.npmrc` specifies GitHub Packages for @finografic scope:

```ini
@finografic:registry=https://npm.pkg.github.com
```

Without this, pnpm/npm will look in npmjs.com (wrong registry)

---

## Part 4: Multi-Package Setup

For packages that depend on other @finografic packages:

### Example: @finografic/genx depends on @finografic/core

**In @finografic/genx:**

```json
{
  "dependencies": {
    "@finografic/core": "^0.7.12"
  }
}
```

**Requirements:**

1. ✅ Both packages published to GitHub Packages
2. ✅ Consumer package has `.npmrc` configured
3. ✅ `NPM_TOKEN` set in environment
4. ✅ Workflow uses `NODE_AUTH_TOKEN` in install step
5. ✅ Dependencies resolve from `@finografic` scope

**No special configuration needed!** If Steps 1-5 are complete, package dependencies work automatically.

---

## Testing Checklist

Before considering setup complete:

- [ ] Can publish package via workflow
- [ ] Package appears in GitHub Packages
- [ ] Can install package in another project
- [ ] Can import and use package
- [ ] Dependency resolution works for packages depending on other @finografic packages

---

## Reference Links

- GitHub Packages Docs: <https://docs.github.com/en/packages>
- npm Scopes: <https://docs.npmjs.com/cli/v8/using-npm/scope>
- GitHub Actions Permissions: <https://docs.github.com/en/actions/security-guides/automatic-token-authentication>

---

## Notes

### Things that GitHub Copilot/AI Got Wrong

- ❌ Suggested using `secrets.GITHUB_TOKEN` (unreliable, sometimes works, sometimes doesn't)
- ❌ Said you can use `GITHUB_` prefix for custom secrets (GitHub rejects this)
- ❌ Implied `GITHUB_TOKEN` is sufficient (it's not for publishing packages)
- ❌ Didn't mention `NODE_AUTH_TOKEN` needed in install step for consuming packages
- ❌ Suggested `read` permissions are enough (they're not - use `write` for all three)

### Hard-Won Lessons

1. **Always use `NPM_TOKEN`, never `GITHUB_TOKEN`** for package operations
2. **Permissions must be `write` not `read`** - "write" includes read access
3. **Three permissions required:** `contents: write`, `packages: write`, `actions: write`
4. **Token in both steps:** Install step (for consuming) and Publish step (for publishing)
5. **Environment variable required:** Local dev needs `export NPM_TOKEN="..."`
6. **User-level `.npmrc` is safest:** Prevents accidental token commits
7. **Workflow triggers on tag push:** Release workflow only runs when tags like `v*` are pushed
8. **Do NOT add auth token line to `.npmrc`:** The `//npm.pkg.github.com/:_authToken=` line causes GitHub build failures - rely on `NODE_AUTH_TOKEN` in workflows instead

### Related Documentation

- [Release Process](./RELEASES.md) - How to cut releases after setup is complete
- [Developer Workflow](./DEVELOPER_WORKFLOW.md) - Daily development and git workflow
