import type { ActionPreview, WriteResult } from '../actions/types.js';
import { XCliError } from '../errors.js';
import { classifyStatusObservation } from './client.js';
import type { BrowserBindingStore } from './config.js';
import type { BrowserOperation, BrowserWriteEnvelope } from './types.js';

interface OperationRunner {
  run<T>(operation: BrowserOperation, browserKey: string): Promise<T>;
}

type BindingReader = Pick<BrowserBindingStore, 'get'>;

export class BrowserXWriter {
  constructor(private readonly runner: OperationRunner, private readonly bindings: BindingReader) {}

  async execute(action: ActionPreview): Promise<WriteResult> {
    const binding = await this.bindings.get();
    if (binding === null) throw new XCliError('INVALID_INPUT', 'No Chrome profile is bound; run x browser list and x browser bind first', 2);
    if (action.accountId.toLowerCase() !== binding.expectedUsername.toLowerCase()) {
      throw new XCliError('ACCOUNT_MISMATCH', `Action is approved for @${action.accountId}, but @${binding.expectedUsername} is bound`, 2);
    }
    const result = await this.runner.run<BrowserWriteEnvelope>({ kind: 'write', action }, binding.browserKey);
    classifyStatusObservation(result.account, binding.expectedUsername);
    if ('blocked' in result) {
      if (result.blocked === 'challenge') {
        throw new XCliError('CHALLENGE_REQUIRED', 'X requires an account challenge to be completed in Chrome', 2);
      }
      throw new XCliError('ACTION_UNKNOWN', 'X displayed a warning before the action could be confirmed', 2);
    }
    if (result.outcome !== 'confirmed' && result.outcome !== 'unknown') {
      throw new XCliError('ACTION_UNKNOWN', 'X did not return a verifiable action result', 2);
    }
    return { outcome: result.outcome, ...(result.resourceId === undefined ? {} : { resourceId: result.resourceId }) };
  }
}
