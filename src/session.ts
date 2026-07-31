import { chromium, type BrowserContext, type Page } from "playwright";
import { config } from "./config.js";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36";

/**
 * Owns the single authenticated Playwright session.
 *
 * Auth is entirely cookie-based, so GraphQL calls are issued from inside the page
 * context (see api.ts). The API additionally requires an `x-midas-rid` header — a
 * per-profile request id the web app generates — which we observe on the app's own
 * requests rather than trying to recompute.
 */
export class MidasSession {
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private rid: string | null = null;
  private memberUid: string | null = null;
  private starting: Promise<void> | null = null;
  private readonly headless: boolean;

  constructor(options: { headless?: boolean } = {}) {
    this.headless = options.headless ?? config.headless;
  }

  async ensureStarted(): Promise<void> {
    if (this.page && !this.page.isClosed()) return;
    this.starting ??= this.start().finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  private async start(): Promise<void> {
    this.context = await chromium.launchPersistentContext(config.sessionDir, {
      headless: this.headless,
      viewport: { width: 1440, height: 900 },
      locale: "tr-TR",
      // Headless Chromium advertises "HeadlessChrome" and omits these hints, which the
      // API gateway rejects with a 403 before the request is ever routed.
      userAgent: USER_AGENT,
      extraHTTPHeaders: {
        "sec-ch-ua": '"Chromium";v="151", "Not=A?Brand";v="99"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
      },
      args: ["--disable-blink-features=AutomationControlled"],
    });
    this.page = this.context.pages()[0] ?? (await this.context.newPage());

    this.page.on("request", (req) => {
      if (req.url().includes("router-graphql")) {
        const observed = req.headers()["x-midas-rid"];
        if (observed) this.rid = observed;
      }
    });

    await this.page.goto(config.atlasUrl, { waitUntil: "domcontentloaded" });
    await this.page.waitForTimeout(3000);

    if (this.needsLogin()) await this.login();
    await this.waitForRid();
    await this.readMemberUid();
  }

  private needsLogin(): boolean {
    const url = this.page!.url();
    return url.includes("sso.getmidas.com") || url.includes("/login");
  }

  /**
   * True once the app has bounced the page back to the login screen, which is how an
   * expired session shows up mid-request.
   */
  isLoggedOut(): boolean {
    return !this.page || this.page.isClosed() || this.needsLogin();
  }

  /**
   * Fills the SSO form and then waits for the user to approve the push notification
   * in the Midas mobile app. There is no way to complete this without the phone.
   */
  private async login(): Promise<void> {
    const page = this.page!;
    if (this.headless) {
      throw new Error(
        "Midas session has expired. Run `npm run login` (opens a visible browser), approve the push " +
          "notification on your phone, then retry. Stop the MCP server first — it holds the same browser profile."
      );
    }

    await page.waitForSelector("#phone", { timeout: 30_000 });
    await page.fill("#phone", config.phone);
    await page.fill("#password", config.password);
    await page.click("button[type=submit]:not([disabled])");

    const deadline = Date.now() + 180_000;
    while (Date.now() < deadline) {
      const url = page.url();
      if (url.startsWith(config.atlasUrl) && !url.includes("/auth/") && !url.includes("/login")) return;
      await page.waitForTimeout(1000);
    }
    throw new Error(
      "Login timed out after 3 minutes — the push notification was not approved in the Midas app."
    );
  }

  /** Reload if needed until we observe the app sending an x-midas-rid header. */
  private async waitForRid(): Promise<void> {
    const page = this.page!;
    for (let attempt = 0; attempt < 3 && !this.rid; attempt++) {
      if (attempt > 0) await page.reload({ waitUntil: "domcontentloaded" });
      for (let i = 0; i < 40 && !this.rid; i++) await page.waitForTimeout(250);
    }
    if (!this.rid) {
      throw new Error("Could not observe the app's x-midas-rid header; the session may be invalid.");
    }
  }

  private async readMemberUid(): Promise<void> {
    this.memberUid = (await this.page!.evaluate(
      `localStorage.getItem("midas:member-uid")`
    )) as string | null;
    if (!this.memberUid) {
      throw new Error("Could not read midas:member-uid — not logged in?");
    }
  }

  async getPage(): Promise<Page> {
    await this.ensureStarted();
    return this.page!;
  }

  async getRid(): Promise<string> {
    await this.ensureStarted();
    return this.rid!;
  }

  async getMemberUid(): Promise<string> {
    await this.ensureStarted();
    return this.memberUid!;
  }

  async close(): Promise<void> {
    await this.context?.close();
    this.context = null;
    this.page = null;
  }
}

export const session = new MidasSession();
