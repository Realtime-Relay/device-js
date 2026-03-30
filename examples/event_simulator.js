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
 * Event Simulator
 * ================
 *
 * Simulates a device that publishes "door_opened" events.
 * Designed to work with the ephemeral event-based alert example:
 *   AppSDK-py/examples/ephemeral_alerts/event_owner.py
 *
 * Timeline (2s intervals):
 *   0-8s    → 1 event  (normal — count stays low)
 *   10-30s  → rapid events every 2s  (breach — count > 3, alert fires)
 *   32-60s  → no events  (recovery — alert resolves)
 *   62s+    → exits
 *
 * Usage:
 *   RELAY_API_KEY=... RELAY_SECRET=... node examples/event_simulator.js
 */

async function main() {
  const connected = await device.connect();

  if (!connected) {
    console.error("Failed to connect");
    process.exit(1);
  }

  console.log("Connected. Running event simulator for alert testing...\n");
  console.log('Publishes "door_opened" events on a schedule.\n');
  console.log("Timeline:");
  console.log("   0-8s   → 1 event (normal)");
  console.log("  10-30s  → rapid events every 2s (breach → alert fires)");
  console.log("  32-60s  → no events (recovery → alert resolves)");
  console.log("  62s+    → exits\n");

  const startTime = Date.now();
  let eventCount = 0;

  const interval = setInterval(async () => {
    const elapsed = (Date.now() - startTime) / 1000;

    if (elapsed > 62) {
      console.log("\nProfile complete.");
      clearInterval(interval);
      await device.disconnect();
      console.log("Disconnected.");
      process.exit(0);
    }

    // Decide whether to send an event this tick
    let shouldSend = false;
    let phase = "NORMAL";

    if (elapsed < 10) {
      // Normal phase: send one event at ~2s
      shouldSend = eventCount === 0;
      phase = "NORMAL";
    } else if (elapsed < 32) {
      // Breach phase: send events every tick
      shouldSend = true;
      phase = "BREACH";
    } else {
      // Recovery phase: no events
      shouldSend = false;
      phase = "RECOVERY";
    }

    if (shouldSend) {
      eventCount++;

      const payload = {
        action: "open",
        zone: "warehouse",
        count: eventCount,
        timestamp: Date.now(),
      };

      const ok = await device.event.send("door_opened", payload);

      console.log(
        `[${elapsed.toFixed(0).padStart(3)}s] [${phase.padEnd(10)}] ` +
          `door_opened #${eventCount} (${ok ? "sent" : "buff"})`,
      );
    } else {
      console.log(
        `[${elapsed.toFixed(0).padStart(3)}s] [${phase.padEnd(10)}] ` +
          `-- no event --`,
      );
    }
  }, 2000);

  process.on("SIGINT", async () => {
    clearInterval(interval);
    await device.disconnect();
    console.log("Disconnected.");
    process.exit(0);
  });
}

main();
