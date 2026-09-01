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

function isMissingPage(value) {
  return /this page doesn.t exist|account suspended|try searching for something else/i.test(value);
}`;
}
