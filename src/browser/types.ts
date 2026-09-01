import type { ActionPreview } from '../actions/types.js';

export type BrowserOperation =
  | { kind: 'status'; expectedUsername: string }
  | { kind: 'read-feed'; feed: 'for-you' | 'following'; limit: number }
  | { kind: 'search-posts'; query: string; limit: number }
  | { kind: 'read-post'; postId: string }
  | { kind: 'read-user'; username: string }
  | { kind: 'check-following'; username: string }
  | { kind: 'read-bookmarks'; limit: number }
  | { kind: 'list-dm'; limit: number }
  | { kind: 'read-dm'; username: string; limit: number }
  | { kind: 'write'; action: ActionPreview };

export interface BrowserStatus {
  connected: true;
  authenticated: true;
  username: string;
}
