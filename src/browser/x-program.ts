import type { BrowserOperation } from './types.js';

export function buildXProgram(operation: BrowserOperation): string {
  return `${operationRuntimeSource()}
const input = ${JSON.stringify(operation)};
state.page = await context.newPage();
try {
  await state.page.goto("https://x.com/home", { waitUntil: "domcontentloaded" });
  await waitForPageLoad({ page: state.page, timeout: 10000 });
  console.log("URL:", state.page.url());
  console.log("Page logs:", await getLatestLogs({ page: state.page, sinceLastCall: true }));
  const value = await runXOperation(input, state.page);
  console.log("__XCLI_RESULT__" + JSON.stringify(value));
} finally {
  state.page.removeAllListeners();
  await state.page.close();
}`;
}

export function operationRuntimeSource(): string {
  return `async function runXOperation(input, page) {
  if (input.kind !== "status") throw new Error("Unsupported X-CLI browser operation");
  const snapshotText = await snapshot({ page });
  const profileHref = await page.locator("[data-testid=AppTabBar_Profile_Link]").getAttribute("href", { timeout: 2000 }).catch(() => null);
  const displayName = await page.locator("[data-testid=SideNav_AccountSwitcher_Button]").locator("img").first().getAttribute("alt", { timeout: 2000 }).catch(() => null);
  return { url: page.url(), profileHref, displayName, snapshot: snapshotText };
}`;
}
