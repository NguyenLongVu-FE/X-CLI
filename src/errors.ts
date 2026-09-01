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
  | 'ACTION_TAMPERED'
  | 'PLAYWRITER_UNAVAILABLE'
  | 'BROWSER_DISCONNECTED'
  | 'BROWSER_BUSY'
  | 'LOGIN_REQUIRED'
  | 'ACCOUNT_MISMATCH'
  | 'X_UI_CHANGED'
  | 'CHALLENGE_REQUIRED'
  | 'TARGET_NOT_FOUND'
  | 'MEDIA_REJECTED'
  | 'ACTION_UNKNOWN'
  | 'INTERNAL_ERROR';

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
