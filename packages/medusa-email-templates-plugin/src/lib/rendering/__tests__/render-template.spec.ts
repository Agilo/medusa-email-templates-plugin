import { describe, expect, it } from 'vitest';

import {
  emailVerificationDefaultTemplate,
  inviteCreatedDefaultTemplate,
} from '../../events/built-in/default-templates/account';
import { renderEmailTemplate } from '../render-template';

const template = {
  template_key: 'order-placed',
  subject_template: 'Your order #{{ order.display_id }}',
  html_template:
    '<p>Hi {{ order.customer_name }}</p><table><tbody>{% for item in order.items %}<tr><td>{{ item.title }}</td><td>{{ item.quantity }}</td><td>{{ item.total | money: order.currency_code }}</td></tr>{% endfor %}</tbody></table>',
};

const data = {
  order: {
    display_id: 1001,
    customer_name: 'Jane <Doe>',
    currency_code: 'eur',
    items: [
      { title: 'Medusa T-Shirt', quantity: 2, total: 40 },
      { title: 'Sweatpants', quantity: 1, total: 35 },
    ],
  },
};

describe('renderEmailTemplate', () => {
  it('renders the subject, escaped HTML and derived text', async () => {
    const rendered = await renderEmailTemplate(template, data);

    expect(rendered.subject).toBe('Your order #1001');
    expect(rendered.html).toContain('Jane &lt;Doe&gt;');
    expect(rendered.html).toContain('<td>Medusa T-Shirt</td>');
    expect(rendered.html).toContain('€40.00');

    expect(rendered.text).toContain('Medusa T-Shirt');
    expect(rendered.text).toContain('Sweatpants');
    expect(rendered.text.split('\n').length).toBeGreaterThan(1);
    expect(rendered.text).not.toContain('<td>');
  });

  it('prefers an explicit text template and leaves it unescaped', async () => {
    const rendered = await renderEmailTemplate(
      {
        ...template,
        text_template:
          'Order #{{ order.display_id }} for {{ order.customer_name }}',
      },
      data,
    );

    expect(rendered.text).toBe('Order #1001 for Jane <Doe>');
  });

  it('fails when the subject renders empty', async () => {
    await expect(
      renderEmailTemplate(
        { ...template, subject_template: '{{ missing }}' },
        data,
      ),
    ).rejects.toThrow('rendered empty');
  });

  it('reports which field failed to render', async () => {
    await expect(
      renderEmailTemplate(
        { ...template, html_template: '{% include "other" %}' },
        data,
      ),
    ).rejects.toThrow('Failed to render the HTML body of email template');
  });

  it('never leaks template data into render errors', async () => {
    const error = await renderEmailTemplate(
      { ...template, subject_template: '{{ order.display_id | nope }}' },
      data,
    ).catch((e: Error) => e);

    expect((error as Error).message).not.toContain('1001');
  });
});

describe('built-in default templates', () => {
  const expiresAt = '2026-10-01T10:00:00.000Z';
  const store = { name: 'Test Store' };

  it('formats the expiry date in the invite email', async () => {
    const rendered = await renderEmailTemplate(
      {
        template_key: 'invite-created',
        subject_template: inviteCreatedDefaultTemplate.subject,
        html_template: inviteCreatedDefaultTemplate.html,
      },
      {
        store,
        invite: { email: 'teammate@example.com', expires_at: expiresAt },
        invite_url: 'https://admin.example.com/app/invite?token=abc',
      },
    );

    expect(rendered.html).toContain('October');
    expect(rendered.html).toContain('2026');
    expect(rendered.html).not.toContain(expiresAt);
    expect(rendered.html).not.toContain('{{');
  });

  it('formats the expiry date in the verification email', async () => {
    const rendered = await renderEmailTemplate(
      {
        template_key: 'email-verification',
        subject_template: emailVerificationDefaultTemplate.subject,
        html_template: emailVerificationDefaultTemplate.html,
      },
      {
        store,
        email: 'jane@example.com',
        code: '482913',
        expires_at: expiresAt,
      },
    );

    expect(rendered.html).toContain('482913');
    expect(rendered.html).toContain('October');
    expect(rendered.html).not.toContain(expiresAt);
    expect(rendered.html).not.toContain('{{');
  });
});
