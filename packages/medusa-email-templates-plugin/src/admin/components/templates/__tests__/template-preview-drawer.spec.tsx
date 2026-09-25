import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sdk } from '../../../lib/sdk';
import type {
  EmailTemplateDraft,
  EmailTemplateListItem,
} from '../../../lib/types';
import { createQueryWrapper } from '../../../test/render';
import TemplatePreviewDrawer from '../template-preview-drawer';

vi.mock('../../../lib/sdk', () => ({
  sdk: { client: { fetch: vi.fn() } },
}));

const fetchMock = vi.mocked(sdk.client.fetch);

const PREVIEW_PATH = '/admin/email/templates/order-placed/preview';

const template = (): EmailTemplateListItem => ({
  id: 'etpl_1',
  template_key: 'order-placed',
  event: 'order.placed',
  label: 'Order placed',
  enabled: true,
  subject_template: 'Your order #{{ order.display_id }}',
  is_customized: true,
  updated_at: '2026-09-14T10:12:00.000Z',
  warnings: [],
});

const renderDrawer = (getDraft?: () => Promise<EmailTemplateDraft>) => {
  const { wrapper } = createQueryWrapper();

  return render(
    <TemplatePreviewDrawer
      template={template()}
      onClose={() => {}}
      getDraft={getDraft}
    />,
    { wrapper },
  );
};

describe('TemplatePreviewDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockResolvedValue({
      preview: {
        subject: 'Your order #1001',
        html: '<p>Hi Jane</p>',
        text: 'Hi Jane',
      },
    });
  });

  /*
   * The templates list renders this drawer too, with no editor behind it. That
   * path has to keep sending a bare `{}`: `draft: undefined` would still put
   * the key on the wire, and the preview schema is a strict object.
   */
  it('previews the stored template when there is no editor behind it', async () => {
    renderDrawer();

    expect(await screen.findByText('Your order #1001')).toBeInTheDocument();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(PREVIEW_PATH, {
        method: 'POST',
        body: {},
      }),
    );
  });

  /*
   * The point of the feature: what the editor holds right now, not the last
   * save. Read once on open, which is sound because the drawer is modal — the
   * content cannot change while it is up.
   */
  it('previews the unsaved subject and body', async () => {
    const getDraft = vi.fn(async () => ({
      subject_template: 'Draft subject',
      html_template: '<p>Draft body</p>',
    }));

    renderDrawer(getDraft);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(PREVIEW_PATH, {
        method: 'POST',
        body: {
          draft: {
            subject_template: 'Draft subject',
            html_template: '<p>Draft body</p>',
          },
        },
      }),
    );
  });

  /*
   * `getBody` rejects when the editor has not mounted, and composing can fail
   * on its own. Falling back to the stored template would show something that
   * is not what the editor holds, while claiming to preview it.
   */
  it('reports a body that will not export, and sends nothing', async () => {
    const getDraft = vi.fn(async (): Promise<EmailTemplateDraft> => {
      throw new Error('The editor is still loading.');
    });

    renderDrawer(getDraft);

    expect(
      await screen.findByText(/The editor is still loading\./),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
