import { XCliError } from '../errors.js';
export class XTransport {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    async request(request) {
        let tokens = await this.dependencies.store.get();
        if (!tokens)
            throw new XCliError('AUTH_REQUIRED', 'Run x auth login first', 2);
        let refreshed = false;
        let networkRetries = 0;
        while (true) {
            let response;
            try {
                response = await this.dependencies.fetch(`${this.dependencies.baseUrl ?? 'https://api.x.com/2'}${request.path}`, {
                    method: request.method,
                    headers: {
                        authorization: `Bearer ${tokens.accessToken}`,
                        ...(request.body === undefined ? {} : { 'content-type': 'application/json' })
                    },
                    body: request.body === undefined ? undefined : JSON.stringify(request.body),
                    signal: AbortSignal.timeout(this.dependencies.timeoutMs ?? 15_000)
                });
            }
            catch (error) {
                if (request.kind === 'read' && networkRetries === 0) {
                    networkRetries += 1;
                    continue;
                }
                const message = request.kind === 'write'
                    ? 'X write failed after transmission; outcome may be unknown'
                    : 'X API network request failed';
                throw new XCliError('API_ERROR', message, 3, { cause: error instanceof Error ? error.name : 'unknown' });
            }
            if (response.status === 401 && !refreshed) {
                tokens = await this.dependencies.refresh();
                refreshed = true;
                continue;
            }
            const payload = await readJson(response);
            if (!response.ok)
                throw apiError(response.status, payload, rateLimit(response.headers));
            return { data: payload, rateLimit: rateLimit(response.headers), status: response.status };
        }
    }
}
async function readJson(response) {
    const text = await response.text();
    if (text === '')
        return {};
    try {
        return JSON.parse(text);
    }
    catch {
        throw new XCliError('API_ERROR', 'X API returned malformed JSON', 3);
    }
}
function apiError(status, payload, limits) {
    if (status === 429)
        return new XCliError('RATE_LIMITED', 'X API rate limit reached', 3, { ...limits });
    if (status === 401)
        return new XCliError('AUTH_EXPIRED', 'X authorization expired', 2);
    const detail = typeof payload === 'object' && payload !== null && 'detail' in payload ? String(payload.detail) : '';
    if (status === 402 || /credit/i.test(detail))
        return new XCliError('INSUFFICIENT_CREDITS', 'X API credits are insufficient', 3);
    if (status === 403 && /scope|permission/i.test(detail))
        return new XCliError('INSUFFICIENT_SCOPE', 'X app lacks the required scope', 3);
    if (status === 404)
        return new XCliError('NOT_FOUND', 'X resource was not found', 3);
    return new XCliError('API_ERROR', `X API request failed with HTTP ${status}`, 3);
}
function rateLimit(headers) {
    return {
        limit: numberHeader(headers, 'x-rate-limit-limit'),
        remaining: numberHeader(headers, 'x-rate-limit-remaining'),
        reset: numberHeader(headers, 'x-rate-limit-reset')
    };
}
function numberHeader(headers, name) {
    const value = headers.get(name);
    return value === null ? undefined : Number(value);
}
