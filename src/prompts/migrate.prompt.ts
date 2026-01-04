import * as clack from '@clack/prompts';
import pc from 'picocolors';

import { cancel } from 'utils/prompts.utils';

export async function confirmMigrateTarget(pkg: {
  scope: string;
  name: string;
  expectedScope: string;
}): Promise<boolean | null> {
  if (pkg.scope === pkg.expectedScope) return true;

  const ok = await clack.confirm({
    message: `Detected package: ${pc.cyan(`${pkg.scope}/${pkg.name}`)}. Continue?`,
    initialValue: true,
  });

  if (clack.isCancel(ok) || ok === false) return cancel();
  return true;
}
