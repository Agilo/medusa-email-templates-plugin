import { BubbleMenu } from '@react-email/editor/ui';
import { NodeSelection, PluginKey, type EditorState } from '@tiptap/pm/state';

/*
 * Its own key, because the bubble menu plugin is registered per key: sharing
 * the stock text menu's would make the two instances overwrite each other.
 */
const variableBubbleMenuKey = new PluginKey('variableBubbleMenu');

/**
 * Shows the menu only for a pill selected on its own.
 *
 * A NodeSelection, not `editor.isActive('variable')`: that also answers true
 * for a text selection lying wholly inside one, which a pill cannot hold, and
 * a mixed selection that merely includes a pill is already served by the
 * stock text menu — its marks reach the pill along with the text around it.
 *
 * Linked pills are left to the link menu. A variable is never turned into a
 * link from here, but a pill can still sit inside a link that was drawn over
 * a sentence, and two menus anchored to one selection would stack.
 */
export const isVariableSelected = ({ state }: { state: EditorState }) =>
  state.selection instanceof NodeSelection &&
  state.selection.node.type.name === 'variable' &&
  !state.selection.node.marks.some((mark) => mark.type.name === 'link');

/**
 * Formatting for a selected variable.
 *
 * Only marks. The stock menu's "Turn into" and alignment act on the whole
 * paragraph, which is surprising from a single inline pill, and its link
 * selector would hand the pill to the link Inspector in place of the variable
 * one. Everything that remains is a mark the export already wraps around the
 * pill's Liquid — `<strong>{{ order.total | money: … }}</strong>` — so the
 * sent email carries the formatting without any change to the node.
 */
export const VariableBubbleMenu = () => (
  <BubbleMenu.Root
    trigger={isVariableSelected}
    pluginKey={variableBubbleMenuKey}
  >
    <BubbleMenu.ItemGroup>
      <BubbleMenu.Bold />
      <BubbleMenu.Italic />
      <BubbleMenu.Underline />
      <BubbleMenu.Strike />
      <BubbleMenu.Uppercase />
    </BubbleMenu.ItemGroup>
  </BubbleMenu.Root>
);
