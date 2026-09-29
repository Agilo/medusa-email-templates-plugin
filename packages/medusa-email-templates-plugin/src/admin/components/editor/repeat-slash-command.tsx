import { ListIcon, type SlashCommandItem } from '@react-email/editor/ui';
import type { Extensions, JSONContent } from '@tiptap/core';

import type { EmailTemplateVariable } from '../../lib/types';
import { listVariables } from '../../lib/variables';
import { deriveEditorContent } from './derive-document';

/**
 * A new block's starting content: the list's `itemTemplate`, with its
 * expressions turned into pills exactly as a default template's are.
 *
 * Without one, a single empty line — the admin builds the entry from there.
 */
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
    // A host's template that does not parse still leaves a usable block.
    return [];
  }
};

/**
 * One command per list the event declares — "Order items" rather than a
 * generic "Repeat", because the list is the thing being inserted. None at all
 * for an event without lists, so the menu offers nothing that cannot work.
 */
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
