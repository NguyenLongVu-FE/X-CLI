---
name: x-cli
description: Use when reading an authenticated X account or preparing explicitly approved post, reply, like, unlike, follow, or unfollow actions through x-cli.
---

# x-cli

Use the official X API through the `x` executable. Never drive the X website, read browser cookies, invent commands, or expose OAuth values. Run `x --help` when syntax is uncertain.

## Read operations

These commands do not mutate X:

```bash
x auth status
x me
x timeline home --limit 20
x timeline following --limit 20
x search posts "query" --limit 20
x post get <post-id-or-url>
x user get <username>
```

Collections are NDJSON. Use `jq -s` when an array is needed. `home` and `following` both represent the official reverse-chronological home timeline. The X API does not expose the algorithmic For You feed.

## Write operations

Every write requires two separate commands. The first creates a five-minute preview and makes no X mutation:

```bash
x post create --text "text"
x reply <post-id-or-url> --text "text"
x like <post-id-or-url>
x unlike <post-id-or-url>
x follow <username>
x unfollow <username>
```

Show the preview's exact account, action, target, and text to the user. Ask for explicit approval of that single action ID. Only after approval run:

```bash
x action execute <action-id>
```

Approval never carries to another target, edited text, expired preview, or additional action ID. There is no batch approval and no bypass flag.

Reject bulk or autonomous engagement, identical unsolicited replies, engagement farming, background likes, and follow churn. A broad statement such as "full authority" is not approval for a later action ID.

## Authentication

`x auth login` opens OAuth in the user's browser. `x auth logout` removes local Keychain credentials. Never request, print, copy, or store access tokens, refresh tokens, cookies, or authorization codes.

If a write has an ambiguous network failure, report that the outcome is unknown and read the target state before proposing any new action. Never retry the write blindly.
