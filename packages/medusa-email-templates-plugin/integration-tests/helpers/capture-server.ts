import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export type CapturedRequest = {
  method: string;
  url: string;
  headers: IncomingHttpHeaders;
  body: string;
  json: <T = Record<string, unknown>>() => T;
};

export type CaptureServer = {
  url: string;
  requests: CapturedRequest[];
  respondWith: (status: number, body: unknown) => void;
  reset: () => void;
  close: () => Promise<void>;
};

export type StartCaptureServerOptions = {
  /**
   * Fixed port. Needed when the URL must be known before the server starts,
   * as with MEDUSA_CLOUD_EMAILS_ENDPOINT, which the app reads at boot.
   */
  port?: number;
};

const DEFAULT_RESPONSE = { status: 200, body: { id: 'captured_email_id' } };

export const startCaptureServer = async ({
  port = 0,
}: StartCaptureServerOptions = {}): Promise<CaptureServer> => {
  const requests: CapturedRequest[] = [];
  let response = DEFAULT_RESPONSE;

  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');

      requests.push({
        method: req.method ?? '',
        url: req.url ?? '',
        headers: req.headers,
        body,
        json: () => JSON.parse(body),
      });

      res.writeHead(response.status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(response.body));
    });
  });

  await new Promise<void>((resolve) =>
    server.listen(port, '127.0.0.1', resolve),
  );
  const address = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${address.port}`,
    requests,
    respondWith: (status, body) => {
      response = { status, body: body as typeof DEFAULT_RESPONSE.body };
    },
    reset: () => {
      requests.length = 0;
      response = DEFAULT_RESPONSE;
    },
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
};
