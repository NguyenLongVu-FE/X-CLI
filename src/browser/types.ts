import type { ActionPreview } from '../actions/types.js';

export type BrowserOperation =
  | { kind: 'status'; expectedUsername: string }
  | { kind: 'read-feed'; feed: 'for-you' | 'following'; limit: number; expectedUsername: string }
  | { kind: 'search-posts'; query: string; limit: number; expectedUsername: string }
  | { kind: 'read-post'; postId: string; expectedUsername: string }
  | { kind: 'read-user'; username: string; expectedUsername: string }
  | { kind: 'check-following'; username: string; expectedUsername: string }
  | { kind: 'read-bookmarks'; limit: number; expectedUsername: string }
  | { kind: 'list-dm'; limit: number; expectedUsername: string }
  | { kind: 'read-dm'; username: string; limit: number; expectedUsername: string }
  | { kind: 'write'; action: ActionPreview };

export interface BrowserStatus {
  connected: true;
  authenticated: true;
  username: string;
}

export interface BrowserAccountObservation {
  url: string;
  profileHref: string | null;
  displayName?: string | null;
  snapshot: string;
}

export type BrowserReadEnvelope<T> =
  | { account: BrowserAccountObservation; state: 'ok'; value: T }
  | { account: BrowserAccountObservation; state: 'not-found' | 'challenge' };

export type BrowserWriteEnvelope =
  | { account: BrowserAccountObservation; outcome: 'confirmed' | 'unknown'; resourceId?: string }
  | { account: BrowserAccountObservation; failure: 'ui-changed' | 'target-not-found' }
  | { account: BrowserAccountObservation; blocked: 'warning' | 'challenge' | 'media' };

export interface BrowserPost {
  id: string;
  url: string;
  text: string;
  authorUsername: string;
  createdAt?: string;
  metrics?: { replies?: number; reposts?: number; likes?: number; views?: number };
}

export interface BrowserUser {
  id: string;
  url: string;
  username: string;
  name: string;
  description?: string;
}

export interface DmConversation {
  username: string;
  name: string;
  url: string;
}

export interface DirectMessage {
  conversationUsername: string;
  senderUsername: string;
  text: string;
  sentAt?: string;
}

export interface BrowserDescriptor {
  key: string;
  type: string;
  browser: string;
  profile: string;
}
