# X-CLI Playwriter browser backend design

## Status

Approved in chat on 2026-09-01. This document defines the target design only. Implementation begins after the user reviews this committed spec and approves an implementation plan.

## Goal

Replace the paid official X API backend with Playwriter automation of the X web interface in a Chrome profile that is already logged in on the same Mac. Preserve the useful CLI contract, add the web-only capabilities requested by the user, and keep every external write behind an immutable preview and explicit execution step.

The release is complete when the declared command set passes automated tests, installs from GitHub on a clean macOS environment, and passes an approved live verification on Tambot without leaving test state behind.

## Constraints and non-goals

- The first supported environment is macOS, Node.js 22 or newer, Chrome, the Playwriter extension, and an English-language X interface.
- The CLI and Chrome profile run on the same Mac. Remote Playwriter tunnels, cloud browsers, Windows, and Linux are outside this release.
- The implementation must not call the official X API, X OAuth endpoints, or undocumented private X endpoints. It must not read, export, or persist X cookies or tokens.
- It does not bypass CAPTCHA, account challenges, rate limits, warnings, or other controls shown by X.
- Bulk mode executes an explicit user-supplied list. It does not discover targets, generate engagement text, or decide whom to contact.
- UI changes, expired sessions, CAPTCHA, account restrictions, and X policy changes remain external runtime risks and must be reported rather than hidden.

## Chosen approach

Use a DOM-first Playwriter adapter. The CLI invokes Playwriter in an isolated session, opens a dedicated X tab in the connected Chrome context, operates through semantic roles or stable test identifiers, verifies the resulting page after each interaction, then closes only the tab it created.

Rejected alternatives:

- Replaying X's private GraphQL requests is faster but relies on undocumented interfaces and creates additional policy and maintenance risk.
- Keeping the official API as a fallback contradicts the cost requirement and keeps OAuth and API-credit setup in the product.

## Architecture

The command parser and JSON/NDJSON output contract remain independent from browser automation. `BrowserXClient` implements reads, `BrowserXWriter` implements writes, and `PlaywriterDriver` owns process/session lifecycle, page observation, selectors, waits, and normalized browser errors.

`createProductionApp` wires these browser implementations into the existing planner, action store, and executor. The current API transport, API-cost logic, OAuth client, token refresh, and Keychain credential modules are deleted only after browser parity tests pass.

The adapter invokes the locally installed Playwriter executable. It passes bundled scripts as files or safely quoted arguments, accepts JSON on stdout, rejects non-JSON diagnostic output, applies a command timeout, and terminates only the child process it started. A per-user lock prevents two X-CLI browser commands from controlling the same profile concurrently.

## Browser binding and account safety

`x browser list` reports the browser key, browser type, browser name, and Chrome profile label exposed by Playwriter. `x browser bind <username> --browser <browser-key>` records the expected username and selected Playwriter browser key in X-CLI configuration. It never stores browser credentials. `x browser status` creates a session with that exact key, checks that an X page can load, the session is authenticated, and the active username matches the binding.

The browser key is machine-local setup data and may differ on another Mac. A missing key, a key that Playwriter no longer lists, or multiple profiles without an explicit binding fails loud; X-CLI never guesses a profile.

Every command performs the same account check. Reads fail with `ACCOUNT_MISMATCH` when the profile is logged in as another user. A write preview includes the bound username and a fresh observed account identity. Execution observes the identity again before consuming the action. A mismatch leaves the action unconsumed.

`x auth status` remains a deprecated alias of `x browser status` for one release. `x auth login` and `x auth logout` return a migration error explaining that login and logout must be performed in the Chrome profile. They do not manipulate the user's session.

## Command contract

Primary commands:

```text
x browser list
x browser bind <username> --browser <browser-key>
x browser status
x me

x feed for-you --limit <n>
x feed following --limit <n>
x search posts <query> --limit <n>
x post get <post>
x user get <username>
x following check <username>

x post create --text <text> [--media <path>...]
x post delete <post>
x reply <post> --text <text> [--media <path>...]
x like|unlike <post>
x follow|unfollow <username>

x bookmark list --limit <n>
x bookmark add|remove <post>

x dm list --limit <n>
x dm read <username> --limit <n>
x dm send <username> --text <text> [--media <path>]

x bulk plan --input <file.json>
x bulk execute <action-id>
x action execute <action-id>
```

For compatibility, `x timeline home` aliases `x feed for-you`, and `x timeline following` aliases `x feed following`. Existing post, reply, like, follow, search, user, and action commands retain their syntax unless media is supplied.

Singular reads return one JSON object. Collections return one NDJSON object per item. Browser-specific metadata may be added, but normalized fields such as post URL, author username, text, timestamp, and visible engagement counts use stable names. Missing or inaccessible visible fields are omitted rather than invented.

## Read behavior

For You and Following navigate to `x.com/home`, select the requested tab, and scroll until the requested limit is reached or three consecutive scroll observations add no posts. The command deduplicates posts by canonical status URL and never silently substitutes one feed for the other.

Search, post, user, bookmark, and DM reads navigate to their corresponding visible X pages. Direct URL or username commands verify the loaded target before extracting data. DM v1 is limited to existing, currently visible one-to-one conversations; new conversation composition, group DMs, and off-screen inbox traversal are not supported. DM output is treated as sensitive and is never written to log files by the production driver.

## Media behavior

Post and reply accept repeated `--media` paths. DM send accepts at most one media path in the first release. The parser resolves each path, rejects missing or unreadable files, and hands files to X's visible file chooser. The browser reports X's own rejection for unsupported type, size, duration, or account capability.

The action preview stores file path, size, and a content hash. Execution rechecks the hash so a file cannot be replaced between preview and approval. The CLI never copies media into the repository.

## Write approval and verification

Post, reply, delete, like, unlike, follow, unfollow, bookmark, DM, and bulk commands create previews only. The existing five-minute expiry remains for single actions. A bulk preview expires after fifteen minutes.

Execution follows observe, act, observe. A result is `confirmed` only when the post appears, the visible toggle changes, the relationship state changes, the bookmark state changes, or the sent DM is visible in the intended conversation. An ambiguous result returns `unknown` and does not retry automatically because retrying could duplicate an external action.

DM live verification requires separate approval of the recipient and exact content. Automated tests never send a real message.

## Bulk input and execution

Bulk input is versioned JSON containing the expected account and an ordered `actions` array. Each entry is one supported write action with explicit targets and text. Schema validation rejects unknown fields, duplicate entries, missing targets, nested bulk actions, and more than twenty actions.

The preview shows every action in order and a hash of the complete file. Execution waits at least five seconds between actions, records an item result before continuing, and stops on CAPTCHA, logout, account mismatch, warning banners, browser disconnection, or an unknown result. It does not auto-resume. The user must inspect results and create a new plan for remaining actions.

## Errors

The CLI returns stable error codes for `PLAYWRITER_UNAVAILABLE`, `BROWSER_DISCONNECTED`, `LOGIN_REQUIRED`, `ACCOUNT_MISMATCH`, `X_UI_CHANGED`, `CHALLENGE_REQUIRED`, `TARGET_NOT_FOUND`, `MEDIA_REJECTED`, `ACTION_UNKNOWN`, and existing input or action-store errors. Bulk results expose `stopped: true` in their normal JSON contract.

Selector failure is `X_UI_CHANGED`, not `TARGET_NOT_FOUND`, unless the target page visibly reports that the resource does not exist. Error JSON includes a concise recovery step but excludes cookies, page HTML, DM content, and credentials.

## Testing strategy

Automated tests cover parsing, normalization, action hashing, media hashing, bulk schema and limits, account checks, lock behavior, errors, and output. Browser adapter tests use sanitized HTML/accessibility fixtures for each supported X surface and encode why each stable selector identifies the intended action.

CLI integration tests use a fake driver. They cover success plus disconnected Playwriter, logged-out Chrome, wrong account, CAPTCHA, changed selectors, failed upload, ambiguous writes, and bulk stop behavior. GitHub Actions runs typecheck, all automated tests, build, package smoke, skill validation, and installation smoke without X credentials.

Live verification on Tambot covers browser status, account identity, For You, Following, search, post read, user read, and bookmarks. DM reads require the owner to unlock the visible DM PIN first. Reversible write checks require approval of each exact preview; each check captures before and after state and restores the original state. DM send additionally requires explicit approval of recipient and message. Any check blocked by a PIN or missing exact approval is reported as an exception, never as passed.

## Migration and release

Implementation proceeds in vertical slices: Playwriter connection and binding, read parity, single-write parity, media, bookmarks, DM, then bulk. The official API implementation remains testable but is not used by production during migration. It is removed with OAuth and credential setup only after all replacement slices pass.

README, `--help`, and the bundled agent skill are updated in the same release. A fresh public GitHub archive install on a second Mac must run `x --help`, `x browser list`, bind an explicitly selected profile, and run `x browser status`. The final report lists every automated and live check, any skipped live write, the tested Chrome/X locale, and external limitations. No skipped check may be described as passing.
