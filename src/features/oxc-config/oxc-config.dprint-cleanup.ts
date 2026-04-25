/** Exported for preview / detection — strips dprint commands from lint-staged in place. */
export function stripDprintFromLintStaged(lintStaged: Record<string, string[] | string>): boolean {
  let modified = false;
  for (const key of Object.keys(lintStaged)) {
    const cmds = lintStaged[key];
    if (Array.isArray(cmds)) {
      const next = cmds.filter((c) => !c.includes('dprint'));
      if (next.length !== cmds.length) {
        modified = true;
        if (next.length === 0) {
          delete lintStaged[key];
        } else {
          lintStaged[key] = next;
        }
      }
    } else if (typeof cmds === 'string' && cmds.includes('dprint')) {
      delete lintStaged[key];
      modified = true;
    }
  }
  return modified;
}

/** Exported for preview / detection — strips dprint-related entries from scripts in place. */
export function stripDprintFromScripts(scripts: Record<string, string>): boolean {
  let modified = false;
  for (const key of Object.keys(scripts)) {
    const value = scripts[key];
    if (key === 'update:dprint-config' || (typeof value === 'string' && value.includes('dprint'))) {
      delete scripts[key];
      modified = true;
    }
  }
  return modified;
}
