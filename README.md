# RelayX Device SDK for JavaScript

Official JavaScript SDK for connecting IoT devices to the RelayX platform.

> **[View Full Documentation →](https://docs.relay-x.io/device-sdk/overview)**

## Installation

```bash
npm install @relay-x/device-sdk
```

## Quick Start

```js
import { RelayDevice } from "@relay-x/device-sdk";

const device = new RelayDevice({
  api_key: "<YOUR_API_KEY>",
  secret: "<YOUR_SECRET>",
  mode: RelayDevice.PRODUCTION_MODE, // or RelayDevice.TEST_MODE
});

await device.connect();

// Publish telemetry
await device.telemetry.publish("temperature", 22.5);

// Listen for RPC calls
await device.rpc.listen("reboot", (req) => {
  console.log("Reboot requested:", req.payload);
  req.respond({ status: "rebooting" });
});

// Listen for commands
await device.command.listen("firmware_update", (msg) => {
  console.log("Firmware update:", msg.payload);
  msg.ack();
});

// Disconnect when done
await device.disconnect();
```

## Configuration

```js
const device = new RelayDevice({
  api_key: "<YOUR_API_KEY>", // JWT issued by RelayX
  secret: "<YOUR_SECRET>", // NKEY seed
  mode: "production", // 'production' | 'test'
});
```

## Functionality

### Connection

```js
await device.connect(); // returns true on success, false if already connected or failed
await device.disconnect(); // drains NATS connection, cleans up consumers

// Listen for connection status changes
device.connection.listeners((event) => {
  // event.type: 'connected' | 'disconnected' | 'reconnecting' | 'reconnected' | 'auth_failed'
  console.log("Status:", event.type);
});
```

### Telemetry

Fire-and-forget sensor data publishing. Readings are validated against the device schema fetched on connect.

```js
await device.telemetry.publish("temperature", 22.5); // number
await device.telemetry.publish("status", "online"); // string
await device.telemetry.publish("active", true); // boolean
await device.telemetry.publish("metadata", { fw: "1.2" }); // json
```

Each message is published with a server-synced timestamp.

**Schema validation**: On connect, the SDK fetches the device schema from the server. If a schema exists, `publish()` will throw a `ValidationError` if the metric name is not in the schema or the reading type does not match.

### Remote Procedure Calls (RPC)

Register handlers for incoming RPC calls.

```js
// Register a handler
await device.rpc.listen("get_status", (req) => {
  console.log("Payload:", req.payload);

  // Respond with success
  req.respond({ uptime: 12345 });

  // Or respond with error
  // req.error({ code: 'UNAVAILABLE', message: 'Device busy' });
});

// Unregister
await device.rpc.off("get_status");
```

Duplicate listeners for the same name throw `DuplicateListenerError`.

### Commands

One-way commands delivered for long running tasks and that do not require a status update

```js
await device.command.listen("firmware_update", (msg) => {
  console.log("Command:", msg.payload);

  // Process based on data...
});

await device.command.off("firmware_update");
```

### Config

Get and set device configuration

```js
// Fetch current config
const config = await device.config.get();
console.log(config);

// Update config
const success = await device.config.set({ interval: 10000, name: "sensor-1" });
```

### Events

Fire-and-forget event publishing of events (fault codes, etc)

```js
await device.event.send("door_opened", {
  door_id: "front",
  timestamp: Date.now(),
});
```

### Time

NTP-synchronized clock. Syncs with `time.google.com` on connect and every 3 hours. Auto-resyncs on reconnect if stale.

```js
// Initialize (called automatically on connect)
await device.time.init();

// Get current server-corrected timestamp (ms)
const now = device.time.now();

// Convert SDK timestamp to Date
const date = device.time.toDate(now);

// Convert Date to SDK timestamp
const ts = device.time.toTimestamp(new Date());

// Set timezone for display
device.time.setTimezone("America/New_York");
```

## Error Handling

The SDK exports four error types:

```js
import {
  NotConnectedError, // Operation attempted while disconnected
  DuplicateListenerError, // rpc.listen() or command.listen() called twice for same name
  ValidationError, // Invalid arguments or schema mismatch
  TimeoutError, // Request/reply timed out
} from "@relay-x/device-sdk";
```

## Offline Behavior

- **Telemetry & Events** (`publish`): Messages are buffered in memory while disconnected and flushed automatically on reconnect.
- **RPC & Commands** (`listen`): Throw `NotConnectedError` if transport is disconnected.
- **Config** (`get`/`set`): Throw `NotConnectedError` if transport is disconnected.

## Testing

```bash
npm test
```

The SDK is designed for full unit testability. All subsystems accept a transport dependency that can be mocked:

```js
import { RelayDevice } from "@relay-x/device-sdk";

const mockTransport = {
  /* mock methods */
};
const device = RelayDevice._createForTest(
  { api_key: "test", secret: "test", mode: "test" },
  mockTransport,
);
```

## License

Apache-2.0
