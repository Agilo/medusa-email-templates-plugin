import { EmailNode } from '@react-email/editor/core';

export const ORDER_ITEMS_LOOP_START = '{% for item in order.items %}';
export const ORDER_ITEMS_LOOP_END = '{% endfor %}';

const cellStyle = { padding: '8px 0', borderBottom: '1px solid #e5e7eb' };

/**
 * Block that renders the order's line items. The admin can move or delete it,
 * but its Liquid is fixed and quote-free so it survives email export intact.
 */
export const OrderItemsNode = EmailNode.create({
  name: 'orderItems',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  parseHTML() {
    return [{ tag: 'div[data-order-items]' }];
  },

  renderHTML() {
    return [
      'div',
      { 'data-order-items': '', class: 'email-template-order-items' },
      [
        'table',
        { style: 'width: 100%' },
        [
          'tbody',
          {},
          [
            'tr',
            {},
            ['td', {}, 'Item'],
            ['td', {}, 'Qty'],
            ['td', {}, 'Total'],
          ],
          [
            'tr',
            {},
            ['td', {}, '{{ item.title }}'],
            ['td', {}, '{{ item.quantity }}'],
            ['td', {}, '{{ item.total }}'],
          ],
        ],
      ],
    ];
  },

  renderToReactEmail({ style }) {
    return (
      <table
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        role="presentation"
        style={style}
      >
        <tbody>
          {ORDER_ITEMS_LOOP_START}
          <tr>
            <td style={cellStyle}>{'{{ item.title }}'}</td>
            <td style={{ ...cellStyle, textAlign: 'center' }}>
              {'{{ item.quantity }}'}
            </td>
            <td style={{ ...cellStyle, textAlign: 'right' }}>
              {'{{ item.total }}'}
            </td>
          </tr>
          {ORDER_ITEMS_LOOP_END}
        </tbody>
      </table>
    );
  },
});
