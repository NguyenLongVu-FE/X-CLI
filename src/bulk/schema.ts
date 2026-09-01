import { z } from 'zod';

const postId = z.string().regex(/^\d+$/);
const username = z.string().regex(/^@?[A-Za-z0-9_]{1,15}$/).transform((value) => value.replace(/^@/, '').toLowerCase());
const text = z.string().trim().min(1).max(280);
const media = z.array(z.string().trim().min(1)).max(4).optional();
const postTarget = (kind: 'post-delete' | 'like' | 'unlike' | 'bookmark-add' | 'bookmark-remove') => z.strictObject({ kind: z.literal(kind), postId });
const userTarget = (kind: 'follow' | 'unfollow') => z.strictObject({ kind: z.literal(kind), username });

export const BulkFileActionSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('post-create'), text, media }),
  postTarget('post-delete'),
  z.strictObject({ kind: z.literal('reply'), postId, text, media }),
  postTarget('like'),
  postTarget('unlike'),
  userTarget('follow'),
  userTarget('unfollow'),
  postTarget('bookmark-add'),
  postTarget('bookmark-remove'),
  z.strictObject({ kind: z.literal('dm-send'), username, text, media: z.array(z.string().trim().min(1)).max(1).optional() })
]);

export const BulkInputSchema = z.strictObject({
  version: z.literal(1),
  account: username,
  actions: z.array(BulkFileActionSchema).min(1).max(20)
}).superRefine((input, context) => {
  const seen = new Set<string>();
  for (const [index, action] of input.actions.entries()) {
    const canonical = JSON.stringify(Object.fromEntries(Object.entries(action).sort(([a], [b]) => a.localeCompare(b))));
    if (seen.has(canonical)) context.addIssue({ code: 'custom', path: ['actions', index], message: 'Duplicate bulk action' });
    seen.add(canonical);
  }
});

export type BulkInput = z.infer<typeof BulkInputSchema>;
export type BulkFileAction = z.infer<typeof BulkFileActionSchema>;
