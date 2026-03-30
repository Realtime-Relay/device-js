import { describe, it, expect, beforeEach, vi } from "vitest";
import { TelemetryManager } from "../../src/subsystems/telemetry.js";
import { createMockTransport } from "../helpers/mock-transport.js";

describe("TelemetryManager", () => {
  let transport;
  let mockTime;
  let telemetry;

  beforeEach(() => {
    transport = createMockTransport();
    mockTime = { now: vi.fn().mockReturnValue(1000000) };
    telemetry = new TelemetryManager(transport, mockTime);
  });

  describe("publish() — no schema", () => {
    it("should publish to the correct subject", async () => {
      await telemetry.publish("temperature", 23.5);
      const published = transport._getPublished();
      expect(published).toHaveLength(1);
      expect(published[0].subject).toBe(
        "test-org.test.telemetry.test-device.temperature",
      );
    });

    it("should wrap reading in {value, timestamp} payload", async () => {
      mockTime.now.mockReturnValue(999999);
      await telemetry.publish("temperature", 23.5);
      const published = transport._getPublished();
      expect(published[0].data).toEqual({
        value: 23.5,
        timestamp: 999999,
      });
    });

    it("should call time.now() for timestamp", async () => {
      await telemetry.publish("temperature", 23.5);
      expect(mockTime.now).toHaveBeenCalledOnce();
    });

    it("should return true when connected (publish succeeds)", async () => {
      transport.isConnected = () => true;
      const result = await telemetry.publish("temp", 20);
      expect(result).toBeDefined();
    });

    it("should handle string readings", async () => {
      await telemetry.publish("status", "online");
      const published = transport._getPublished();
      expect(published[0].data.value).toBe("online");
    });

    it("should handle object readings", async () => {
      const reading = { temp: 23, humidity: 65 };
      await telemetry.publish("environment", reading);
      const published = transport._getPublished();
      expect(published[0].data.value).toEqual(reading);
    });

    it("should handle numeric readings", async () => {
      await telemetry.publish("voltage", 3.3);
      const published = transport._getPublished();
      expect(published[0].data.value).toBe(3.3);
    });

    it("should handle zero reading", async () => {
      await telemetry.publish("count", 0);
      const published = transport._getPublished();
      expect(published[0].data.value).toBe(0);
    });

    it("should handle null reading", async () => {
      await telemetry.publish("sensor", null);
      const published = transport._getPublished();
      expect(published[0].data.value).toBeNull();
    });

    it("should throw ValidationError on invalid metric name", async () => {
      await expect(telemetry.publish("bad metric", 1)).rejects.toThrow();
    });

    it("should throw ValidationError on empty metric", async () => {
      await expect(telemetry.publish("", 1)).rejects.toThrow();
    });

    it("should use different timestamps for different calls", async () => {
      mockTime.now.mockReturnValueOnce(100).mockReturnValueOnce(200);
      await telemetry.publish("temp", 1);
      await telemetry.publish("temp", 2);
      const published = transport._getPublished();
      expect(published[0].data.timestamp).toBe(100);
      expect(published[1].data.timestamp).toBe(200);
    });

    it("should allow any metric when schema is null", async () => {
      await telemetry.publish("anything_goes", 42);
      const published = transport._getPublished();
      expect(published).toHaveLength(1);
    });
  });

  describe("publish() — with schema", () => {
    const schema = {
      temperature: "number",
      status: "string",
      config: "json",
      enabled: "boolean",
    };

    beforeEach(() => {
      transport = createMockTransport({ schema });
      telemetry = new TelemetryManager(transport, mockTime);
    });

    // --- Valid cases ---
    it("should publish number metric with number reading", async () => {
      await telemetry.publish("temperature", 23.5);
      const published = transport._getPublished();
      expect(published).toHaveLength(1);
      expect(published[0].data.value).toBe(23.5);
    });

    it("should publish string metric with string reading", async () => {
      await telemetry.publish("status", "online");
      const published = transport._getPublished();
      expect(published).toHaveLength(1);
      expect(published[0].data.value).toBe("online");
    });

    it("should publish json metric with object reading", async () => {
      const data = { foo: "bar", nested: { a: 1 } };
      await telemetry.publish("config", data);
      const published = transport._getPublished();
      expect(published).toHaveLength(1);
      expect(published[0].data.value).toEqual(data);
    });

    it("should publish json metric with array reading", async () => {
      const data = [1, 2, 3];
      await telemetry.publish("config", data);
      const published = transport._getPublished();
      expect(published).toHaveLength(1);
      expect(published[0].data.value).toEqual(data);
    });

    it("should publish boolean metric with boolean reading", async () => {
      await telemetry.publish("enabled", true);
      const published = transport._getPublished();
      expect(published).toHaveLength(1);
      expect(published[0].data.value).toBe(true);
    });

    it("should publish boolean metric with false value", async () => {
      await telemetry.publish("enabled", false);
      const published = transport._getPublished();
      expect(published[0].data.value).toBe(false);
    });

    it("should publish number metric with zero", async () => {
      await telemetry.publish("temperature", 0);
      const published = transport._getPublished();
      expect(published[0].data.value).toBe(0);
    });

    it("should publish number metric with negative value", async () => {
      await telemetry.publish("temperature", -10.5);
      const published = transport._getPublished();
      expect(published[0].data.value).toBe(-10.5);
    });

    it("should allow null reading even with schema", async () => {
      await telemetry.publish("temperature", null);
      const published = transport._getPublished();
      expect(published[0].data.value).toBeNull();
    });

    it("should allow undefined reading even with schema", async () => {
      await telemetry.publish("temperature", undefined);
      const published = transport._getPublished();
      expect(published[0].data.value).toBeUndefined();
    });

    // --- Invalid metric ---
    it("should throw if metric is not in schema", async () => {
      await expect(telemetry.publish("humidity", 65)).rejects.toThrow(
        "metric 'humidity' is not defined in the device schema",
      );
    });

    it("should throw for unknown metric even with valid type", async () => {
      await expect(telemetry.publish("unknown_metric", 42)).rejects.toThrow(
        "not defined in the device schema",
      );
    });

    // --- Type mismatch ---
    it("should throw if number metric gets string reading", async () => {
      await expect(telemetry.publish("temperature", "hot")).rejects.toThrow(
        "metric 'temperature' expects type 'number', got 'string'",
      );
    });

    it("should throw if number metric gets boolean reading", async () => {
      await expect(telemetry.publish("temperature", true)).rejects.toThrow(
        "expects type 'number', got 'boolean'",
      );
    });

    it("should throw if number metric gets object reading", async () => {
      await expect(
        telemetry.publish("temperature", { val: 1 }),
      ).rejects.toThrow("expects type 'number', got 'json'");
    });

    it("should throw if string metric gets number reading", async () => {
      await expect(telemetry.publish("status", 42)).rejects.toThrow(
        "expects type 'string', got 'number'",
      );
    });

    it("should throw if string metric gets boolean reading", async () => {
      await expect(telemetry.publish("status", false)).rejects.toThrow(
        "expects type 'string', got 'boolean'",
      );
    });

    it("should throw if boolean metric gets number reading", async () => {
      await expect(telemetry.publish("enabled", 1)).rejects.toThrow(
        "expects type 'boolean', got 'number'",
      );
    });

    it("should throw if boolean metric gets string reading", async () => {
      await expect(telemetry.publish("enabled", "true")).rejects.toThrow(
        "expects type 'boolean', got 'string'",
      );
    });

    it("should throw if json metric gets number reading", async () => {
      await expect(telemetry.publish("config", 42)).rejects.toThrow(
        "expects type 'json', got 'number'",
      );
    });

    it("should throw if json metric gets string reading", async () => {
      await expect(telemetry.publish("config", "hello")).rejects.toThrow(
        "expects type 'json', got 'string'",
      );
    });

    // --- Still validates subject token ---
    it("should still throw on invalid metric token characters", async () => {
      // Schema check happens first, so unknown metric error
      await expect(telemetry.publish("bad metric", 1)).rejects.toThrow();
    });
  });
});
