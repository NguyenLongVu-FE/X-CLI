# X-CLI

`x-cli` controls the visible X web interface through Playwriter in a Chrome profile that is already signed in. It does not require an X Developer account, paid API credits, OAuth tokens, copied cookies, or screen-coordinate automation.

Every write is a two-step operation: create an immutable preview, review it, then execute its exact action ID. Browser challenges, warnings, account mismatches, disconnected sessions, and ambiguous results stop execution without automatic retry.

## Supported environment

- macOS
- Node.js 22, 23, or 24 (including npm/npx)
- Google Chrome with an English-language X interface
- Playwriter extension enabled on a Chrome tab
- The CLI and the signed-in Chrome profile on the same Mac

Windows, Linux, headless browsers, remote browser tunnels, non-English X interfaces, and future X DOM changes are not verified for this release.

## Install on a Mac

```bash
git clone https://github.com/NguyenLongVu-FE/X-CLI.git
cd X-CLI
npx -y pnpm@11.22.0 install --frozen-lockfile
npx -y pnpm@11.22.0 test:audit
npx -y pnpm@11.22.0 install:mac
export PATH="$HOME/.local/bin:$PATH"
x --help
```

Keep the cloned directory after installing because `~/.local/bin/x` points to its audited build. Never update that live clone in place. For an update, clone `main` into a new directory and repeat the three pinned `npx ... pnpm@11.22.0` commands there; the installer audits and builds the new clone before atomically switching the symlink. Delete the old clone only after the new `x browser status` succeeds. A failed audit or build leaves the old symlink untouched.

The direct npm/GitHub-tarball and package-manager global-link paths are intentionally unsupported because they do not preserve this repository's audited transitive dependency overrides. The unscoped npm package name `x-cli` belongs to another project.

Open Chrome, sign in to [x.com](https://x.com), enable Playwriter on that tab, then bind the exact profile:

```bash
x browser list
x browser bind @imtamhn --browser install:Chrome:your-browser-key
x browser status
```

Browser keys are machine-local. Repeat `browser list`, `browser bind`, and `browser status` on every Mac; never copy another machine's key or let an agent guess a profile. Login and logout are performed directly in Chrome. `x auth status` is a deprecated alias of `x browser status`; `auth login` and `auth logout` intentionally refuse credential handling.

## Read commands

```bash
x me
x feed for-you --limit 20
x feed following --limit 20
x timeline home --limit 20
x timeline following --limit 20
x search posts "AI automation" --limit 20
x post get https://x.com/user/status/123
x user get @imtamhn
x following check @XDevelopers
x bookmark list --limit 20
x dm list --limit 20
x dm read @sabrina --limit 20
```

`timeline home` aliases `feed for-you`; `timeline following` aliases `feed following`. Singular reads return JSON and collections return NDJSON. DM v1 operates only on existing, currently visible one-to-one conversations: it does not create a new conversation or search an off-screen inbox. DM list output contains conversation metadata only; message bodies appear only for an explicitly named conversation and are excluded from browser diagnostics.

## Preview and execute one write

These commands create previews and do not mutate X:

```bash
x post create --text "Hello" --media ./image.png
x post delete https://x.com/user/status/123
x reply https://x.com/user/status/123 --text "Thanks" --media ./image.png
x like https://x.com/user/status/123
x unlike https://x.com/user/status/123
x follow @sabrina
x unfollow @sabrina
x bookmark add https://x.com/user/status/123
x bookmark remove https://x.com/user/status/123
x dm send @sabrina --text "Approved message" --media ./image.png
```

Review the preview's account, target, text, media hash, and expiry. Execute only the approved ID:

```bash
x action execute act_0123456789abcdef0123456789abcdef
```

Single-action previews expire after five minutes and are single-use. Media is hashed at preview time and verified again before upload. An unknown outcome is never retried automatically. DM sending requires approval of the exact recipient and exact content.

## Bounded bulk actions

Bulk mode accepts an explicit user-authored JSON file. It never discovers targets, writes text, or decides whom to engage with. The file has 1–20 unique actions:

```json
{
  "version": 1,
  "account": "imtamhn",
  "actions": [
    { "kind": "like", "postId": "123" },
    { "kind": "follow", "username": "sabrina" },
    { "kind": "reply", "postId": "456", "text": "Thanks for sharing" }
  ]
}
```

```bash
x bulk plan --input ./actions.json
x bulk execute act_0123456789abcdef0123456789abcdef
```

Bulk previews expire after fifteen minutes. Execution is sequential with at least five seconds between actions. Each result is persisted before the next action. A challenge, warning, disconnect, account mismatch, or unknown outcome stops the batch; there is no resume or confirmation bypass. A stopped batch is returned as normal JSON with `stopped: true`, so scripts must inspect that field.

## Agent skill

Install the bundled cross-agent skill:

```bash
npx -y skills add NguyenLongVu-FE/X-CLI --skill x-cli
```

The skill teaches agents the exact command contract and approval boundaries. Installing it does not grant permission for live writes.

## Development and verification

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm test:audit
pnpm test:dist
pnpm test:browser-process
pnpm test:git-install
pnpm test:skill-install
```

The browser process smoke test injects a fake Playwriter executable, so CI verifies process wiring without an X account. The opt-in live read contract requires a bound browser and an explicitly approved DM conversation:

```bash
X_LIVE_BROWSER=1 X_LIVE_USERNAME=imtamhn X_LIVE_DM_USERNAME=sabrina pnpm test:live:browser
```

## Release status and exceptions

Automated tests cover parsing, binding, account guards, reads, write previews, media integrity, bookmarks, DM privacy, bulk limits, stop behavior, process cleanup, packaging, and skill installation. They do not prove that X's live DOM will never change.

Live observations on the Tambot `itstamhn@gmail.com` Chrome profile confirmed the bound X identity `@imtamhn`, visible X pages, and bookmark controls. X currently redirects Direct Messages to `/i/chat` and shows a DM PIN challenge on that profile. DM list/read/send beyond the PIN screen are therefore **not live-verified** until the account owner unlocks DM in Chrome. New DM composition, group DMs, and off-screen conversation traversal are outside DM v1. No PIN bypass is implemented or attempted.

Reposts/quotes, lists, Spaces, notifications, background automation, target discovery, CAPTCHA bypass, challenge bypass, and warning bypass are outside this release. Live writes may become visible and cleanup may fail; never report cleanup as successful before X confirms the restored state.

The CLI never deletes a stale browser lock automatically because doing so can race with a live replacement owner. If `BROWSER_BUSY` explicitly reports a stale lock, first confirm that no `x` or Playwriter command is running, then remove `~/Library/Application Support/x-cli/browser.lock` manually.
