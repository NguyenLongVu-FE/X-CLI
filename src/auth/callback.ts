import { createServer } from 'node:http';

import { XCliError } from '../errors.js';

export interface OAuthCallback {
  code: string;
  state: string;
}

export async function receiveOAuthCallback(options: { port?: number; timeoutMs?: number } = {}): Promise<OAuthCallback> {
  const port = options.port ?? 8787;
  const timeoutMs = options.timeoutMs ?? 300_000;
  return new Promise((resolve, reject) => {
    const server = createServer((request, response) => {
      const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`);
      if (url.pathname !== '/callback') { response.writeHead(404).end('Not found'); return; }
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');
      if (error || !code || !state) {
        response.writeHead(400, { 'content-type': 'text/plain' }).end('X authorization failed. Return to the terminal.');
        finish(new XCliError('AUTH_REQUIRED', `X authorization failed${error ? `: ${error}` : ''}`, 2));
        return;
      }
      response.writeHead(200, { 'content-type': 'text/plain' }).end('Authorization complete. You can close this tab.');
      finish(undefined, { code, state });
    });
    const timer = setTimeout(() => finish(new XCliError('AUTH_REQUIRED', 'OAuth callback timed out', 2)), timeoutMs);
    const finish = (error?: Error, value?: OAuthCallback): void => {
      clearTimeout(timer);
      server.close();
      if (error) reject(error); else resolve(value!);
    };
    server.once('error', finish);
    server.listen(port, '127.0.0.1');
  });
}
