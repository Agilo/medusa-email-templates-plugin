import { BubbleMenu } from '@react-email/editor/ui';
import { NodeSelection, PluginKey, type EditorState } from '@tiptap/pm/state';

// Its own key: bubble menus sharing a key overwrite each other.
const variableBubbleMenuKey = new PluginKey('variableBubbleMenu');

/**
 * Shows the menu only when a pill alone is selected (a NodeSelection). A text
 * selection that includes a pill uses the stock text menu, whose marks reach
 * the pill too.
 *
 * Pills inside a link are left to the link menu, so two menus don't stack.
 */
export const isVariableSelected = ({ state }: { state: EditorState }) =>
  state.selection instanceof NodeSelection &&
  state.selection.node.type.name === 'variable' &&
  !state.selection.node.marks.some((mark) => mark.type.name === 'link');

/**
 * Formatting for a selected variable.
 *
 * - Marks: the export wraps them around the pill's Liquid
 *   (`<strong>{{ order.total | money: … }}</strong>`).
 * - Alignment: applies to the paragraph containing the pill.
 *
 * No "Turn into" (it would convert the whole paragraph) and no link selector
 * (it would hand the pill to the link Inspector).
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
    <BubbleMenu.ItemGroup>
      <BubbleMenu.AlignLeft />
      <BubbleMenu.AlignCenter />
      <BubbleMenu.AlignRight />
    </BubbleMenu.ItemGroup>
  </BubbleMenu.Root>
);
