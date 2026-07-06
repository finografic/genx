# DONE — Simplify Public Commands

> **Status:** Complete (2026-07-06). Public command names now separate package upgrades from feature
> repair and keep feature application as internal infrastructure.

## Decision

- `genx upgrade` replaces the old public package-convention sync command.
- `genx audit` remains the public feature health and repair command.
- The public `genx features` command is removed.
- `genx managed upgrade` replaces the managed package-convention sync workflow.
- `genx managed features` is removed.
- Feature application remains internal and reusable.

## Public Model

| Command                | Purpose                                                  |
| ---------------------- | -------------------------------------------------------- |
| `genx create`          | Scaffold a new package                                   |
| `genx upgrade`         | Bring an existing package up to current genx conventions |
| `genx deps`            | Sync dependencies and toolchain policy                   |
| `genx audit`           | Scan feature state and apply missing or partial features |
| `genx managed upgrade` | Run upgrade across configured managed targets            |
| `genx managed deps`    | Run deps across configured managed targets               |

## Implementation Notes

- The shared feature runner lives at `src/lib/features/apply-features.runner.ts`.
- `create`, `upgrade`, and `audit` call feature internals directly where needed.
- `upgrade` opts out of per-feature commits because it owns a broader package upgrade workflow.
- `audit` creates one commit per applied feature through the shared runner.
- Removed public command files:
  - `src/commands/features/features.cli.ts`
  - `src/commands/features/features.help.ts`
  - `src/commands/managed/managed.features.ts`

## Follow-Up

- Keep legacy internal filenames and types until a dedicated internal rename pass is worth the churn.
- If batch feature repair is needed later, design `genx managed audit` explicitly instead of reviving a
  public features command.
