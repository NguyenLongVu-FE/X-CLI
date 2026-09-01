import { z } from 'zod';
export declare const BulkFileActionSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    kind: z.ZodLiteral<"post-create">;
    text: z.ZodString;
    media: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"post-delete" | "like" | "unlike" | "bookmark-add" | "bookmark-remove">;
    postId: z.ZodString;
}, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"reply">;
    postId: z.ZodString;
    text: z.ZodString;
    media: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"post-delete" | "like" | "unlike" | "bookmark-add" | "bookmark-remove">;
    postId: z.ZodString;
}, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"post-delete" | "like" | "unlike" | "bookmark-add" | "bookmark-remove">;
    postId: z.ZodString;
}, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"follow" | "unfollow">;
    username: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
}, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"follow" | "unfollow">;
    username: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
}, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"post-delete" | "like" | "unlike" | "bookmark-add" | "bookmark-remove">;
    postId: z.ZodString;
}, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"post-delete" | "like" | "unlike" | "bookmark-add" | "bookmark-remove">;
    postId: z.ZodString;
}, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"dm-send">;
    username: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    text: z.ZodString;
    media: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strict>], "kind">;
export declare const BulkInputSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    account: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    actions: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"post-create">;
        text: z.ZodString;
        media: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"post-delete" | "like" | "unlike" | "bookmark-add" | "bookmark-remove">;
        postId: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"reply">;
        postId: z.ZodString;
        text: z.ZodString;
        media: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"post-delete" | "like" | "unlike" | "bookmark-add" | "bookmark-remove">;
        postId: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"post-delete" | "like" | "unlike" | "bookmark-add" | "bookmark-remove">;
        postId: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"follow" | "unfollow">;
        username: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"follow" | "unfollow">;
        username: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"post-delete" | "like" | "unlike" | "bookmark-add" | "bookmark-remove">;
        postId: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"post-delete" | "like" | "unlike" | "bookmark-add" | "bookmark-remove">;
        postId: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"dm-send">;
        username: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
        text: z.ZodString;
        media: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strict>], "kind">>;
}, z.core.$strict>;
export type BulkInput = z.infer<typeof BulkInputSchema>;
export type BulkFileAction = z.infer<typeof BulkFileActionSchema>;
