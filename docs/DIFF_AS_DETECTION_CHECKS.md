# Diff-as-detection checks

Very small manual checks for the new preview-driven feature flow.

## Example 1

Pick a repo that is already aligned, then run:

```bash
pnpm dev:cli migrate . --write
```

Expected result:

- Most sections should report no changes.
- If feature previews are already canonical, `detect()` should treat them as installed and skip writes.

## Example 2

Create a tiny drift on purpose, then re-run a feature:

```bash
pnpm dev:cli features .
```

Good drift examples:

- remove one known feature-owned file
- change one feature-owned script in `package.json`

Expected result:

- You should see a per-file diff prompt.
- Accepting the file should restore the canonical content.
- Running the same command again should become a no-op.
