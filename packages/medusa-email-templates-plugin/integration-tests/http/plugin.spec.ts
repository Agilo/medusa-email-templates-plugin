import { createAdminHeaders } from '../helpers/admin';
import { pluginIntegrationSuite } from '../helpers/run';

jest.setTimeout(60000);

pluginIntegrationSuite(({ api, getContainer }) => {
  it('GET /admin/plugin responds 200 for an authenticated admin', async () => {
    const headers = await createAdminHeaders(getContainer());

    const res = await api.get('/admin/plugin', { headers });

    expect(res.status).toEqual(200);
  });

  it('GET /admin/plugin rejects unauthenticated requests (401)', async () => {
    const res = await api
      .get('/admin/plugin')
      .catch((e: { response: { status: number } }) => e.response);

    expect(res.status).toEqual(401);
  });
});
