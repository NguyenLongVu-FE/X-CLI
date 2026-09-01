import type { BrowserOperation } from './types.js';

export function buildXProgram(operation: BrowserOperation): string {
  return `${operationRuntimeSource()}
const input = ${JSON.stringify(operation)};
state.page = await context.newPage();
try {
  await openXPage(state.page, "https://x.com/home");
  console.log("URL:", state.page.url());
  console.log("Page logs:", await getLatestLogs({ page: state.page, sinceLastCall: true }));
  const account = await observeXAccount(state.page);
  const value = await runXOperation(input, state.page, account);
  console.log("__XCLI_RESULT__" + JSON.stringify(value));
} finally {
  state.page.removeAllListeners();
  await state.page.close();
}`;
}

export function operationRuntimeSource(): string {
  return `async function openXPage(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 10000 });
  await waitForPageLoad({ page, timeout: 10000 });
}

async function observeXAccount(page) {
  const profileHref = await page.locator("[data-testid=AppTabBar_Profile_Link]").getAttribute("href", { timeout: 2000 }).catch(() => null);
  const displayName = await page.locator("[data-testid=SideNav_AccountSwitcher_Button]").locator("img").first().getAttribute("alt", { timeout: 2000 }).catch(() => null);
  const snapshotText = profileHref === null ? (await snapshot({ page })).slice(0, 4000) : "authenticated";
  return { url: page.url(), profileHref, displayName, snapshot: snapshotText };
}

async function runXOperation(input, page, account) {
  if (input.kind === "status") return account;
  if (input.kind === "read-feed") {
    await openXPage(page, "https://x.com/home");
    const tabName = input.feed === "for-you" ? "For you" : "Following";
    const tab = page.getByRole("tab", { name: tabName, exact: true });
    let selected = await tab.getAttribute("aria-selected", { timeout: 2000 }).catch(() => null);
    if (selected !== "true") {
      await tab.click({ timeout: 2000 }).catch(() => undefined);
      selected = await tab.getAttribute("aria-selected", { timeout: 2000 }).catch(() => null);
    }
    const value = selected === "true" ? await collectPosts(page, input.limit) : null;
    return { account, state: "ok", value };
  }
  if (input.kind === "search-posts") {
    await openXPage(page, "https://x.com/search?q=" + encodeURIComponent(input.query) + "&src=typed_query&f=live");
    return { account, state: "ok", value: await collectPosts(page, input.limit) };
  }
  if (input.kind === "read-bookmarks") {
    await openXPage(page, "https://x.com/i/bookmarks");
    return { account, state: "ok", value: await collectPosts(page, input.limit) };
  }
  if (input.kind === "list-dm" || input.kind === "read-dm") {
    await openXPage(page, "https://x.com/messages");
    if (await dmPinRequired(page)) return { account, state: "challenge" };
    if (input.kind === "list-dm") {
      return { account, state: "ok", value: (await readDmConversations(page)).slice(0, input.limit) };
    }
    const opened = await openDmConversation(page, input.username);
    if (!opened) return { account, state: "not-found" };
    return {
      account,
      state: "ok",
      value: { conversationUsername: input.username, messages: (await readVisibleDmMessages(page, account)).slice(-input.limit) }
    };
  }
  if (input.kind === "read-post") {
    await openXPage(page, "https://x.com/i/web/status/" + encodeURIComponent(input.postId));
    const posts = await readVisiblePosts(page);
    const value = posts.find((post) => new RegExp("/status/" + input.postId + "(?:/|$)").test(post.url)) || null;
    if (value !== null) return { account, state: "ok", value };
    const pageSnapshot = await snapshot({ page });
    return { account, state: isMissingPage(pageSnapshot) ? "not-found" : "ok", value };
  }
  if (input.kind === "read-user" || input.kind === "check-following") {
    await openXPage(page, "https://x.com/" + encodeURIComponent(input.username));
    const pageSnapshot = await snapshot({ page });
    const value = await readVisibleUser(page, input.kind === "check-following");
    if (value !== null) return { account, state: "ok", value };
    return { account, state: isMissingPage(pageSnapshot) ? "not-found" : "ok", value };
  }
  if (input.kind === "write") {
    const match = account.profileHref && account.profileHref.match(/^\\/([A-Za-z0-9_]{1,15})\\/?$/);
    if (!match || match[1].toLowerCase() !== String(input.action.accountId || "").toLowerCase()) {
      return { account, outcome: "unknown" };
    }
    return runWriteAction(input.action, page, account);
  }
  throw new Error("Unsupported X-CLI browser operation");
}

async function collectPosts(page, limit) {
  const posts = [];
  const seen = new Set();
  let noGrowth = 0;
  while (posts.length < limit && noGrowth < 3) {
    const batch = await readVisiblePosts(page);
    let added = 0;
    for (const post of batch) {
      const match = String(post.url || "").match(/^https?:\\/\\/(?:www\\.)?(?:x|twitter)\\.com\\/([A-Za-z0-9_]{1,15})\\/status\\/(\\d+)|^\\/([A-Za-z0-9_]{1,15})\\/status\\/(\\d+)/);
      if (!match) continue;
      const canonical = "https://x.com/" + (match[1] || match[3]).toLowerCase() + "/status/" + (match[2] || match[4]);
      if (seen.has(canonical)) continue;
      seen.add(canonical);
      posts.push({ ...post, url: canonical });
      added += 1;
      if (posts.length === limit) break;
    }
    noGrowth = added === 0 ? noGrowth + 1 : 0;
    if (posts.length < limit && noGrowth < 3) {
      await page.evaluate(() => window.scrollBy(0, Math.max(window.innerHeight, 800)));
    }
  }
  return posts;
}

async function readVisiblePosts(page) {
  return page.locator('[data-testid="tweet"]').evaluateAll((articles) => articles.map((article) => {
    const statusLink = Array.from(article.querySelectorAll('a[href*="/status/"]')).map((link) => link.getAttribute("href") || "").find((href) => /\\/status\\/\\d+/.test(href));
    const authorMatch = statusLink && statusLink.match(/^\\/([A-Za-z0-9_]{1,15})\\/status\\//);
    const metric = (selector) => {
      const element = article.querySelector(selector);
      const label = element && (element.getAttribute("aria-label") || element.textContent || "");
      const match = label && label.replace(/,/g, "").match(/\\d+(?:\\.\\d+)?\\s*[KMB]?/i);
      return match ? match[0].replace(/\\s/g, "") : undefined;
    };
    return {
      url: statusLink,
      text: (article.querySelector('[data-testid="tweetText"]')?.textContent || "").trim(),
      authorUsername: authorMatch ? authorMatch[1] : undefined,
      createdAt: article.querySelector("time")?.getAttribute("datetime") || undefined,
      metrics: {
        replies: metric('[data-testid="reply"]'),
        reposts: metric('[data-testid="retweet"]'),
        likes: metric('[data-testid="like"], [data-testid="unlike"]'),
        views: metric('a[href$="/analytics"]')
      }
    };
  }));
}

async function readVisibleUser(page, includeFollowing) {
  const userName = await page.locator('[data-testid="UserName"]').first().innerText({ timeout: 2000 }).catch(() => null);
  if (!userName) return null;
  const lines = userName.split(/\\r?\\n/).map((line) => line.trim()).filter(Boolean);
  const username = lines.find((line) => /^@[A-Za-z0-9_]{1,15}$/.test(line));
  const name = lines.find((line) => !line.startsWith("@") && line !== "Follows you");
  if (!username || !name) return null;
  const description = await page.locator('[data-testid="UserDescription"]').innerText({ timeout: 1000 }).catch(() => undefined);
  const value = { username, name, url: "https://x.com/" + username.slice(1), description };
  if (!includeFollowing) return value;
  const followText = await page.locator('[data-testid$="-follow"], [data-testid$="-unfollow"]').first().innerText({ timeout: 2000 }).catch(() => null);
  if (followText !== "Follow" && followText !== "Following") return null;
  return { ...value, following: followText === "Following" };
}

let writeAttempted = false;

async function runWriteAction(action, page, account) {
  writeAttempted = false;
  try {
    if (action.kind === "post-create") return await createPost(action, page, account);
    if (action.kind === "reply") return await replyToPost(action, page, account);
    if (action.kind === "post-delete") return await deletePost(action, page, account);
    if (action.kind === "like" || action.kind === "unlike") return await toggleLike(action, page, account);
    if (action.kind === "bookmark-add" || action.kind === "bookmark-remove") return await toggleBookmark(action, page, account);
    if (action.kind === "follow" || action.kind === "unfollow") return await toggleFollow(action, page, account);
    if (action.kind === "dm-send") return await sendDirectMessage(action, page, account);
    return { account, outcome: "unknown" };
  } catch {
    return writeAttempted ? { account, outcome: "unknown" } : { account, failure: "ui-changed" };
  }
}

async function mutatingClick(control) {
  writeAttempted = true;
  const attemptedAt = Date.now();
  await control.click({ timeout: 2000 });
  return attemptedAt;
}

async function createPost(action, page, account) {
  await openXPage(page, "https://x.com/compose/post");
  const blocked = await blockedWrite(page, account);
  if (blocked) return blocked;
  const before = ownExactPostIds(await readVisiblePosts(page), action.text, account);
  const textbox = page.locator('[data-testid="tweetTextarea_0"]');
  await textbox.fill(action.text, { timeout: 2000 });
  const upload = await uploadApprovedMedia(page, action.media, account);
  if (upload) return upload;
  const attemptedAt = await mutatingClick(page.locator('[data-testid="tweetButton"], [data-testid="tweetButtonInline"]').first());
  await page.waitForTimeout(750);
  const match = page.url().match(/\\/status\\/(\\d+)/);
  if (match) return { account, outcome: "confirmed", resourceId: match[1] };
  const post = findNewOwnExactPost(await readVisiblePosts(page), action.text, account, before, attemptedAt);
  const id = post && String(post.url || "").match(/\\/status\\/(\\d+)/)?.[1];
  return post ? { account, outcome: "confirmed", ...(id ? { resourceId: id } : {}) } : { account, outcome: "unknown" };
}

async function replyToPost(action, page, account) {
  const id = writePostId(action);
  await openXPage(page, "https://x.com/i/web/status/" + id);
  const blocked = await blockedWrite(page, account);
  if (blocked) return blocked;
  const article = findPostArticle(page, id);
  if (await article.count() === 0) return missingTargetFailure(page, account);
  const before = ownExactPostIds(await readVisiblePosts(page), action.text, account);
  await article.locator('[data-testid="reply"]').click({ timeout: 2000 });
  await page.locator('[data-testid="tweetTextarea_0"]').fill(action.text, { timeout: 2000 });
  const upload = await uploadApprovedMedia(page, action.media, account);
  if (upload) return upload;
  const attemptedAt = await mutatingClick(page.locator('[data-testid="tweetButton"]').first());
  await page.waitForTimeout(750);
  const post = findNewOwnExactPost(await readVisiblePosts(page), action.text, account, before, attemptedAt);
  const resourceId = post && String(post.url || "").match(/\\/status\\/(\\d+)/)?.[1];
  return post ? { account, outcome: "confirmed", ...(resourceId ? { resourceId } : {}) } : { account, outcome: "unknown" };
}

async function deletePost(action, page, account) {
  const id = writePostId(action);
  await openXPage(page, "https://x.com/i/web/status/" + id);
  const blocked = await blockedWrite(page, account);
  if (blocked) return blocked;
  const article = findPostArticle(page, id);
  if (await article.count() === 0) return missingTargetFailure(page, account);
  await article.locator('[data-testid="caret"]').click({ timeout: 2000 });
  await page.getByRole("menuitem", { name: "Delete", exact: true }).click({ timeout: 2000 });
  await mutatingClick(page.getByRole("button", { name: "Delete", exact: true }));
  await page.waitForTimeout(750);
  return { account, outcome: await article.count() === 0 ? "confirmed" : "unknown" };
}

async function toggleLike(action, page, account) {
  const id = writePostId(action);
  await openXPage(page, "https://x.com/i/web/status/" + id);
  const blocked = await blockedWrite(page, account);
  if (blocked) return blocked;
  const article = findPostArticle(page, id);
  if (await article.count() === 0) return missingTargetFailure(page, account);
  const before = action.kind === "like" ? "like" : "unlike";
  const after = action.kind === "like" ? "unlike" : "like";
  if (await article.locator('[data-testid="' + after + '"]').count() > 0) return { account, outcome: "confirmed" };
  const control = article.locator('[data-testid="' + before + '"]');
  if (await control.count() === 0) return { account, failure: "ui-changed" };
  await mutatingClick(control);
  await page.waitForTimeout(500);
  return { account, outcome: await article.locator('[data-testid="' + after + '"]').count() > 0 ? "confirmed" : "unknown" };
}

async function toggleBookmark(action, page, account) {
  const id = writePostId(action);
  await openXPage(page, "https://x.com/i/web/status/" + id);
  const blocked = await blockedWrite(page, account);
  if (blocked) return blocked;
  const article = findPostArticle(page, id);
  if (await article.count() === 0) return missingTargetFailure(page, account);
  const before = action.kind === "bookmark-add" ? "bookmark" : "removeBookmark";
  const after = action.kind === "bookmark-add" ? "removeBookmark" : "bookmark";
  if (await article.locator('[data-testid="' + after + '"]').count() > 0) return { account, outcome: "confirmed" };
  const control = article.locator('[data-testid="' + before + '"]');
  if (await control.count() === 0) return { account, failure: "ui-changed" };
  await mutatingClick(control);
  await page.waitForTimeout(500);
  return { account, outcome: await article.locator('[data-testid="' + after + '"]').count() > 0 ? "confirmed" : "unknown" };
}

async function toggleFollow(action, page, account) {
  const username = action.target && action.target.username;
  if (!/^[A-Za-z0-9_]{1,15}$/.test(String(username || ""))) return { account, outcome: "unknown" };
  await openXPage(page, "https://x.com/" + username);
  const blocked = await blockedWrite(page, account);
  if (blocked) return blocked;
  const target = await readVisibleUser(page, false);
  if (target === null) return missingTargetFailure(page, account);
  if (target.username.slice(1).toLowerCase() !== username.toLowerCase()) return { account, failure: "ui-changed" };
  const button = page.getByRole("button", { name: new RegExp("^(?:Follow|Following) @" + username + "$", "i") }).first();
  const before = await button.innerText({ timeout: 2000 }).catch(() => null);
  const desired = action.kind === "follow" ? "Following" : "Follow";
  if (before === desired) return { account, outcome: "confirmed" };
  if (before !== (action.kind === "follow" ? "Follow" : "Following")) return { account, failure: "ui-changed" };
  if (action.kind === "follow") await mutatingClick(button);
  else {
    await button.click({ timeout: 2000 });
    await mutatingClick(page.getByRole("button", { name: "Unfollow", exact: true }));
  }
  await page.waitForTimeout(500);
  const after = await button.innerText({ timeout: 2000 }).catch(() => null);
  return { account, outcome: after === desired ? "confirmed" : "unknown" };
}

async function sendDirectMessage(action, page, account) {
  const username = action.target && action.target.username;
  if (!/^[A-Za-z0-9_]{1,15}$/.test(String(username || ""))) return { account, outcome: "unknown" };
  await openXPage(page, "https://x.com/messages");
  if (await dmPinRequired(page)) return { account, blocked: "challenge" };
  if (!await openDmConversation(page, username)) return { account, failure: "target-not-found" };
  const blocked = await blockedWrite(page, account);
  if (blocked) return blocked;
  const ownUsername = account.profileHref && account.profileHref.replace(/^\\//, "").toLowerCase();
  const before = (await readVisibleDmMessages(page, account)).filter((message) => message.text === action.text && message.senderUsername === ownUsername).length;
  await page.locator('[data-testid="dmComposerTextInput"], [data-testid="dm-composer-textinput"]').fill(action.text, { timeout: 2000 });
  const upload = await uploadApprovedMedia(page, action.media, account);
  if (upload) return upload;
  await mutatingClick(page.locator('[data-testid="dmComposerSendButton"], [data-testid="dm-composer-send-button"]').first());
  await page.waitForTimeout(750);
  const messages = await readVisibleDmMessages(page, account);
  const confirmed = messages.filter((message) => message.text === action.text && message.senderUsername === ownUsername).length > before;
  return { account, outcome: confirmed ? "confirmed" : "unknown" };
}

async function dmPinRequired(page) {
  const pin = page.locator('[data-testid="pin-code-input-container"]');
  if (await pin.count() > 0) return true;
  await page.waitForTimeout(1500);
  return await pin.count() > 0;
}

async function readDmConversations(page) {
  const entries = page.locator('[data-testid="conversation"], [data-testid="dm-inbox-panel"] [role="button"]');
  return entries.evaluateAll((nodes) => nodes.flatMap((node, index) => {
    const lines = (node.innerText || "").split(/\\r?\\n/).map((line) => line.trim()).filter(Boolean);
    const handles = [...new Set(lines.filter((line) => /^@[A-Za-z0-9_]{1,15}$/.test(line)).map((line) => line.toLowerCase()))];
    if (handles.length !== 1) return [];
    const handle = handles[0];
    const username = handle.slice(1).toLowerCase();
    const name = lines.find((line) => line !== handle) || username;
    const link = node.closest("a") || node.querySelector("a");
    const id = node.getAttribute("data-conversation-id");
    const href = link?.getAttribute("href") || (id ? "/messages/" + id : "/messages");
    return [{ username, name, url: new URL(href, "https://x.com").href, index }];
  }));
}

async function openDmConversation(page, username) {
  const conversations = await readDmConversations(page);
  const match = conversations.find((entry) => entry.username.toLowerCase() === String(username).toLowerCase());
  if (!match) return false;
  const entries = page.locator('[data-testid="conversation"], [data-testid="dm-inbox-panel"] [role="button"]');
  await entries.nth(match.index).click({ timeout: 2000 });
  await page.waitForTimeout(500);
  const title = await page.locator('[data-testid="dm-conversation-title"], [data-testid="DMDrawerHeader"], [data-testid="dm-conversation-header"]').first().innerText({ timeout: 2000 }).catch(() => null);
  return typeof title === "string" && title.trim().toLowerCase() === "@" + String(username).toLowerCase();
}

async function readVisibleDmMessages(page, account) {
  const ownUsername = account.profileHref && account.profileHref.replace(/^\\//, "").toLowerCase();
  return page.locator('[data-testid="messageEntry"], [data-testid="dm-message"]').evaluateAll((nodes, own) => nodes.flatMap((node) => {
    const label = node.getAttribute("aria-label") || "";
    const handle = (node.getAttribute("data-sender-screen-name") || label.match(/@([A-Za-z0-9_]{1,15})/)?.[1] || (/^You\\b/i.test(label) ? own : "")).toLowerCase();
    const body = node.querySelector('[data-testid="messageText"], [data-testid="dm-message-text"]');
    const text = (body?.textContent || node.textContent || "").trim();
    if (!handle || !text) return [];
    const sentAt = node.querySelector("time")?.getAttribute("datetime") || undefined;
    return [{ senderUsername: handle, text, sentAt }];
  }), ownUsername);
}

async function blockedWrite(page, account) {
  const value = await snapshot({ page });
  if (/verify your identity|confirm your account|unusual activity/i.test(value)) {
    return { account: { ...account, url: page.url(), snapshot: value.slice(0, 4000) }, blocked: "challenge" };
  }
  if (/may not be allowed|temporarily limited|try again later|something went wrong/i.test(value)) {
    return { account, blocked: "warning" };
  }
  return null;
}

async function missingTargetFailure(page, account) {
  return { account, failure: isMissingPage(await snapshot({ page })) ? "target-not-found" : "ui-changed" };
}

async function uploadApprovedMedia(page, media, account) {
  if (!Array.isArray(media) || media.length === 0) return null;
  try {
    await page.locator('input[type="file"]').first().setInputFiles(media.map((entry) => entry.path));
    await page.waitForTimeout(750);
    const value = await snapshot({ page });
    if (/unsupported|couldn.t upload|file is too large|media failed|invalid media/i.test(value)) {
      return { account, blocked: "media" };
    }
    const previews = await page.locator('[data-testid="attachments"], [data-testid="media"]').count();
    return previews > 0 ? null : { account, blocked: "media" };
  } catch {
    return { account, blocked: "media" };
  }
}

function findPostArticle(page, id) {
  return page.locator('[data-testid="tweet"]').filter({ has: page.locator('a[href*="/status/' + id + '"]') }).first();
}

function writePostId(action) {
  const value = action.target && action.target.postId;
  if (!/^\\d+$/.test(String(value || ""))) throw new Error("Invalid post target");
  return value;
}

function ownExactPostIds(posts, text, account) {
  const ownUsername = account.profileHref && account.profileHref.replace(/^\\//, "").toLowerCase();
  return new Set(posts.flatMap((post) => {
    if (post.text !== text || String(post.authorUsername || "").toLowerCase() !== ownUsername) return [];
    const id = String(post.url || "").match(/\\/status\\/(\\d+)/)?.[1];
    return id ? [id] : [];
  }));
}

function findNewOwnExactPost(posts, text, account, before, attemptedAt) {
  const ownUsername = account.profileHref && account.profileHref.replace(/^\\//, "").toLowerCase();
  return posts.find((post) => {
    if (post.text !== text || String(post.authorUsername || "").toLowerCase() !== ownUsername) return false;
    const id = String(post.url || "").match(/\\/status\\/(\\d+)/)?.[1];
    const createdAt = Date.parse(String(post.createdAt || ""));
    return id && !before.has(id) && Number.isFinite(createdAt) && createdAt >= attemptedAt - 30000;
  });
}

function isMissingPage(value) {
  return /this page doesn.t exist|account suspended|try searching for something else/i.test(value);
}`;
}
