# X-CLI Playwriter Browser Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the official X API backend with safe Playwriter control of an already logged-in Chrome profile and add For You, media, bookmarks, DMs, and bounded bulk actions.

**Architecture:** Keep parsing, JSON/NDJSON output, immutable previews, and explicit execution independent from the browser. A process-safe Playwriter runner executes DOM-first X operations in a dedicated tab, while browser clients normalize reads and verify every write by observing the resulting UI.

**Tech Stack:** macOS, Node.js 22, TypeScript 5.8, Playwriter 0.4.0, Zod 4, Vitest 3, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-01-playwriter-browser-backend-design.md`

## Global constraints

- Support macOS, Node.js 22 or newer, Chrome, the Playwriter extension, and an English-language X interface.
- The CLI and logged-in Chrome profile run on the same Mac.
- Do not call official X API, OAuth, or undocumented private X endpoints; do not read or persist X cookies or tokens.
- Every external write remains a preview followed by explicit execution.
- Never bypass CAPTCHA, warnings, login challenges, account restrictions, or X controls.
- Bulk accepts at most twenty explicit actions, waits at least five seconds between them, and never auto-resumes.
- Keep stdout machine-readable; send redacted diagnostics to stderr.
- Do not describe skipped automated or live checks as passing.
- The slices share one runtime and must ship together because production removes the API backend only after parity.

---

### Task 1: Browser commands, operation types, and binding configuration

**Files:**
- Create: `src/browser/types.ts`, `src/browser/config.ts`
- Modify: `src/args.ts`, `src/errors.ts`
- Test: `tests/browser-config.test.ts`, `tests/args.test.ts`

**Interfaces:**
- Produces: `BrowserOperation`, `BrowserStatus`, `BrowserBinding`, `BrowserBindingStore.get(): Promise<BrowserBinding | null>`, and `BrowserBindingStore.set(binding): Promise<void>`.
- Produces parsed commands `browser-list`, `browser-bind`, `browser-status`, `feed-for-you`, `feed-following`, bookmark, DM, media, and bulk variants.

- [ ] **Step 1: Write failing parser and configuration tests.**

```ts
expect(parseArgs(['browser', 'list'])).toMatchObject({ kind: 'browser-list' })
expect(parseArgs(['browser', 'bind', '@imtamhn', '--browser', 'install:Chrome:abc'])).toMatchObject({ kind: 'browser-bind', username: 'imtamhn', browserKey: 'install:Chrome:abc' })
expect(parseArgs(['feed', 'for-you', '--limit', '5'])).toMatchObject({ kind: 'feed-for-you', limit: 5 })
await store.set({ expectedUsername: 'imtamhn', browserKey: 'install:Chrome:abc' })
expect(await store.get()).toEqual({ expectedUsername: 'imtamhn', browserKey: 'install:Chrome:abc' })
```

- [ ] **Step 2: Run `pnpm test -- tests/args.test.ts tests/browser-config.test.ts`** and verify failure because browser commands and the binding store do not exist.

- [ ] **Step 3: Add exact browser types and atomic configuration storage.**

```ts
export type BrowserOperation =
  | { kind: 'status'; expectedUsername: string }
  | { kind: 'read-feed'; feed: 'for-you' | 'following'; limit: number }
  | { kind: 'search-posts'; query: string; limit: number }
  | { kind: 'read-post'; postId: string }
  | { kind: 'read-user'; username: string }
  | { kind: 'check-following'; username: string }
  | { kind: 'read-bookmarks'; limit: number }
  | { kind: 'list-dm'; limit: number }
  | { kind: 'read-dm'; username: string; limit: number }
  | { kind: 'write'; action: ActionPreview }

export interface BrowserStatus {
  connected: true
  authenticated: true
  username: string
}
```

Store `{ "expectedUsername": "imtamhn", "browserKey": "install:Chrome:abc" }` with mode `0600` below `~/Library/Application Support/x-cli/config.json`; reject an empty or malformed username or browser key. Extend `ErrorCode` with every browser code listed in the spec.

- [ ] **Step 4: Run `pnpm typecheck && pnpm test -- tests/args.test.ts tests/browser-config.test.ts`** and verify pass.

- [ ] **Step 5: Commit** with `feat: define browser command contract`.

### Task 2: Playwriter process and session lifecycle

**Files:**
- Create: `src/browser/process.ts`, `src/browser/runner.ts`, `src/browser/lock.ts`
- Test: `tests/browser-process.test.ts`, `tests/browser-runner.test.ts`, `tests/browser-lock.test.ts`
- Modify: `package.json`, `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `BrowserOperation` from Task 1.
- Produces: `PlaywriterRunner.listBrowsers(): Promise<BrowserDescriptor[]>`, `PlaywriterRunner.run<T>(operation, browserKey): Promise<T>`, and `BrowserLock.withLock<T>(work): Promise<T>`.

- [ ] **Step 1: Write failing lifecycle tests using an injected `execFile` fake.**

```ts
const runner = new PlaywriterRunner({ execFile: fakeExec, timeoutMs: 30_000 })
await expect(runner.run<BrowserStatus>({ kind: 'status', expectedUsername: 'imtamhn' }, 'install:Chrome:abc'))
  .resolves.toMatchObject({ username: 'imtamhn' })
expect(calls.map((call) => call.args)).toEqual([
  ['session', 'new', '--browser', 'install:Chrome:abc'],
  expect.arrayContaining(['-s', '17']),
  ['session', 'delete', '17']
])
```

Assert cleanup after success and failure, timeout mapping, missing executable mapping, marker parsing, redaction, no shell execution, and concurrent-lock rejection.

- [ ] **Step 2: Run `pnpm test -- tests/browser-process.test.ts tests/browser-runner.test.ts tests/browser-lock.test.ts`** and verify the modules are missing.

- [ ] **Step 3: Implement the runner with `execFile`, JSON markers, and `finally` cleanup.**

```ts
const RESULT_PREFIX = '__XCLI_RESULT__'
const sessionId = parseSessionId((await execFile('playwriter', ['session', 'new', '--browser', browserKey], options)).stdout)
try {
  const result = await execFile('playwriter', ['-s', sessionId, '--timeout', String(timeoutMs), '-e', program], options)
  return parseMarkedJson<T>(result.stdout, RESULT_PREFIX)
} finally {
  await execFile('playwriter', ['session', 'delete', sessionId], cleanupOptions).catch(() => undefined)
}
```

Pin `playwriter` to `0.4.0`. The lock file contains PID and start time, uses exclusive creation, rejects a live owner, and removes only the lock acquired by this process.

- [ ] **Step 4: Run `pnpm typecheck && pnpm test -- tests/browser-process.test.ts tests/browser-runner.test.ts tests/browser-lock.test.ts`** and verify pass.

- [ ] **Step 5: Commit** with `feat: add safe Playwriter runtime`.

### Task 3: X page kernel, browser status, and account guard

**Files:**
- Create: `src/browser/x-program.ts`, `src/browser/client.ts`
- Create: `tests/fixtures/x/status-authenticated.txt`, `tests/fixtures/x/status-logged-out.txt`, `tests/fixtures/x/status-challenge.txt`
- Test: `tests/browser-contract.test.ts`, `tests/browser-client.test.ts`

**Interfaces:**
- Consumes: `PlaywriterRunner`, `BrowserBindingStore`.
- Produces: `BrowserXClient.listBrowsers()`, `BrowserXClient.status()`, `BrowserXClient.me()`, `assertExpectedAccount(actual, expected)`, and `operationRuntimeSource(): string`.

- [ ] **Step 1: Write failing account and fixture-contract tests.**

```ts
expect(await client.listBrowsers()).toContainEqual({ key: 'install:Chrome:abc', type: 'extension', browser: 'Chrome', profile: 'itstamhn@gmail.com' })
expect(() => assertExpectedAccount('other', 'imtamhn')).toThrowError(expect.objectContaining({ code: 'ACCOUNT_MISMATCH' }))
expect(assertFixtureContract(authenticatedFixture, ['SideNav_AccountSwitcher_Button'])).toBe(true)
expect(classifyPage(loggedOutFixture)).toBe('LOGIN_REQUIRED')
expect(classifyPage(challengeFixture)).toBe('CHALLENGE_REQUIRED')
```

- [ ] **Step 2: Run `pnpm test -- tests/browser-contract.test.ts tests/browser-client.test.ts`** and verify failure.

- [ ] **Step 3: Build a DOM-first Playwriter program and account client.**

```ts
export function buildXProgram(operation: BrowserOperation): string {
  const input = JSON.stringify(operation)
  return `${operationRuntimeSource()}\nconst input=${input}; state.page=await context.newPage(); try { await state.page.goto("https://x.com/home"); await waitForPageLoad({page:state.page,timeout:10000}); const value=await runXOperation(input,state.page); console.log("__XCLI_RESULT__"+JSON.stringify(value)); } finally { state.page.removeAllListeners(); await state.page.close(); }`
}
```

The bundled runtime uses role/test-id locators, prints URL plus `getLatestLogs({ sinceLastCall: true })` after navigation or interaction, detects login/challenge/warning surfaces before target extraction, and never prints page HTML or message content as diagnostics.

- [ ] **Step 4: Run focused tests and `pnpm typecheck`** and verify status distinguishes connected, logged out, challenged, and wrong-account states.

- [ ] **Step 5: Commit** with `feat: bind Playwriter to an X account`.

### Task 4: Read parity and real For You feed

**Files:**
- Modify: `src/browser/types.ts`, `src/browser/x-program.ts`, `src/browser/client.ts`, `src/app.ts`, `src/args.ts`
- Create: `src/browser/normalize.ts`
- Create: `tests/fixtures/x/feed-for-you.txt`, `tests/fixtures/x/feed-following.txt`, `tests/fixtures/x/search.txt`, `tests/fixtures/x/post.txt`, `tests/fixtures/x/user.txt`
- Test: `tests/browser-reads.test.ts`, `tests/cli-integration.test.ts`

**Interfaces:**
- Produces: `forYouFeed`, `followingFeed`, `searchPosts`, `getPost`, `getUser`, and `isFollowing` on `BrowserXClient`.
- Returns normalized `BrowserPost` and `BrowserUser` records; collections remain NDJSON.

- [ ] **Step 1: Write failing read tests for every visible surface and feed separation.**

```ts
expect(await client.forYouFeed(2)).toEqual([
  expect.objectContaining({ url: 'https://x.com/a/status/1', authorUsername: 'a' }),
  expect.objectContaining({ url: 'https://x.com/b/status/2', authorUsername: 'b' })
])
expect(driver.operations[0]).toMatchObject({ kind: 'read-feed', feed: 'for-you', limit: 2 })
expect(await runCommand(parseArgs(['timeline', 'home']), deps)).toBe(await runCommand(parseArgs(['feed', 'for-you']), deps))
```

Cover deduplication, three no-growth stops, inaccessible optional metrics, not-found versus changed-selector errors, and the legacy timeline aliases.

- [ ] **Step 2: Run `pnpm test -- tests/browser-reads.test.ts tests/cli-integration.test.ts`** and verify the new read routes fail.

- [ ] **Step 3: Implement read operations and normalization.**

```ts
export interface BrowserPost {
  id: string
  url: string
  text: string
  authorUsername: string
  createdAt?: string
  metrics?: { replies?: number; reposts?: number; likes?: number; views?: number }
}
```

Navigate to the exact X surface, verify the selected tab/target, scroll until the limit or three no-growth observations, and deduplicate by canonical status URL. Never map Following results into For You.

- [ ] **Step 4: Run `pnpm typecheck && pnpm test -- tests/browser-reads.test.ts tests/cli-integration.test.ts`** and verify pass.

- [ ] **Step 5: Commit** with `feat: read X through Playwriter`.

### Task 5: Verified single browser writes

**Files:**
- Create: `src/browser/writer.ts`
- Modify: `src/browser/types.ts`, `src/browser/x-program.ts`, `src/actions/types.ts`, `src/actions/executor.ts`, `src/app.ts`
- Create: `tests/fixtures/x/write-confirmed.txt`, `tests/fixtures/x/write-warning.txt`
- Test: `tests/browser-writes.test.ts`, `tests/action-executor.test.ts`, `tests/cli-integration.test.ts`

**Interfaces:**
- Consumes: existing `ActionPreview`, runner, and current-account observation.
- Produces: `BrowserXWriter.execute(action): Promise<WriteResult>` for create, delete, reply, like, unlike, follow, and unfollow.

- [ ] **Step 1: Write failing tests asserting preview-only commands and observed confirmation.**

```ts
expect(await writer.execute(likeAction)).toEqual({ outcome: 'confirmed' })
expect(driver.operations).toEqual([expect.objectContaining({ kind: 'write', action: likeAction })])
await expect(writer.execute(timeoutAfterClickAction)).resolves.toEqual({ outcome: 'unknown' })
expect(driver.retryCount).toBe(0)
```

Assert account mismatch leaves the action unconsumed, warnings/challenges stop execution, each action performs one UI submission, and ambiguous writes are never retried.

- [ ] **Step 2: Run `pnpm test -- tests/browser-writes.test.ts tests/action-executor.test.ts tests/cli-integration.test.ts`** and verify browser execution is not wired.

- [ ] **Step 3: Implement observe-act-observe write handlers.**

```ts
export class BrowserXWriter {
  constructor(private readonly runner: OperationRunner) {}
  execute(action: ActionPreview): Promise<WriteResult> {
    return this.runner.run({ kind: 'write', action })
  }
}
```

Each Playwriter handler observes URL, target, and current toggle before acting; performs one click/submission; then confirms the new post URL, missing deleted post, changed toggle, or changed relationship button. Map uncertain post-submit timeouts to `unknown`.

- [ ] **Step 4: Run focused tests and `pnpm typecheck`** and verify all seven legacy write kinds pass without API transport.

- [ ] **Step 5: Commit** with `feat: execute approved browser actions`.

### Task 6: Media hashing and browser upload

**Files:**
- Create: `src/media.ts`
- Modify: `src/args.ts`, `src/actions/types.ts`, `src/actions/planner.ts`, `src/actions/executor.ts`, `src/browser/x-program.ts`
- Test: `tests/media.test.ts`, `tests/action-planner.test.ts`, `tests/browser-writes.test.ts`

**Interfaces:**
- Produces: `describeMedia(paths): Promise<MediaDescriptor[]>` and `verifyMedia(descriptors): Promise<void>`.
- `MediaDescriptor` is `{ path: string; size: number; sha256: string }`.

- [ ] **Step 1: Write failing tests for repeatable media options and tamper detection.**

```ts
expect(parseArgs(['post', 'create', '--text', 'hi', '--media', 'a.png', '--media', 'b.jpg']))
  .toMatchObject({ media: ['a.png', 'b.jpg'] })
await expect(verifyMedia([{ path, size: 3, sha256: originalHash }])).rejects.toMatchObject({ code: 'ACTION_TAMPERED' })
```

Assert unreadable files fail before preview, descriptors contain no bytes, DM accepts at most one media path, and the repository receives no copied media.

- [ ] **Step 2: Run `pnpm test -- tests/media.test.ts tests/action-planner.test.ts tests/browser-writes.test.ts`** and verify failure.

- [ ] **Step 3: Implement streaming SHA-256 descriptors and file-chooser upload.**

```ts
export async function describeMedia(paths: readonly string[]): Promise<MediaDescriptor[]> {
  return Promise.all(paths.map(async (path) => ({ path: resolve(path), size: (await stat(path)).size, sha256: await sha256File(path) })))
}
```

Execution rehashes before consuming the preview. Playwriter sets the visible file input, waits for X's attachment preview, and maps visible rejection to `MEDIA_REJECTED`.

- [ ] **Step 4: Run focused tests and `pnpm typecheck`** and verify pass.

- [ ] **Step 5: Commit** with `feat: support approved media uploads`.

### Task 7: Bookmark reads and writes

**Files:**
- Modify: `src/args.ts`, `src/app.ts`, `src/actions/types.ts`, `src/browser/types.ts`, `src/browser/client.ts`, `src/browser/writer.ts`, `src/browser/x-program.ts`
- Create: `tests/fixtures/x/bookmarks.txt`
- Test: `tests/bookmarks.test.ts`, `tests/cli-integration.test.ts`

**Interfaces:**
- Produces: `BrowserXClient.bookmarks(limit)` and write kinds `bookmark-add`, `bookmark-remove`.

- [ ] **Step 1: Write failing bookmark contract tests.**

```ts
expect(await client.bookmarks(1)).toEqual([expect.objectContaining({ id: '42' })])
expect(await runCommand(parseArgs(['bookmark', 'add', postUrl]), deps)).toContain('"kind":"bookmark-add"')
expect(await writer.execute(removeAction)).toEqual({ outcome: 'confirmed' })
```

Assert add/remove create previews, verify the visible toggle, never retry, and reject a changed post target.

- [ ] **Step 2: Run `pnpm test -- tests/bookmarks.test.ts tests/cli-integration.test.ts`** and verify failure.

- [ ] **Step 3: Add bookmark navigation, normalization, preview kinds, and observed toggles.** Use `/i/bookmarks` for reads and the target post's visible bookmark control for writes.

```ts
export type BookmarkAction = ActionInput & { kind: 'bookmark-add' | 'bookmark-remove'; target: { postId: string } }
```

- [ ] **Step 4: Run focused tests and `pnpm typecheck`** and verify pass.

- [ ] **Step 5: Commit** with `feat: manage X bookmarks`.

### Task 8: DM reads and approved sends

**Files:**
- Modify: `src/args.ts`, `src/app.ts`, `src/actions/types.ts`, `src/browser/types.ts`, `src/browser/client.ts`, `src/browser/writer.ts`, `src/browser/x-program.ts`
- Create: `tests/fixtures/x/dm-list.txt`, `tests/fixtures/x/dm-thread.txt`
- Test: `tests/dm.test.ts`, `tests/cli-integration.test.ts`

**Interfaces:**
- Produces: `listDmConversations(limit)`, `readDmConversation(username, limit)`, and write kind `dm-send`.

- [ ] **Step 1: Write failing DM privacy and targeting tests.**

```ts
expect(await client.readDmConversation('testaccount', 2)).toHaveLength(2)
expect(await runCommand(parseArgs(['dm', 'send', '@testaccount', '--text', 'approved']), deps))
  .toContain('"kind":"dm-send"')
expect(redactDiagnostic(dmFixture)).not.toContain('private message text')
```

Assert the opened conversation username matches exactly, sending remains preview-only, media count is at most one, ambiguous sends are not retried, and production diagnostics never contain DM bodies.

- [ ] **Step 2: Run `pnpm test -- tests/dm.test.ts tests/cli-integration.test.ts`** and verify failure.

- [ ] **Step 3: Implement visible `/messages` navigation, normalized reads, and send verification.**

```ts
export interface DirectMessage {
  conversationUsername: string
  senderUsername: string
  text: string
  sentAt?: string
}
```

Execution confirms the exact text in the intended conversation after one submission. Live DM sending stays outside automation until the user approves recipient and content.

- [ ] **Step 4: Run focused tests and `pnpm typecheck`** and verify pass.

- [ ] **Step 5: Commit** with `feat: add approved X direct messages`.

### Task 9: Bounded bulk planning and stop-safe execution

**Files:**
- Create: `src/bulk/schema.ts`, `src/bulk/planner.ts`, `src/bulk/executor.ts`
- Modify: `src/args.ts`, `src/app.ts`, `src/actions/types.ts`, `src/actions/store.ts`
- Test: `tests/bulk-schema.test.ts`, `tests/bulk-executor.test.ts`, `tests/cli-integration.test.ts`

**Interfaces:**
- Produces: `BulkInputSchema`, `BulkPlanner.plan(path, account)`, and `BulkExecutor.execute(actionId)`.
- Bulk results are `{ index; kind; outcome; error? }[]` plus `{ stopped: boolean; stopCode? }`.

- [ ] **Step 1: Write failing schema, timing, and stop tests.**

```ts
expect(() => BulkInputSchema.parse({ version: 1, account: 'imtamhn', actions: Array(21).fill(like) })).toThrow()
expect(await executor.execute(id)).toMatchObject({ stopped: true, stopCode: 'CHALLENGE_REQUIRED', results: [{ index: 0, outcome: 'confirmed' }] })
expect(delays).toEqual([5000])
```

Reject unknown fields, duplicate canonical actions, nested bulk, account mismatch, missing targets, and modified input hashes. Assert no action after a challenge, warning, disconnect, or unknown result runs.

- [ ] **Step 2: Run `pnpm test -- tests/bulk-schema.test.ts tests/bulk-executor.test.ts tests/cli-integration.test.ts`** and verify failure.

- [ ] **Step 3: Implement strict Zod input, fifteen-minute immutable previews, sequential execution, and result persistence.**

```ts
for (const [index, action] of preview.actions.entries()) {
  if (index > 0) await delay(5_000)
  const result = await writer.execute(action)
  results.push({ index, kind: action.kind, ...result })
  if (result.outcome !== 'confirmed') return { stopped: true, stopCode: 'ACTION_UNKNOWN', results }
}
```

Do not implement resume. The executor records each result atomically before considering the next item.

- [ ] **Step 4: Run focused tests and `pnpm typecheck`** and verify limits, delays, and stop behavior pass.

- [ ] **Step 5: Commit** with `feat: add bounded bulk actions`.

### Task 10: Remove API backend, package the browser CLI, and release-gate it

**Files:**
- Delete: `src/api/cost.ts`, `src/api/normalize.ts`, `src/api/reads.ts`, `src/api/transport.ts`, `src/api/types.ts`, `src/api/writes.ts`
- Delete: `src/auth/callback.ts`, `src/auth/credentials.ts`, `src/auth/keychain.ts`, `src/auth/oauth.ts`, `src/auth/pkce.ts`
- Delete: corresponding obsolete API/OAuth tests
- Modify: `src/app.ts`, `src/cli.ts`, `src/index.ts`, `package.json`, `README.md`, `.github/workflows/ci.yml`, `skills/x-cli/SKILL.md`
- Create: `scripts/live-browser-contract.ts`, `tests/browser-skill-behavior.md`
- Test: all remaining tests and package smoke scripts

**Interfaces:**
- Produces: the complete browser-backed `x` binary and bundled agent skill.
- Consumes: all interfaces delivered in Tasks 1 through 9.

- [ ] **Step 1: Write failing release assertions before deleting API code.**

```ts
expect(helpText()).toContain('feed for-you')
expect(helpText()).toContain('bookmark list|add|remove')
expect(helpText()).toContain('dm list|read|send')
expect(packageJson.dependencies).toMatchObject({ playwriter: '0.4.0' })
expect(await repositoryContains(/api\.x\.com|X_CLIENT_ID|oauth\/token/)).toBe(false)
```

Extend install smoke to run `x --help`; run `x browser list` and `x browser status` with an injected fake Playwriter binary so CI verifies process wiring without an X account.

- [ ] **Step 2: Run `pnpm test` and the new repository assertion** and verify failure while the API/OAuth backend and old help remain.

- [ ] **Step 3: Wire production exclusively to browser dependencies, delete obsolete modules/tests, and update documentation and skill.**

```ts
export function createProductionApp(): AppDependencies {
  const runner = new PlaywriterRunner({ timeoutMs: 30_000 })
  const binding = new BrowserBindingStore(configPath())
  const client = new BrowserXClient(runner, binding)
  return createBrowserDependencies(client, new BrowserXWriter(runner), actionStore())
}
```

Document Chrome/extension setup, binding, every command, approval flow, bulk limits, DM privacy, live-test approval, English UI requirement, and the fact that future X DOM changes can require selector updates. Update the skill so agents check `x browser status`, preview writes, request approval, execute exact IDs, and stop on browser safety errors.

- [ ] **Step 4: Run the complete offline gate.**

```bash
pnpm typecheck
pnpm test
pnpm test:dist
pnpm test:package
pnpm test:git-install
pnpm test:skill-install
python3 /Users/mac/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/x-cli
git diff --check
```

Expected: every command exits zero, every test passes, no test is skipped, and repository scans find no production X API/OAuth reference.

- [ ] **Step 5: Run the approved live Tambot gate.** First run browser status, identity, For You, Following, search, post, user, bookmark list, and DM reads. Then obtain exact approval for each reversible write set, record before state, run post/media/delete, like/unlike, follow/unfollow, bookmark/remove, and a small bulk set, and restore before state. Do not run DM send without separate recipient-and-content approval.

- [ ] **Step 6: Fresh-install the public GitHub archive on a second Mac, verify `x --help` plus `x browser list`, explicitly bind a selected Chrome profile, then verify `x browser status`.** Record Chrome, X locale, Playwriter, Node, commit SHA, all live results, and every skipped operation.

- [ ] **Step 7: Commit** with `release: switch x-cli to Playwriter` only after Steps 4 through 6 pass.
