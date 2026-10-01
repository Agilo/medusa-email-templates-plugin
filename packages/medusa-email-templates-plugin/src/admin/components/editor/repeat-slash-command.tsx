import { ListIcon, type SlashCommandItem } from '@react-email/editor/ui';
import type { Extensions, JSONContent } from '@tiptap/core';

import type { EmailTemplateVariable } from '../../lib/types';
import { listVariables } from '../../lib/variables';
import { deriveEditorContent } from './derive-document';

const presetFor = (
  list: EmailTemplateVariable,
  extensions: Extensions,
): JSONContent[] => {
  if (!list.itemTemplate) {
    return [];
  }

  try {
    return deriveEditorContent(list.itemTemplate, extensions).content ?? [];
  } catch {
    return [];
  }
};

export const repeatSlashCommands = (
  variables: EmailTemplateVariable[],
): SlashCommandItem[] =>
  listVariables(variables).map((list) => ({
    title: list.label,
    description: `Repeat content once for each entry in ${list.label.toLowerCase()}`,
    icon: <ListIcon size={20} />,
    category: 'Content',
    searchTerms: ['repeat', 'loop', 'list', 'each', list.key],
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setRepeat({
          source: list.key,
          content: presetFor(list, editor.extensionManager.extensions),
        })
        .run();
    },
  }));
