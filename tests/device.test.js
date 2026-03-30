import { describe, it, expect, beforeEach, vi } from "vitest";
import { RelayDevice } from "../src/device.js";
import { ValidationError } from "../src/utils/errors.js";
import { TransportStatus } from "../src/transport.js";
import { createMockTransport } from "./helpers/mock-transport.js";

describe("RelayDevice", () => {
  const validConfig = {
    api_key: "test-jwt-key",
    secret: "test-nkey-seed",
    mode: "test",
  };

  describe("constructor", () => {
    it("should throw ValidationError with null config", () => {
      expect(() => new RelayDevice(null)).toThrow(ValidationError);
    });

    it("should throw ValidationError with missing api_key", () => {
      expect(() => new RelayDevice({ secret: "s", mode: "test" })).toThrow(
        ValidationError,
      );
    });

    it("should throw ValidationError with missing secret", () => {
      expect(() => new RelayDevice({ api_key: "k", mode: "test" })).toThrow(
        ValidationError,
      );
    });

    it("should throw ValidationError with missing mode", () => {
      expect(() => new RelayDevice({ api_key: "k", secret: "s" })).toThrow(
        ValidationError,
      );
    });

    it("should throw ValidationError with invalid mode", () => {
      expect(
        () => new RelayDevice({ api_key: "k", secret: "s", mode: "staging" }),
      ).toThrow(ValidationError);
    });

    it("should throw ValidationError with empty api_key", () => {
      expect(
        () => new RelayDevice({ api_key: "", secret: "s", mode: "test" }),
      ).toThrow(ValidationError);
    });

    it("should throw ValidationError with empty secret", () => {
      expect(
        () => new RelayDevice({ api_key: "k", secret: "", mode: "test" }),
      ).toThrow(ValidationError);
    });

    it("should throw ValidationError with empty mode", () => {
      expect(
        () => new RelayDevice({ api_key: "k", secret: "s", mode: "" }),
      ).toThrow(ValidationError);
    });
  });

  describe("static constants", () => {
    it('should have TEST_MODE = "test"', () => {
      expect(RelayDevice.TEST_MODE).toBe("test");
    });

    it('should have PRODUCTION_MODE = "production"', () => {
      expect(RelayDevice.PRODUCTION_MODE).toBe("production");
    });
  });

  describe("_createForTest()", () => {
    let transport;
    let device;

    beforeEach(() => {
      transport = createMockTransport();
      device = RelayDevice._createForTest(validConfig, transport);
    });

    it("should create a RelayDevice instance", () => {
      expect(device).toBeInstanceOf(RelayDevice);
    });

    it("should validate config", () => {
      expect(() => RelayDevice._createForTest(null, transport)).toThrow(
        ValidationError,
      );
    });

    it("should validate config fields", () => {
      expect(() =>
        RelayDevice._createForTest(
          { api_key: "", secret: "s", mode: "test" },
          transport,
        ),
      ).toThrow(ValidationError);
    });

    it("should initialize rpc subsystem", () => {
      expect(device.rpc).toBeDefined();
      expect(device.rpc.listen).toBeInstanceOf(Function);
      expect(device.rpc.off).toBeInstanceOf(Function);
    });

    it("should initialize command subsystem", () => {
      expect(device.command).toBeDefined();
      expect(device.command.listen).toBeInstanceOf(Function);
      expect(device.command.off).toBeInstanceOf(Function);
    });

    it("should initialize telemetry subsystem", () => {
      expect(device.telemetry).toBeDefined();
      expect(device.telemetry.publish).toBeInstanceOf(Function);
    });

    it("should initialize config subsystem", () => {
      expect(device.config).toBeDefined();
      expect(device.config.get).toBeInstanceOf(Function);
      expect(device.config.set).toBeInstanceOf(Function);
    });

    it("should initialize event subsystem", () => {
      expect(device.event).toBeDefined();
      expect(device.event.send).toBeInstanceOf(Function);
    });

    it("should initialize time subsystem", () => {
      expect(device.time).toBeDefined();
      expect(device.time.now).toBeInstanceOf(Function);
      expect(device.time.toDate).toBeInstanceOf(Function);
      expect(device.time.toTimestamp).toBeInstanceOf(Function);
      expect(device.time.setTimezone).toBeInstanceOf(Function);
    });

    it("should initialize connection subsystem", () => {
      expect(device.connection).toBeDefined();
      expect(device.connection.listeners).toBeInstanceOf(Function);
    });
  });

  describe("connect()", () => {
    let transport;
    let device;

    beforeEach(() => {
      transport = createMockTransport();
      device = RelayDevice._createForTest(validConfig, transport);
    });

    it("should delegate to transport.connect()", async () => {
      const result = await device.connect();
      expect(result).toBe(true);
    });

    it("should return false when already connected", async () => {
      await device.connect();
      const result = await device.connect();
      expect(result).toBe(false);
    });
  });

  describe("disconnect()", () => {
    let transport;
    let device;

    beforeEach(() => {
      transport = createMockTransport();
      device = RelayDevice._createForTest(validConfig, transport);
    });

    it("should return false when not connected", async () => {
      const result = await device.disconnect();
      expect(result).toBe(false);
    });

    it("should return true after successful disconnect", async () => {
      await device.connect();
      const result = await device.disconnect();
      expect(result).toBe(true);
    });

    it("should return false on second disconnect", async () => {
      await device.connect();
      await device.disconnect();
      const result = await device.disconnect();
      expect(result).toBe(false);
    });
  });

  describe("connection.listeners()", () => {
    let transport;
    let device;

    beforeEach(() => {
      transport = createMockTransport();
      device = RelayDevice._createForTest(validConfig, transport);
    });

    it("should register a status callback", () => {
      const cb = vi.fn();
      device.connection.listeners(cb);
      transport._emitStatus({ type: TransportStatus.CONNECTED });
      expect(cb).toHaveBeenCalledWith({ type: TransportStatus.CONNECTED });
    });

    it("should support multiple listeners", () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      device.connection.listeners(cb1);
      device.connection.listeners(cb2);
      transport._emitStatus({ type: TransportStatus.DISCONNECTED });
      expect(cb1).toHaveBeenCalledOnce();
      expect(cb2).toHaveBeenCalledOnce();
    });

    it("should receive all status event types", async () => {
      const events = [];
      device.connection.listeners((e) => events.push(e.type));

      transport._emitStatus({ type: TransportStatus.CONNECTED });
      transport._emitStatus({ type: TransportStatus.DISCONNECTED });
      transport._emitStatus({ type: TransportStatus.RECONNECTING });
      transport._emitStatus({ type: TransportStatus.RECONNECTED });
      transport._emitStatus({ type: TransportStatus.AUTH_FAILED });
      transport._emitStatus({ type: TransportStatus.RECONNECT_FAILED });

      expect(events).toEqual([
        "connected",
        "disconnected",
        "reconnecting",
        "reconnected",
        "auth_failed",
        "reconnect_failed",
      ]);
    });
  });

  describe("integration: subsystems use injected transport", () => {
    let transport;
    let device;

    beforeEach(() => {
      transport = createMockTransport();
      device = RelayDevice._createForTest(validConfig, transport);
    });

    it("rpc.listen should subscribe via transport", async () => {
      await device.rpc.listen("test", () => {});
      const subs = transport._getSubscriptions();
      expect(Object.keys(subs)).toHaveLength(1);
    });

    it("command.listen should subscribe via transport", async () => {
      await device.command.listen("test", () => {});
      const subs = transport._getSubscriptions();
      expect(Object.keys(subs)).toHaveLength(1);
    });

    it("telemetry.publish should publish via transport", async () => {
      await device.telemetry.publish("temp", 25);
      expect(transport._getPublished()).toHaveLength(1);
    });

    it("event.send should publish via transport", async () => {
      await device.event.send("boot", { reason: "power" });
      expect(transport._getPublished()).toHaveLength(1);
    });

    it("config.get should request via transport", async () => {
      transport = createMockTransport({
        requestHandler: () => ({
          status: "DEVICE_CONFIG_FETCH_SUCCESS",
          data: { config: { x: 1 } },
        }),
      });
      device = RelayDevice._createForTest(validConfig, transport);

      const result = await device.config.get();
      expect(result).toEqual({ x: 1 });
    });

    it("config.set should request via transport", async () => {
      transport = createMockTransport({
        requestHandler: () => ({ status: "DEVICE_CONFIG_UPDATE_SUCCESS" }),
      });
      device = RelayDevice._createForTest(validConfig, transport);

      const result = await device.config.set({ y: 2 });
      expect(result).toBe(true);
    });

    it("time.now should work without connection", () => {
      const result = device.time.now();
      expect(typeof result).toBe("number");
    });

    it("time.toDate/toTimestamp should work without connection", () => {
      const date = device.time.toDate(1000000);
      expect(date).toBeInstanceOf(Date);

      const ts = device.time.toTimestamp(new Date());
      expect(typeof ts).toBe("number");
    });
  });
});
