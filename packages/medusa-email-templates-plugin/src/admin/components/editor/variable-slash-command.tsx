import { type SlashCommandItem, TypeIcon } from '@react-email/editor/ui';

import type { EmailTemplateVariable } from '../../lib/types';

/**
 * Inserts an empty variable pill and selects it, opening the Inspector's
 * variable panel to choose its value. (Slash commands can't have a submenu,
 * so the choice happens after insertion.)
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
  // As built-in commands do: delete the typed trigger, then insert.
  command: ({ editor, range }) => {
    editor.chain().focus().deleteRange(range).setVariable().run();
  },
});
