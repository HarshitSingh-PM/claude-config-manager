# Publishing checklist (maintainer-only)

Step-by-step for shipping a new release. Skip steps that don't apply.

## First time only

1. **Confirm the package name is available on npm.** (We chose `claude-config-ui` because the bare `claude-config-manager` was taken.)
   ```bash
   npm view claude-config-ui
   ```
   If you see "404 Not Found" — you're clear.

2. **Create an npm account** at https://www.npmjs.com/signup if you don't have one.

3. **Log in once on this machine.**
   ```bash
   npm login
   ```
   Browser opens, you sign in, you're done.

4. **Enable 2FA on your npm account** at https://www.npmjs.com/settings/<your-handle>/tfa — required for publishing.

## Every release

1. **Bump version.**
   ```bash
   npm version patch    # bug fixes
   npm version minor    # new features (backwards-compatible)
   npm version major    # breaking changes
   ```
   This updates `package.json`, creates a git tag, and makes a commit.

2. **(Optional) preview what will ship.**
   ```bash
   npm pack --dry-run
   ```
   Confirms the file list and tarball size.

3. **Publish.** `prepublishOnly` re-runs the standalone build automatically.
   ```bash
   npm publish
   ```
   For scoped packages, the first publish needs `--access public`:
   ```bash
   npm publish --access public
   ```

4. **Push tags + commits.**
   ```bash
   git push --follow-tags
   ```

5. **(Optional) cut a GitHub release.**
   ```bash
   gh release create vX.Y.Z --generate-notes
   ```

## Verify

```bash
# In a totally separate terminal / different folder
npx claude-config-ui@latest
```

Should download, launch, and serve at http://localhost:3737.

## Unpublish (only if a release is broken within 72h)

```bash
npm unpublish claude-config-ui@X.Y.Z
```

After 72 hours unpublishing is restricted; you instead deprecate:
```bash
npm deprecate claude-config-ui@X.Y.Z "broken release — use X.Y.Z+1"
```
