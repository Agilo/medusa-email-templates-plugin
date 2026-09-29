import { LayoutIcon, type SlashCommandItem } from '@react-email/editor/ui';
import type { JSONContent } from '@tiptap/core';

import type { EmailTemplateSnippet } from '../../lib/types';
import { deriveEditorContent } from './derive-document';

/**
 * One command per snippet the event declares — "Order totals" — inserting
 * its HTML as ordinary content.
 *
 * Through `deriveEditorContent`, the same path a default template takes, so
 * its expressions arrive as pills and its `columns()` rows as Columns
 * layouts. A snippet is a starting point, not a block: once inserted, nothing
 * remembers where it came from, and every row can be edited or deleted.
 */
export const snippetSlashCommands = (
  snippets: EmailTemplateSnippet[],
): SlashCommandItem[] =>
  snippets.map((snippet) => ({
    title: snippet.label,
    description: snippet.description ?? `Insert ${snippet.label.toLowerCase()}`,
    icon: <LayoutIcon size={20} />,
    category: 'Content',
    searchTerms: [
      'snippet',
      'preset',
      snippet.key,
      ...snippet.label.split(' '),
    ],
    command: ({ editor, range }) => {
      let content: JSONContent[];

      try {
        content =
          deriveEditorContent(snippet.html, editor.extensionManager.extensions)
            .content ?? [];
      } catch {
        // A host's snippet that does not parse inserts nothing, rather than
        // taking the editor down with it.
        content = [];
      }

      editor.chain().focus().deleteRange(range).insertContent(content).run();
    },
  }));
