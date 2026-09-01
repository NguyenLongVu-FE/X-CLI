export function buildXProgram(operation) {
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
export function operationRuntimeSource() {
    return `async function openXPage(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 10000 });
  await waitForPageLoad({ page, timeout: 10000 });
}

async function observeXAccount(page) {
  const snapshotText = await snapshot({ page });
  const profileHref = await page.locator("[data-testid=AppTabBar_Profile_Link]").getAttribute("href", { timeout: 2000 }).catch(() => null);
  const displayName = await page.locator("[data-testid=SideNav_AccountSwitcher_Button]").locator("img").first().getAttribute("alt", { timeout: 2000 }).catch(() => null);
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
  const followText = await page.locator('[data-testid$="-follow"]').first().innerText({ timeout: 2000 }).catch(() => null);
  if (followText !== "Follow" && followText !== "Following") return null;
  return { ...value, following: followText === "Following" };
}

async function runWriteAction(action, page, account) {
  try {
    if (action.kind === "post-create") return await createPost(action, page, account);
    if (action.kind === "reply") return await replyToPost(action, page, account);
    if (action.kind === "post-delete") return await deletePost(action, page, account);
    if (action.kind === "like" || action.kind === "unlike") return await toggleLike(action, page, account);
    if (action.kind === "follow" || action.kind === "unfollow") return await toggleFollow(action, page, account);
    return { account, outcome: "unknown" };
  } catch {
    return { account, outcome: "unknown" };
  }
}

async function createPost(action, page, account) {
  await openXPage(page, "https://x.com/compose/post");
  const blocked = await blockedWrite(page, account);
  if (blocked) return blocked;
  const textbox = page.locator('[data-testid="tweetTextarea_0"]');
  await textbox.fill(action.text, { timeout: 2000 });
  await page.locator('[data-testid="tweetButton"], [data-testid="tweetButtonInline"]').first().click({ timeout: 2000 });
  await page.waitForTimeout(750);
  const match = page.url().match(/\\/status\\/(\\d+)/);
  if (match) return { account, outcome: "confirmed", resourceId: match[1] };
  const ownUsername = account.profileHref && account.profileHref.replace(/^\\//, "").toLowerCase();
  const post = (await readVisiblePosts(page)).find((entry) => entry.text === action.text && String(entry.authorUsername || "").toLowerCase() === ownUsername);
  const id = post && String(post.url || "").match(/\\/status\\/(\\d+)/)?.[1];
  return post ? { account, outcome: "confirmed", ...(id ? { resourceId: id } : {}) } : { account, outcome: "unknown" };
}

async function replyToPost(action, page, account) {
  const id = writePostId(action);
  await openXPage(page, "https://x.com/i/web/status/" + id);
  const blocked = await blockedWrite(page, account);
  if (blocked) return blocked;
  const article = findPostArticle(page, id);
  if (await article.count() === 0) return { account, outcome: "unknown" };
  await article.locator('[data-testid="reply"]').click({ timeout: 2000 });
  await page.locator('[data-testid="tweetTextarea_0"]').fill(action.text, { timeout: 2000 });
  await page.locator('[data-testid="tweetButton"]').first().click({ timeout: 2000 });
  await page.waitForTimeout(750);
  const ownUsername = account.profileHref && account.profileHref.replace(/^\\//, "").toLowerCase();
  const post = (await readVisiblePosts(page)).find((entry) => entry.text === action.text && String(entry.authorUsername || "").toLowerCase() === ownUsername);
  const resourceId = post && String(post.url || "").match(/\\/status\\/(\\d+)/)?.[1];
  return post ? { account, outcome: "confirmed", ...(resourceId ? { resourceId } : {}) } : { account, outcome: "unknown" };
}

async function deletePost(action, page, account) {
  const id = writePostId(action);
  await openXPage(page, "https://x.com/i/web/status/" + id);
  const blocked = await blockedWrite(page, account);
  if (blocked) return blocked;
  const article = findPostArticle(page, id);
  if (await article.count() === 0) return { account, outcome: "unknown" };
  await article.locator('[data-testid="caret"]').click({ timeout: 2000 });
  await page.getByRole("menuitem", { name: "Delete", exact: true }).click({ timeout: 2000 });
  await page.getByRole("button", { name: "Delete", exact: true }).click({ timeout: 2000 });
  await page.waitForTimeout(750);
  return { account, outcome: await article.count() === 0 ? "confirmed" : "unknown" };
}

async function toggleLike(action, page, account) {
  const id = writePostId(action);
  await openXPage(page, "https://x.com/i/web/status/" + id);
  const blocked = await blockedWrite(page, account);
  if (blocked) return blocked;
  const article = findPostArticle(page, id);
  if (await article.count() === 0) return { account, outcome: "unknown" };
  const before = action.kind === "like" ? "like" : "unlike";
  const after = action.kind === "like" ? "unlike" : "like";
  if (await article.locator('[data-testid="' + after + '"]').count() > 0) return { account, outcome: "confirmed" };
  const control = article.locator('[data-testid="' + before + '"]');
  if (await control.count() === 0) return { account, outcome: "unknown" };
  await control.click({ timeout: 2000 });
  await page.waitForTimeout(500);
  return { account, outcome: await article.locator('[data-testid="' + after + '"]').count() > 0 ? "confirmed" : "unknown" };
}

async function toggleFollow(action, page, account) {
  const username = action.target && action.target.username;
  if (!/^[A-Za-z0-9_]{1,15}$/.test(String(username || ""))) return { account, outcome: "unknown" };
  await openXPage(page, "https://x.com/" + username);
  const blocked = await blockedWrite(page, account);
  if (blocked) return blocked;
  const button = page.locator('[data-testid$="-follow"]').first();
  const before = await button.innerText({ timeout: 2000 }).catch(() => null);
  const desired = action.kind === "follow" ? "Following" : "Follow";
  if (before === desired) return { account, outcome: "confirmed" };
  if (before !== (action.kind === "follow" ? "Follow" : "Following")) return { account, outcome: "unknown" };
  await button.click({ timeout: 2000 });
  if (action.kind === "unfollow") await page.getByRole("button", { name: "Unfollow", exact: true }).click({ timeout: 2000 });
  await page.waitForTimeout(500);
  const after = await button.innerText({ timeout: 2000 }).catch(() => null);
  return { account, outcome: after === desired ? "confirmed" : "unknown" };
}

async function blockedWrite(page, account) {
  const value = await snapshot({ page });
  if (/verify your identity|confirm your account|unusual activity/i.test(value)) {
    return { account: { ...account, url: page.url(), snapshot: value }, blocked: "challenge" };
  }
  if (/may not be allowed|temporarily limited|try again later|something went wrong/i.test(value)) {
    return { account, blocked: "warning" };
  }
  return null;
}

function findPostArticle(page, id) {
  return page.locator('[data-testid="tweet"]').filter({ has: page.locator('a[href*="/status/' + id + '"]') }).first();
}

function writePostId(action) {
  const value = action.target && action.target.postId;
  if (!/^\\d+$/.test(String(value || ""))) throw new Error("Invalid post target");
  return value;
}

function isMissingPage(value) {
  return /this page doesn.t exist|account suspended|try searching for something else/i.test(value);
}`;
}
