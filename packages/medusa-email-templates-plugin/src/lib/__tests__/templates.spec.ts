import { describe, expect, it } from 'vitest';

import type { EmailEventDefinition } from '../events/types';
import {
  buildEmailTemplateDetail,
  buildSampleData,
  resolveEmailTemplateSource,
  type EmailTemplateRecord,
} from '../templates';

const definition = {
  event: 'order.placed',
  templateKey: 'order-placed',
  label: 'Order placed',
  defaultTemplate: {
    subject: 'Default subject',
    html: '<p>Default html</p>',
    text: 'Default text',
  },
  getRecipient: async () => null,
  getContext: async () => ({}),
  variables: [
    { key: 'order.display_id', label: 'Order number', example: 1001 },
    { key: 'order.total', label: 'Total', example: 55 },
    { key: 'store.name', label: 'Store', example: 'Medusa Store' },
    { key: 'code', label: 'Code', example: '482913' },
  ],
} as unknown as EmailEventDefinition<never>;

const row: EmailTemplateRecord = {
  id: 'etpl_1',
  event: 'order.placed',
  template_key: 'order-placed',
  enabled: true,
  subject_template: 'Saved subject',
  editor_content: null,
  html_template: '<p>Saved html</p>',
  text_template: null,
};

describe('buildSampleData', () => {
  it('nests dotted keys so templates can walk them', () => {
    expect(buildSampleData(definition)).toEqual({
      order: { display_id: 1001, total: 55 },
      store: { name: 'Medusa Store' },
      code: '482913',
    });
  });

  /*
   * What a preview or test send loops over. The example is taken whole, so a
   * list arrives as the array it declares rather than as nested keys.
   */
  it('keeps a list example as an array', () => {
    const items = [{ title: 'Shirt' }, { title: 'Hat' }];
    const withList = {
      ...definition,
      variables: [
        ...definition.variables,
        { key: 'order.items', label: 'Items', type: 'list', example: items },
      ],
    } as unknown as EmailEventDefinition<never>;

    expect(buildSampleData(withList)).toMatchObject({
      order: { display_id: 1001, items },
    });
  });

  it('lets callers override the examples', () => {
    expect(
      buildSampleData(definition, { order: { display_id: 7 }, extra: true }),
    ).toMatchObject({
      order: { display_id: 7 },
      extra: true,
      store: { name: 'Medusa Store' },
    });
  });
});

describe('buildEmailTemplateDetail', () => {
  const detail = (overrides: Partial<EmailTemplateRecord> | null) =>
    buildEmailTemplateDetail(
      definition,
      overrides === null ? null : { ...row, ...overrides },
      {} as never,
    );

  it('treats a row that still matches the default as uncustomised', () => {
    // What enabling a template stores: default subject, no bodies.
    expect(
      detail({
        subject_template: definition.defaultTemplate.subject,
        html_template: null,
        text_template: null,
        editor_content: null,
        enabled: true,
      }),
    ).toMatchObject({ enabled: true, is_customized: false });
  });

  it('counts an edited subject or body as customised', () => {
    expect(detail({ subject_template: 'Changed' })).toMatchObject({
      is_customized: true,
    });

    expect(
      detail({
        subject_template: definition.defaultTemplate.subject,
        html_template: '<p>Changed</p>',
      }),
    ).toMatchObject({ is_customized: true });

    expect(
      detail({
        subject_template: definition.defaultTemplate.subject,
        html_template: null,
        editor_content: { type: 'doc' },
      }),
    ).toMatchObject({ is_customized: true });
  });

  it('is never customised without a saved row', () => {
    expect(detail(null)).toMatchObject({ id: null, is_customized: false });
  });
});

describe('subject variable warnings', () => {
  const warningsFor = (subject: string) =>
    buildEmailTemplateDetail(
      definition,
      { ...row, subject_template: subject },
      {} as never,
    ).warnings;

  it('stays quiet when every variable is declared', () => {
    expect(
      warningsFor('Your {{ store.name }} order #{{ order.display_id }}'),
    ).toEqual([]);
  });

  it('stays quiet for a subject with no variables at all', () => {
    expect(warningsFor('Thanks for your order')).toEqual([]);
  });

  /*
   * The corruption the editor cannot prevent. `strictVariables` is off, so
   * this renders as empty text rather than failing — the subject reaches a
   * real inbox reading "Your  order".
   */
  it('names a mistyped key', () => {
    const [warning] = warningsFor('Your {{ store.nme }} order');

    expect(warning).toContain('store.nme');
    expect(warning).toContain('empty text');
  });

  it('names every unknown key, not just the first', () => {
    const [warning] = warningsFor('{{ store.nme }} {{ order.totl }}');

    expect(warning).toContain('store.nme');
    expect(warning).toContain('order.totl');
  });

  /*
   * A filter argument is a variable reference too, so a typo there is just as
   * silent as one in the output itself.
   */
  it('checks filter arguments', () => {
    const [warning] = warningsFor('{{ order.total | money: order.currncy }}');

    expect(warning).toContain('order.currncy');
  });

  /*
   * The global form excludes loop aliases. Without it `item.title` would be
   * reported as unknown, flagging a template that works.
   */
  it('ignores a loop alias', () => {
    expect(
      warningsFor(
        '{% for item in order.display_id %}{{ item.title }}{% endfor %}',
      ),
    ).toEqual([]);
  });

  it('keeps the definition warnings alongside its own', () => {
    const withWarning = {
      ...definition,
      getWarnings: () => ['storefront_url_not_configured'],
    } as unknown as EmailEventDefinition<never>;

    expect(
      buildEmailTemplateDetail(
        withWarning,
        { ...row, subject_template: '{{ store.nme }}' },
        {} as never,
      ).warnings,
    ).toHaveLength(2);
  });

  it('checks the built-in default when nothing is saved', () => {
    expect(
      buildEmailTemplateDetail(definition, null, {} as never).warnings,
    ).toEqual([]);
  });
});

describe('resolveEmailTemplateSource', () => {
  it('prefers a draft, so unsaved edits can be previewed', () => {
    expect(
      resolveEmailTemplateSource(definition, row, {
        subject_template: 'Draft subject',
        html_template: '<p>Draft html</p>',
      }),
    ).toMatchObject({
      subject_template: 'Draft subject',
      html_template: '<p>Draft html</p>',
    });
  });

  it('falls back to the saved row', () => {
    expect(resolveEmailTemplateSource(definition, row)).toMatchObject({
      subject_template: 'Saved subject',
      html_template: '<p>Saved html</p>',
    });
  });

  it('falls back to the built-in default when nothing is saved', () => {
    expect(resolveEmailTemplateSource(definition, null)).toEqual({
      template_key: 'order-placed',
      subject_template: 'Default subject',
      html_template: '<p>Default html</p>',
      text_template: 'Default text',
    });
  });
});
