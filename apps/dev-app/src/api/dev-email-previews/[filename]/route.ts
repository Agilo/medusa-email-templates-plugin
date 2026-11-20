import { createReadStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

export const GET = (req: MedusaRequest, res: MedusaResponse) => {
  const filename = req.params.filename;

  if (!/^[\da-f-]{36}\.html$/i.test(filename)) {
    res.status(404).end();
    return;
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  const stream = createReadStream(resolve(tmpdir(), filename));
  stream.on('error', () => {
    if (!res.headersSent) {
      res.status(404).end();
    } else {
      res.destroy();
    }
  });
  stream.pipe(res);
};
