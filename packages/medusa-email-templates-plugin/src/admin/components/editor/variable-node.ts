import { EmailNode } from '@react-email/editor/core';

/**
 * Variable keys are dot-separated lowercase identifiers. Restricting the
 * character set guarantees the exported Liquid tag never contains quotes or
 * angle brackets, which React would HTML-escape during email export.
 */
export const VARIABLE_KEY_PATTERN = /^[a-z0-9_]+(\.[a-z0-9_]+)*$/;

export const toLiquidOutput = (key: string): string => {
  if (!VARIABLE_KEY_PATTERN.test(key)) {
    throw new Error(`Invalid email template variable key: "${key}"`);
  }

  return `{{ ${key} }}`;
};

/**
 * Inline, non-editable variable pill. Shown as `{{ key }}` in the editor and
 * exported as the literal Liquid output tag in HTML and plain text.
 */
export const VariableNode = EmailNode.create({
  name: 'variable',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      key: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-variable'),
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-variable': attributes.key,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-variable]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      { ...HTMLAttributes, class: 'email-template-variable' },
      `{{ ${node.attrs.key} }}`,
    ];
  },

  renderText({ node }) {
    return toLiquidOutput(String(node.attrs.key));
  },

  renderToReactEmail({ node }) {
    return toLiquidOutput(String(node.attrs?.key ?? ''));
  },
});
