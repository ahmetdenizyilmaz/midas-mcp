#!/usr/bin/env node
/**
 * End-to-end trading check. Places ONE real order for a single share and cancels it
 * immediately, so it verifies the whole path without meaningfully changing the account.
 *
 * Requires CONFIRM_REAL_ORDER=yes because it does submit a genuine order.
 * Usage: CONFIRM_REAL_ORDER=yes node dist/order-test.js <SYMBOL> <LIMIT_PRICE> [BUY|SELL]
 */
import { session } from "./session.js";
import { config } from "./config.js";
import * as midas from "./midas.js";

const symbol = process.argv[2] ?? "TUCLK";
const limitPrice = Number(process.argv[3]);
const side: midas.Side = process.argv[4]?.toUpperCase() === "BUY" ? "BUY" : "SELL";

if (process.env.CONFIRM_REAL_ORDER !== "yes") {
  console.error("Refusing to run: set CONFIRM_REAL_ORDER=yes to place a real 1-share test order.");
  process.exit(1);
}
if (!Number.isFinite(limitPrice) || limitPrice <= 0) {
  console.error("Usage: CONFIRM_REAL_ORDER=yes node dist/order-test.js <SYMBOL> <LIMIT_PRICE>");
  process.exit(1);
}

try {
  console.log(`\n1. Safety cap (₺${config.maxOrderValueTry}) must reject an oversized order`);
  const quote = await midas.getAssetPrice(symbol, "TRY");
  const oversized = Math.ceil((config.maxOrderValueTry / (quote.price ?? 1)) * 2);
  try {
    await midas.placeOrder({ symbol, side, quantity: oversized, limitPrice });
    console.log(`   FAIL: ${oversized} shares was accepted despite exceeding the cap`);
    process.exitCode = 1;
  } catch (error) {
    console.log(`   OK: rejected — ${error instanceof Error ? error.message : error}`);
  }

  console.log(`\n2. Place a real 1-share ${side} of ${symbol} at ₺${limitPrice}`);
  const order = await midas.placeOrder({ symbol, side, quantity: 1, limitPrice });
  console.log("   " + JSON.stringify(order));

  console.log("\n3. Order should appear in pending orders");
  const pending = await midas.getPendingOrders(symbol);
  const found = pending.orders.find((o: any) => o.uid === order.orderId);
  console.log(found ? `   OK: found ${found.uid} (${found.status})` : "   NOTE: not listed yet");

  console.log("\n4. Cancel it");
  console.log("   " + JSON.stringify(await midas.cancelOrder(order.orderId, symbol)));

  console.log("\n5. Pending orders should be empty again");
  const after = await midas.getPendingOrders(symbol);
  const stillThere = after.orders.some((o: any) => o.uid === order.orderId && o.status !== "PENDING_CANCEL");
  console.log(stillThere ? `   FAIL: still pending — ${JSON.stringify(after.orders)}` : "   OK: cleared");
  if (stillThere) process.exitCode = 1;
} finally {
  await session.close();
}
