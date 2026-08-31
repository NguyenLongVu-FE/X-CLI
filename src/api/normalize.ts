export interface XUser {
  id: string;
  name: string;
  username: string;
  description?: string;
  publicMetrics?: Readonly<Record<string, number>>;
}

export interface XPost {
  id: string;
  text: string;
  authorId?: string;
  createdAt?: string;
  conversationId?: string;
  publicMetrics?: Readonly<Record<string, number>>;
}

export function normalizeUser(value: Record<string, unknown>): XUser {
  return {
    id: String(value.id), name: String(value.name), username: String(value.username),
    ...(typeof value.description === 'string' ? { description: value.description } : {}),
    ...(isNumberRecord(value.public_metrics) ? { publicMetrics: value.public_metrics } : {})
  };
}

export function normalizePost(value: Record<string, unknown>): XPost {
  return {
    id: String(value.id), text: String(value.text),
    ...(typeof value.author_id === 'string' ? { authorId: value.author_id } : {}),
    ...(typeof value.created_at === 'string' ? { createdAt: value.created_at } : {}),
    ...(typeof value.conversation_id === 'string' ? { conversationId: value.conversation_id } : {}),
    ...(isNumberRecord(value.public_metrics) ? { publicMetrics: value.public_metrics } : {})
  };
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  return typeof value === 'object' && value !== null && Object.values(value).every((entry) => typeof entry === 'number');
}
