import { type SlashCommandItem, TypeIcon } from '@react-email/editor/ui';

import type { EmailTemplateVariable } from '../../lib/types';

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
  command: ({ editor, range }) => {
    editor.chain().focus().deleteRange(range).setVariable().run();
  },
});
