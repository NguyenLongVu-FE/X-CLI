export type ActionKind = 'post-create' | 'reply' | 'like' | 'unlike' | 'follow' | 'unfollow';
export type ActionTarget = { postId: string } | { username: string; userId: string } | Record<string, never>;

export interface ActionInput {
  kind: ActionKind;
  target: ActionTarget;
  text?: string;
}

export interface ActionPreview extends ActionInput {
  version: 1;
  id: string;
  accountId: string;
  createdAt: number;
  expiresAt: number;
  hash: string;
}
