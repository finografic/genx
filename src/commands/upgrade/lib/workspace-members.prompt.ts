import { promptMultiSelect } from '@finografic/cli-kit/flow';
import type { FlowContext } from '@finografic/cli-kit/flow';

import type { WorkspaceMember } from 'lib/monorepo/monorepo.workspace';

/**
 * Choose which workspace members package-scoped features run against.
 *
 * Everything is pre-selected: the common case is "all of them", and a member the feature does not
 * suit still shows its own per-file diff before anything is written.
 */
export async function promptWorkspaceMembers(
  flow: FlowContext,
  members: WorkspaceMember[],
): Promise<string[]> {
  return promptMultiSelect(flow, {
    message: 'Select workspace members:',
    options: members.map((member) => ({
      value: member.relativePath,
      label: member.relativePath,
      ...(member.name ? { hint: member.name } : {}),
    })),
    initialValues: members.map((member) => member.relativePath),
  });
}
