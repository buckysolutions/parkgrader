import type { ScreenshotResult } from "./types";

/**
 * Take a screenshot of a URL. Stub implementation for V1.
 *
 * In the future this can be implemented with:
 *   - Puppeteer / Playwright (headless browser on the DO droplet)
 *   - An external screenshot API (e.g., Urlbox, ScreenshotAPI)
 *
 * The interface is designed so callers don't need to change when
 * the implementation is added.
 */
export async function takeScreenshot(url: string): Promise<ScreenshotResult> {
  // Stub — no-op in V1.
  return { path: undefined };
}
