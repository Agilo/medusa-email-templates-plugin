import { type SlashCommandItem, TypeIcon } from '@react-email/editor/ui';

import type { EmailTemplateVariable } from '../../lib/types';

/**
 * Inserts an unconfigured variable pill and selects it, which is what brings
 * up the Inspector's variable panel, where the admin chooses which value it
 * shows.
 *
 * `SlashCommandItem` has no submenu or second step — selection is immediate —
 * so picking the variable itself has to happen after insertion rather than
 * inside the slash menu.
 */
export const variableSlashCommand = (
  variables: EmailTemplateVariable[],
): SlashCommandItem => ({
  title: 'Variable',
  description: variables.length
    ? 'Insert a value such as the order number or customer name'
    : 'No variables are available for this template',
  icon: <TypeIcon size={20} />,
  category: 'Content',
  searchTerms: ['variable', 'merge', 'field', 'placeholder', 'value'],
  // The same shape every built-in slash command uses: delete the typed
  // trigger, then let the node's own command place the selection.
  command: ({ editor, range }) => {
    editor.chain().focus().deleteRange(range).setVariable().run();
  },
});
