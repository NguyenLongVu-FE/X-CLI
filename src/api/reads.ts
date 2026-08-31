import type { ApiRequest, ApiResult } from './types.js';
import { normalizePost, normalizeUser, type XPost, type XUser } from './normalize.js';

interface Requester { request<T>(request: ApiRequest): Promise<ApiResult<T>> }
type UserEnvelope = { data: Record<string, unknown> };
type PostEnvelope = { data: Record<string, unknown> };
type PostsEnvelope = { data?: Record<string, unknown>[]; meta?: { next_token?: string } };

const USER_FIELDS = 'id,name,username,description,public_metrics';
const POST_FIELDS = 'id,text,author_id,created_at,conversation_id,public_metrics';

export class XClient {
  private accountId?: string;
  constructor(private readonly transport: Requester) {}

  async me(): Promise<XUser> {
    const result = await this.transport.request<UserEnvelope>({ method: 'GET', path: `/users/me?user.fields=${USER_FIELDS}`, kind: 'read' });
    const user = normalizeUser(result.data.data);
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
    return normalizePost(result.data.data);
  }

  async getUser(username: string): Promise<XUser> {
    const result = await this.transport.request<UserEnvelope>({
      method: 'GET', path: `/users/by/username/${encodeURIComponent(username)}?user.fields=${USER_FIELDS}`, kind: 'read'
    });
    return normalizeUser(result.data.data);
  }
}
