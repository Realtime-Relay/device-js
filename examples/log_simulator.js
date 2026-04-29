import { RelayDevice } from "../src/index.js";

const device = new RelayDevice({
  api_key: process.env.RELAY_API_KEY,
  secret: process.env.RELAY_SECRET,
  mode: process.env.RELAY_MODE || "test",
});

device.connection.listeners((event) => {
  console.log(`[connection] ${event.type}`);
});

/**
 * Log Simulator
 * =============
 *
 * Exercises every code path in device.log.{info,warn,error}:
 *   - all three levels with various arg shapes (string, number, boolean,
 *     null, undefined, plain object, array, Date, Error)
 *   - bursts that trip the size-15 flush threshold
 *   - a quiet period that flushes via the 5s debounce timer
 *   - graceful shutdown that flushes any pending entries
 *
 * Logs flush to:  <orgId>.<env>.logs.<deviceId>.<info|warn|error>
 *
 * Timeline:
 *   t=0s    → mixed-shape calls (string, number, boolean, null, undefined,
 *             object, array, Date) — 8 entries, waits for the 5s debounce
 *   t=6s    → burst of 18 entries — first 15 flush immediately, remaining 3
 *             flush after the 5s timer
 *   t=12s   → an error with a real Error object
 *   t=14s   → a validation failure (function arg) — caught locally, logged
 *   t=16s   → graceful shutdown (flushes any leftover entries)
 *
 * Usage:
 *   RELAY_API_KEY=... RELAY_SECRET=... node examples/log_simulator.js
 */

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const connected = await device.connect();
  if (!connected) {
    console.error("Failed to connect");
    process.exit(1);
  }
  console.log("Connected. Running log simulator...\n");

  // ── Phase 1: mixed-shape calls (8 entries, flushed after 5s timer) ──
  console.log("[phase 1] mixed shapes — should flush via 5s timer\n");
  device.log.info("hello world");
  device.log.info("a number reading", 42);
  device.log.info("a boolean", true);
  device.log.info("null and undefined", null, undefined);
  device.log.info("an object", { port: 8080, retries: 3 });
  device.log.info("an array", [1, 2, 3]);
  device.log.info("a date", new Date());
  device.log.warn("careful — disk usage at 87%");

  // Wait long enough for the 5s timer to fire.
  await sleep(6000);

  // ── Phase 2: burst of 18 entries (size-15 flush + remainder via timer) ──
  console.log(
    "\n[phase 2] burst of 18 entries — first 15 flush immediately\n",
  );
  for (let i = 0; i < 18; i++) {
    device.log.info(`burst entry`, i);
  }

  // Wait for the trailing-3 to flush via the 5s timer.
  await sleep(6000);

  // ── Phase 3: an actual Error ──
  console.log("\n[phase 3] log an Error object\n");
  try {
    JSON.parse("{ not json");
  } catch (err) {
    device.log.error("parse failed", err);
  }

  await sleep(2000);

  // ── Phase 4: validation failure (caller's mistake — does not crash) ──
  console.log("\n[phase 4] validation failure on bad arg\n");
  try {
    device.log.info("bad arg incoming", () => "i am a function");
  } catch (err) {
    console.log(`caught: ${err.name}: ${err.message}`);
  }

  await sleep(2000);

  // ── Phase 5: graceful shutdown — flushes any pending entries ──
  console.log("\n[phase 5] disconnecting (flushes pending logs)\n");
  await device.disconnect();
  console.log("Disconnected.");
  process.exit(0);
}

process.on("SIGINT", async () => {
  await device.disconnect();
  console.log("\nDisconnected.");
  process.exit(0);
});

main();
