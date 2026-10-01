import { LayoutIcon, type SlashCommandItem } from '@react-email/editor/ui';
import type { JSONContent } from '@tiptap/core';

import type { EmailTemplateSnippet } from '../../lib/types';
import { deriveEditorContent } from './derive-document';

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
        content = [];
      }

      editor.chain().focus().deleteRange(range).insertContent(content).run();
    },
  }));
