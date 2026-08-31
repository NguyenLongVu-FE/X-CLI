import type { ApiRequest, ApiResult } from './types.js';
import { normalizePost, normalizeUser, type XPost, type XUser } from './normalize.js';
import { XCliError } from '../errors.js';

interface Requester { request<T>(request: ApiRequest): Promise<ApiResult<T>> }
type UserEnvelope = { data?: Record<string, unknown> };
type PostEnvelope = { data?: Record<string, unknown> };
type PostsEnvelope = { data?: Record<string, unknown>[]; meta?: { next_token?: string } };
type UsersEnvelope = { data?: { id?: string }[]; meta?: { next_token?: string } };

const USER_FIELDS = 'id,name,username,description,public_metrics';
const POST_FIELDS = 'id,text,author_id,created_at,conversation_id,public_metrics';

export class XClient {
  private accountId?: string;
  constructor(private readonly transport: Requester) {}

  async me(): Promise<XUser> {
    const result = await this.transport.request<UserEnvelope>({ method: 'GET', path: `/users/me?user.fields=${USER_FIELDS}`, kind: 'read' });
    const user = normalizeUser(requiredData(result.data.data));
    this.accountId = user.id;
    return user;
  }

  async homeTimeline(limit = 20): Promise<XPost[]> { return this.followingTimeline(limit); }

  async followingTimeline(limit = 20): Promise<XPost[]> {
    const id = this.accountId ?? (await this.me()).id;
    const params = new URLSearchParams({ max_results: String(Math.max(5, limit)), 'tweet.fields': POST_FIELDS });
    const result = await this.transport.request<PostsEnvelope>({
      method: 'GET', path: `/users/${id}/timelines/reverse_chronological?${params}`, kind: 'read'
    });
    return (result.data.data ?? []).slice(0, limit).map(normalizePost);
  }

  async searchPosts(query: string, limit = 20): Promise<XPost[]> {
    const params = new URLSearchParams({ query, max_results: String(Math.max(10, limit)), 'tweet.fields': POST_FIELDS });
    const result = await this.transport.request<PostsEnvelope>({ method: 'GET', path: `/tweets/search/recent?${params}`, kind: 'read' });
    return (result.data.data ?? []).slice(0, limit).map(normalizePost);
  }

  async getPost(postId: string): Promise<XPost> {
    const result = await this.transport.request<PostEnvelope>({ method: 'GET', path: `/tweets/${postId}?tweet.fields=${POST_FIELDS}`, kind: 'read' });
    return normalizePost(requiredData(result.data.data));
  }

  async getUser(username: string): Promise<XUser> {
    const result = await this.transport.request<UserEnvelope>({
      method: 'GET', path: `/users/by/username/${encodeURIComponent(username)}?user.fields=${USER_FIELDS}`, kind: 'read'
    });
    return normalizeUser(requiredData(result.data.data));
  }

  async isFollowing(username: string): Promise<{ username: string; userId: string; following: boolean }> {
    const target = await this.getUser(username);
    const accountId = this.accountId ?? (await this.me()).id;
    let paginationToken: string | undefined;
    const seenTokens = new Set<string>();
    do {
      const params = new URLSearchParams({ max_results: '1000' });
      if (paginationToken !== undefined) params.set('pagination_token', paginationToken);
      const result = await this.transport.request<UsersEnvelope>({
        method: 'GET', path: `/users/${accountId}/following?${params}`, kind: 'read'
      });
      if ((result.data.data ?? []).some((user) => user.id === target.id)) {
        return { username: target.username, userId: target.id, following: true };
      }
      paginationToken = result.data.meta?.next_token;
      if (paginationToken !== undefined && seenTokens.has(paginationToken)) break;
      if (paginationToken !== undefined) seenTokens.add(paginationToken);
    } while (paginationToken !== undefined);
    return { username: target.username, userId: target.id, following: false };
  }
}

function requiredData(value: Record<string, unknown> | undefined): Record<string, unknown> {
  if (value === undefined) throw new XCliError('NOT_FOUND', 'X resource was not found', 3);
  return value;
}
