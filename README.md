# x-cli

`x-cli` is a macOS-first command-line client for the official X API. It reads timelines, posts, search results, and users, and supports user-approved posts, replies, likes, unlikes, follows, and unfollows. It does not automate the X website or reuse browser cookies.

## Requirements

- macOS with Node.js 22 or newer
- An X Developer App configured as an OAuth 2.0 Native/Public Client
- Callback URL `http://127.0.0.1:8787/callback`
- API credits in X Developer Console

The unscoped npm name `x-cli` is owned by another package. This project uses `@nguyenlongvu-fe/x-cli`.

## Install

```bash
npm install -g github:NguyenLongVu-FE/x-cli
```

After npm publication:

```bash
npm install -g @nguyenlongvu-fe/x-cli
```

## Authenticate

Set the public OAuth client ID, then start PKCE login:

```bash
export X_CLIENT_ID="your-public-client-id"
x auth login
x auth status
```

For a remote browser or a headless process that can access the user's login Keychain, print the authorization URL instead of trying to open a browser:

```bash
X_OAUTH_MANUAL=1 x auth login
```

Open the printed URL in the browser profile that owns the X account. Keep the CLI running until the browser returns to the local callback.

A pure macOS SSH security session may be denied access to login Keychain secrets even while the desktop is unlocked. In that case, run `x` from the logged-in desktop agent or Terminal, or explicitly unlock the login Keychain for that SSH session. Never copy tokens into a plaintext file as a workaround.

Tokens are stored in macOS Keychain under service `com.nguyenlongvu.x-cli`. Do not put tokens in environment files or the repository.

Required scopes are `tweet.read`, `tweet.write`, `users.read`, `like.read`, `like.write`, `follows.read`, `follows.write`, and `offline.access`.

## Read X

```bash
x me
x timeline home --limit 20
x timeline following --limit 20
x search posts "AI automation" --limit 20
x post get https://x.com/user/status/123
x user get @imtamhn
```

Singular results are JSON. Collections are NDJSON and can be processed with `jq`:

```bash
x search posts "TypeScript" --limit 20 | jq -s 'map({id, text})'
```

The official API exposes a reverse-chronological home timeline, not the algorithmic For You feed. `home` and `following` currently use that same official endpoint.

## Approve a write

A write command creates a preview only:

```bash
x reply https://x.com/user/status/123 --text "Thanks for sharing"
```

Review the returned target, text, account, expiry, and `actionId`. Execute that one immutable action only after the account owner approves it:

```bash
x action execute act_0123456789abcdef0123456789abcdef
```

The same flow applies to `post create`, `like`, `unlike`, `follow`, and `unfollow`. There is no batch approval or confirmation bypass.

## Agent skill

```bash
npx -y skills add NguyenLongVu-FE/x-cli --skill x-cli
```

The bundled skill works with agents that support the common skills format. It requires separate approval before each `action execute`.

## Development

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm test:package
pnpm test:skill-install
```

After the account owner grants OAuth consent, the authorized read-only live contract can be rerun from a desktop session with Keychain access:

```bash
X_LIVE_READS=1 X_LIVE_USERNAME=imtamhn pnpm test:live:reads
```

CI never contains live OAuth credentials and the live script never performs writes. On 2026-08-31, the production package was verified against `@imtamhn` for authentication, profile, home/following timelines, recent search, user lookup, post lookup, and an approved like/unlike round trip that restored the original state.
