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
 * Temperature profile for gauge testing:
 *
 * Timeline (500ms tick):
 *   0-10s   → ramp 0 → 50       (linear climb)
 *   10-18s  → jitter 48-50      (hold zone)
 *   18-24s  → ramp 50 → 80      (linear climb)
 *   24-32s  → jitter 75-82      (hold zone)
 *   32-42s  → ramp 80 → 100     (linear climb)
 *   42+     → loop from start
 */
const TOTAL_CYCLE = 42; // seconds per full cycle

function getTemperature(elapsed) {
  const t = elapsed % TOTAL_CYCLE;

  if (t < 10) {
    // Ramp 0 → 50 over 10s
    return (t / 10) * 50;
  }
  if (t < 18) {
    // Jitter between 48-50
    return 48 + Math.random() * 2;
  }
  if (t < 24) {
    // Ramp 50 → 80 over 6s
    const progress = (t - 18) / 6;
    return 50 + progress * 30;
  }
  if (t < 32) {
    // Jitter between 75-82
    return 75 + Math.random() * 7;
  }
  if (t < 42) {
    // Ramp 80 → 100 over 10s
    const progress = (t - 32) / 10;
    return 80 + progress * 20;
  }
  return 100;
}

function getHumidity(elapsed) {
  const t = elapsed % TOTAL_CYCLE;

  if (t < 10) {
    return (t / 10) * 40;
  }
  if (t < 18) {
    return 38 + Math.random() * 4;
  }
  if (t < 24) {
    const progress = (t - 18) / 6;
    return 40 + progress * 25;
  }
  if (t < 32) {
    return 60 + Math.random() * 10;
  }
  if (t < 42) {
    const progress = (t - 32) / 10;
    return 65 + progress * 15;
  }
  return 80;
}

async function main() {
  const connected = await device.connect();
  if (!connected) {
    console.error("Failed to connect");
    process.exit(1);
  }

  console.log("Connected. Running gauge test profile (loops every 42s)...\n");
  console.log(
    "Profile: 0→50 (10s) → jitter 48-50 (8s) → 50→80 (6s) → jitter 75-82 (8s) → 80→100 (10s)\n",
  );

  const startTime = Date.now();
  let tick = 0;

  const interval = setInterval(async () => {
    // const elapsed = (Date.now() - startTime) / 1000;
    // const temperature = +getTemperature(elapsed).toFixed(2);
    // const humidity = +getHumidity(elapsed).toFixed(2);

    // const [tempOk, humOk] = await Promise.all([
    //   device.telemetry.publish("temperature", temperature),
    //   device.telemetry.publish("humidity", humidity),
    // ]);

    // const t = elapsed % TOTAL_CYCLE;
    // const cycle = Math.floor(elapsed / TOTAL_CYCLE) + 1;
    // const phase =
    //   t < 10
    //     ? "RAMP 0→50"
    //     : t < 18
    //       ? "HOLD ~49"
    //       : t < 24
    //         ? "RAMP 50→80"
    //         : t < 32
    //           ? "HOLD ~78"
    //           : "RAMP 80→100";

    // console.log(
    //   `[${elapsed.toFixed(0).padStart(3)}s] [C${cycle}] [${phase.padEnd(12)}] ` +
    //     `temp=${temperature}°C (${tempOk ? "sent" : "buff"}) | ` +
    //     `humidity=${humidity}% (${humOk ? "sent" : "buff"})`,
    // );

    await device.event.send("reboot_device", {
      "hey": "world"
    })

    tick++;
  }, 200);

  device.rpc.listen("reboot_device", (req) => {
    console.log("Rebooting....");
    console.log("Device rebooted!");

    console.log(req.payload);

    req.respond({
      status: "REBOOT_OK",
      timestamp: Date.now(),
    });
  });

  device.command.listen("setConfig", (msg) => {
    console.log(msg.payload);
  });

  process.on("SIGINT", async () => {
    clearInterval(interval);
    await device.disconnect();
    console.log("Disconnected.");
    process.exit(0);
  });
}

main();
