export type ErrorCode =
  | 'AUTH_REQUIRED'
  | 'AUTH_EXPIRED'
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'INSUFFICIENT_SCOPE'
  | 'INSUFFICIENT_CREDITS'
  | 'RATE_LIMITED'
  | 'ACTION_EXPIRED'
  | 'ACTION_CHANGED'
  | 'API_ERROR';

export class XCliError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly exitCode = 1,
    readonly details?: Readonly<Record<string, unknown>>
  ) {
    super(message);
    this.name = 'XCliError';
  }
}
