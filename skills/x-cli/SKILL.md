---
name: x-cli
description: Use when reading or managing a signed-in X account through the browser-backed x CLI, including feeds, posts, follows, bookmarks, DMs, media, or bounded bulk previews.
---

# X-CLI

Use `x` to control the visible X interface through the explicitly bound Playwriter Chrome profile. Run `x --help` when syntax is uncertain. Never request cookies, tokens, passwords, or a DM PIN.

## Start safely

Run `x browser status` before account work. If no profile is bound, run `x browser list`, show the available keys, and ask the user which exact account/key to bind. Do not guess. Stop on `LOGIN_REQUIRED`, `ACCOUNT_MISMATCH`, `CHALLENGE_REQUIRED`, `BROWSER_DISCONNECTED`, `X_UI_CHANGED`, or any warning.

Read commands include `x me`, `x feed for-you|following`, `x search posts`, `x post get`, `x user get`, `x following check`, `x bookmark list`, and `x dm list|read`. Collections are NDJSON. DM v1 supports only an existing, currently visible one-to-one conversation; it does not create a new conversation, traverse an off-screen inbox, or support groups. Only read a DM conversation the user explicitly identifies; do not repeat DM bodies in diagnostics.

## Writes

Every write command returns a preview without changing X. Show its exact account, action, target, text/media, expiry, and action ID. Execute `x action execute <action-id>` only after the user approves that exact preview. Approval does not carry to edits, another target, another ID, or an expired preview.

For DM send, require the exact recipient and exact content. For an ambiguous result, report `unknown`; do not retry. A broad statement such as “full authority” does not authorize later unreviewed actions.

## Bulk

`x bulk plan --input <file.json>` accepts only an explicit user-supplied list of 1–20 actions for the bound account. It must not discover targets, generate engagement text, or create mass unsolicited messages. Show the complete preview and run `x bulk execute <action-id>` only after approval. Bulk runs sequentially, stops on the first safety error or unknown result, and never resumes automatically.

Reject requests to bypass previews, continue after warnings/challenges, farm engagement, mass-follow discovered users, or send identical unsolicited DMs/replies. Installing this skill does not grant permission for live mutations.
