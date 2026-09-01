import type { ActionPreview, WriteResult } from '../actions/types.js';
import type { ApiRequest, ApiResult } from './types.js';

interface Requester { request<T>(request: ApiRequest): Promise<ApiResult<T>> }
export type { WriteResult } from '../actions/types.js';

export class XWrites {
  constructor(private readonly transport: Requester) {}

  async execute(action: ActionPreview): Promise<WriteResult> {
    const request = requestFor(action);
    const result = await this.transport.request<{ data?: { id?: string } }>(request);
    return { outcome: 'confirmed', ...(result.data.data?.id ? { resourceId: result.data.data.id } : {}) };
  }
}

function requestFor(action: ActionPreview): ApiRequest {
  const account = encodeURIComponent(action.accountId);
  if (action.kind === 'post-create') return { method: 'POST', path: '/tweets', kind: 'write', body: { text: action.text } };
  if (action.kind === 'post-delete') return { method: 'DELETE', path: `/tweets/${postId(action)}`, kind: 'write' };
  if (action.kind === 'reply') return {
    method: 'POST', path: '/tweets', kind: 'write',
    body: { text: action.text, reply: { in_reply_to_tweet_id: postId(action) } }
  };
  if (action.kind === 'like') return { method: 'POST', path: `/users/${account}/likes`, kind: 'write', body: { tweet_id: postId(action) } };
  if (action.kind === 'unlike') return { method: 'DELETE', path: `/users/${account}/likes/${postId(action)}`, kind: 'write' };
  if (action.kind === 'follow') return { method: 'POST', path: `/users/${account}/following`, kind: 'write', body: { target_user_id: userId(action) } };
  return { method: 'DELETE', path: `/users/${account}/following/${userId(action)}`, kind: 'write' };
}

function postId(action: ActionPreview): string {
  if ('postId' in action.target && typeof action.target.postId === 'string') return action.target.postId;
  throw new Error('Action target does not contain a post ID');
}

function userId(action: ActionPreview): string {
  if ('userId' in action.target && typeof action.target.userId === 'string') return action.target.userId;
  throw new Error('Action target does not contain a user ID');
}
