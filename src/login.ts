#!/usr/bin/env node
/**
 * One-off interactive login: opens a visible browser, submits the SSO form and waits
 * for the push notification to be approved in the Midas mobile app. The resulting
 * session is stored in .midas-session/ and reused by the MCP server.
 */
import { MidasSession } from "./session.js";

const s = new MidasSession({ headless: false });
try {
  await s.ensureStarted();
  console.log("Logged in. Session saved to .midas-session/ — you can start the MCP server now.");
} finally {
  await s.close();
}
