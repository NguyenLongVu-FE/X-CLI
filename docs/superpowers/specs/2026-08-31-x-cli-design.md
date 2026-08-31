# x-cli design

Date: 2026-08-31
Status: Approved in conversation
Owner account: Sabrina, X handle `@imtamhn`

## Goal

Build a standalone TypeScript command-line client for Sabrina to browse and act on X through the official X API. The CLI must work for humans, shell scripts, and AI agents without controlling the X website or reading browser cookies.

The first release supports reading the authenticated account, home and following timelines, searching posts, reading a post, and reading a user. It supports user-directed post creation, replies, likes, unlikes, follows, and unfollows through a mandatory two-step approval flow.

## Non-goals

- Browser scripting, DOM automation, scraping, or reverse-engineering private X endpoints.
- Background engagement, automatic likes, bulk follows, engagement farming, or unsolicited automatic replies.
- Direct messages, media uploads, bookmarks, lists, analytics, or scheduling in the first release.
- Accepting X legal agreements on behalf of the account owner.
- Storing X credentials in the repository, ordinary configuration files, logs, or CI.

## Repository and distribution

Create a separate `x-cli` repository. Do not add X-specific code to `Lead-CLI`.

The package exports a TypeScript library and installs an `x` executable. Initial installation may use the GitHub repository. npm publication follows after confirming the package name is available.

The repository ships `skills/x-cli/SKILL.md`. Agents that support the common skills format can install it with `npx skills add`. The skill is not Codex-specific.

## Authentication

Use OAuth 2.0 Authorization Code with PKCE and the minimum required scopes:

- `tweet.read`
- `tweet.write`
- `users.read`
- `like.read`
- `like.write`
- `follows.read`
- `follows.write`
- `offline.access`

`x auth login` opens the user's browser and receives the callback on a fixed loopback address registered in the X Developer App. Access and refresh tokens are stored in macOS Keychain. OAuth state and PKCE verifier values are short-lived and verified before token exchange.

The account owner must personally complete X Developer enrollment and accept X's agreements. The CLI may prepare the application name, callback URL, and accurate use-case description, but it must not accept legal terms for the owner.

## Commands

```text
x auth login
x auth status
x auth logout
x me
x timeline home --limit <n>
x timeline following --limit <n>
x search posts <query> --limit <n>
x post get <post-id-or-url>
x user get <username>
x post create --text <text>
x reply <post-id-or-url> --text <text>
x like <post-id-or-url>
x unlike <post-id-or-url>
x follow <username>
x unfollow <username>
x action execute <action-id>
```

Singular reads return one JSON object. Collection reads return NDJSON. `--pretty` is for terminal display. Machine output stays on stdout and diagnostics stay on stderr.

Stable error codes include `AUTH_REQUIRED`, `AUTH_EXPIRED`, `INVALID_INPUT`, `NOT_FOUND`, `INSUFFICIENT_SCOPE`, `INSUFFICIENT_CREDITS`, `RATE_LIMITED`, `ACTION_EXPIRED`, `ACTION_CHANGED`, and `API_ERROR`.

## Write approval flow

Every write command creates a local preview and returns an expiring `actionId`. It does not call the write endpoint.

The preview records the exact action type, target, normalized text, authenticated account, creation time, expiry time, and a content hash. `x action execute <action-id>` reloads the preview, verifies its hash and expiry, confirms the current authenticated account, then makes exactly one API request.

There is no global `--yes`, batch action ID, or background executor. Any edit to the target or reply text requires a new preview. The agent skill must obtain explicit approval from Sabrina before executing an action ID.

## Internal components

- CLI parser and output formatter.
- OAuth PKCE client and loopback callback server.
- Keychain credential store with a narrow interface for testing.
- X API transport with timeout, structured errors, rate-limit metadata, and safe retry rules.
- Read services for users, posts, timelines, and search.
- Write planner that creates immutable action previews.
- Write executor that validates and consumes one preview.
- Local usage ledger for estimated API cost and configurable daily limits.

Retries are allowed only for safe reads and token refresh. A write request is never blindly retried after an ambiguous network failure.

## Privacy and safety

- Never print OAuth tokens, authorization codes, cookies, or request authorization headers.
- Redact sensitive values in thrown errors and debug logs.
- Do not store timeline or search responses unless the user explicitly redirects output.
- Store action previews locally with restrictive file permissions and automatic expiry.
- Do not include direct messages in the first release.
- Enforce one target per like, follow, unfollow, unlike, or reply action.
- The skill must reject requests for bulk or autonomous engagement.

## Developer enrollment description

Use the following truthful description in X Developer Console:

> We are building a private command-line client for the authenticated account owner. It will use the official X API to read the owner's timeline, search public posts, and view public posts and profiles. The owner may explicitly select one post or account and manually approve a reply, post, like, unlike, follow, or unfollow action. The tool will not perform bulk engagement, automatic likes, automatic follows, unsolicited or duplicate replies, website scraping, data resale, or background automation. OAuth tokens remain on the owner's Mac, and API data is displayed only for the owner's requested operation.

## Testing

Unit tests cover parsing, validation, PKCE, OAuth state, Keychain abstraction, output contracts, action hashing, expiry, and cost limits.

Integration tests use a local mock server to cover successful responses, token refresh, missing scopes, malformed responses, timeouts, rate limits, insufficient credits, and ambiguous write failures.

Package smoke tests install the built tarball into a temporary directory, run the executable, import the library, and install the bundled skill.

Live tests run only after Sabrina completes Developer enrollment and OAuth consent. They verify `me`, timeline, search, post, and user reads. Write tests create a clearly labeled test post, reply to and like it, verify each mutation by reading it back, restore a designated follow relationship, and remove test content when permitted. Every live write still uses an approved action ID.

Completion claims must list the exact test commands and results. No test may be described as passing when it was skipped. The project cannot promise permanent 100 percent reliability because X can change API behavior, pricing, limits, and policy.

## CI and release

CI runs type checking, unit tests, mock integration tests, package smoke tests, and skill installation tests. CI contains no Sabrina OAuth credentials and does not run live write tests.

The first supported platform is macOS ARM64 with Node.js 22, matching Tambot. The package should remain portable to macOS x64 and other Node.js platforms where a secure credential-store adapter is available, but Windows packaging is outside the first release.

## Success criteria

- A clean Mac can install the package from the repository and run `x --help`.
- Sabrina can complete OAuth login without copying tokens into the terminal.
- All read commands return documented machine-readable output.
- Every write requires an unexpired, content-bound action ID and performs at most one mutation.
- Tokens never appear in repository files, stdout, stderr, test snapshots, or CI logs.
- The bundled agent skill installs and enforces the same approval boundary.
- Unit, integration, package, and authorized live tests report their complete results without skipped work being hidden.
